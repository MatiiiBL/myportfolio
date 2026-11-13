import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useReducedMotion } from "../vecdex/useReducedMotion";
import attention from "./data/attention.json";
import { SMOLLM2, kvBytesPerSlot, kvBytesPerToken, kvHeadOf, softmax } from "./model";
import "./DecodeStep.css";

const LAYERS = ["0", "15"] as const;
type Layer = (typeof LAYERS)[number];
const SCORES = attention.layers as Record<Layer, number[][][]>;
const TOKENS = attention.tokens;
const LAST = TOKENS.length - 1;
/** Positions drawn in the cache sketch; the real cache is sized for max_seq_len. */
const SLOTS = 16;
const HEADS = Array.from({ length: SMOLLM2.heads }, (_, h) => h);

const shown = (token: string) => (token.trim() === "" ? "␠" : token.trim());
const kib = (bytes: number) =>
  `${(bytes / 1024).toLocaleString("en-US", { maximumFractionDigits: 0 })} KiB`;

/** One decoding step of SmolLM2-135M: the KV cache after position t, and t's attention over it. */
export function DecodeStep() {
  const reduced = useReducedMotion();
  const [t, setT] = useState(LAST);
  const [layer, setLayer] = useState<Layer>("15");
  const [head, setHead] = useState(6);
  const [playing, setPlaying] = useState(false);
  const tokenRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const ids = useId();

  const animating = playing && !reduced && t < LAST;
  useEffect(() => {
    if (!animating) return;
    const timer = window.setTimeout(() => setT(t + 1), 900);
    return () => window.clearTimeout(timer);
  }, [animating, t]);

  const weights = useMemo(
    () => HEADS.map((h) => softmax(SCORES[layer][h]?.[t] ?? [0])),
    [layer, t],
  );

  const select = (next: number, focus: boolean) => {
    const clamped = Math.max(0, Math.min(LAST, next));
    setPlaying(false);
    setT(clamped);
    if (focus) tokenRefs.current[clamped]?.focus();
  };

  const onTokenKey = (event: KeyboardEvent<HTMLOListElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: t - 1,
      ArrowRight: t + 1,
      Home: 0,
      End: LAST,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  };

  const play = () => {
    if (animating) {
      setPlaying(false);
      return;
    }
    if (t >= LAST) setT(0);
    setPlaying(true);
  };

  const selected = weights[head] ?? [];
  const slot = kvBytesPerSlot(SMOLLM2);
  const used = (t + 1) * kvBytesPerToken(SMOLLM2);

  return (
    <div className="ds">
      <div className="ds-bar">
        {!reduced && (
          <button type="button" className="ds-button" onClick={play}>
            {animating ? "Pause" : t >= LAST ? "Replay" : "Play"}
          </button>
        )}
        <div className="ds-toggle" role="group" aria-label="Layer">
          {LAYERS.map((l) => (
            <button
              key={l}
              type="button"
              className="ds-button"
              aria-pressed={layer === l}
              onClick={() => setLayer(l)}
            >
              Layer {l}
            </button>
          ))}
        </div>
      </div>

      <p id={`${ids}-tokens`} className="ds-label">
        Decoding step: pick the token being processed (arrow keys move it)
      </p>
      <ol className="ds-tokens" aria-labelledby={`${ids}-tokens`} onKeyDown={onTokenKey}>
        {TOKENS.map((token, i) => (
          <li key={i}>
            <button
              ref={(el) => {
                tokenRefs.current[i] = el;
              }}
              type="button"
              className={i > t ? "ds-token is-future" : "ds-token"}
              aria-current={i === t ? "step" : undefined}
              tabIndex={i === t ? 0 : -1}
              onClick={() => select(i, false)}
            >
              <span className="ds-pos">{i}</span> <span className="ds-text">{shown(token)}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="ds-main">
        <div>
          <p id={`${ids}-attn`} className="ds-label">
            Layer {layer}: how much each of the 9 query heads of position {t} (&quot;
            {shown(TOKENS[t] ?? "")}&quot;) attends to each cached position
          </p>
          <div className="ds-attn-wrap" role="region" aria-labelledby={`${ids}-attn`} tabIndex={0}>
            <table className="ds-attn" aria-labelledby={`${ids}-attn`}>
              <thead>
                <tr className="ds-groups">
                  <td />
                  {[0, 1, 2].map((g) => (
                    <th key={g} scope="colgroup" colSpan={3}>
                      KV head {g}
                    </th>
                  ))}
                  <td />
                </tr>
                <tr>
                  <th scope="col" className="ds-rowhead">
                    Cached
                  </th>
                  {HEADS.map((h) => (
                    <th key={h} scope="col" className={kvHeadOf(SMOLLM2, h) % 2 ? "ds-odd" : ""}>
                      <button
                        type="button"
                        className="ds-head"
                        aria-pressed={h === head}
                        aria-label={`Query head ${h}`}
                        onClick={() => setHead(h)}
                      >
                        {h}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="ds-detail-head">
                    <span className="ds-wide">Head </span>
                    {head}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(weights[0] ?? []).map((_, s) => (
                  <tr key={s} className={s === t ? "is-new" : undefined}>
                    <th scope="row" className="ds-rowhead">
                      <span className="ds-pos">{s}</span> {shown(TOKENS[s] ?? "")}
                    </th>
                    {HEADS.map((h) => {
                      const w = weights[h]?.[s] ?? 0;
                      return (
                        <td
                          key={h}
                          className={h === head ? "ds-cell is-selected" : "ds-cell"}
                          style={{ "--w": w.toFixed(3) } as CSSProperties}
                        >
                          <span className="visually-hidden">{w.toFixed(2)}</span>
                        </td>
                      );
                    })}
                    <td className="ds-detail">
                      <span
                        className="ds-weight"
                        style={{ width: `${((selected[s] ?? 0) * 100).toFixed(1)}%` }}
                      />
                      <span className="ds-value">{(selected[s] ?? 0).toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ds-scale" aria-hidden="true">
            <span>0</span>
            <span className="ds-ramp" />
            <span>1 · attention weight</span>
          </div>
        </div>

        <div className="ds-cache">
          <p className="ds-label">KV cache, one column per position</p>
          <svg
            viewBox={`0 0 ${36 + SLOTS * 14} ${SMOLLM2.layers * 7 + 22}`}
            className="ds-cache-svg"
            role="img"
            aria-label={
              `The KV cache holds positions 0 to ${t} in all ${SMOLLM2.layers} layers; ` +
              `${SLOTS - t - 1} of the ${SLOTS} positions drawn are still empty.`
            }
          >
            {Array.from({ length: SMOLLM2.layers }, (_, l) => (
              <g key={l}>
                {(l === 0 || l === 15 || l === SMOLLM2.layers - 1) && (
                  <text
                    className={String(l) === layer ? "ds-cache-label is-on" : "ds-cache-label"}
                    x={30}
                    y={l * 7 + 6}
                    textAnchor="end"
                  >
                    L{l}
                  </text>
                )}
                {Array.from({ length: SLOTS }, (_, p) => (
                  <rect
                    key={p}
                    className={
                      p > t
                        ? "ds-slot"
                        : p === t
                          ? "ds-slot is-new"
                          : String(l) === layer
                            ? "ds-slot is-full is-on"
                            : "ds-slot is-full"
                    }
                    x={36 + p * 14}
                    y={l * 7}
                    width={12}
                    height={5}
                    rx={1}
                  />
                ))}
              </g>
            ))}
            {[0, t, SLOTS - 1]
              .filter((p, i, all) => all.indexOf(p) === i)
              .map((p) => (
                <text
                  key={p}
                  className="ds-cache-label"
                  x={36 + p * 14 + 6}
                  y={SMOLLM2.layers * 7 + 14}
                  textAnchor="middle"
                >
                  {p}
                </text>
              ))}
          </svg>
          <dl className="ds-stats">
            <div>
              <dt>In use after position {t}</dt>
              <dd>{kib(used)}</dd>
            </div>
            <div>
              <dt>Added per token</dt>
              <dd>{kib(kvBytesPerToken(SMOLLM2))}</dd>
            </div>
          </dl>
          <p className="ds-note">
            A slot holds K and V for {SMOLLM2.kvHeads} KV heads × {SMOLLM2.headDim} floats:{" "}
            {slot.toLocaleString("en-US")} bytes. With one KV head per query head it would be{" "}
            {SMOLLM2.heads / SMOLLM2.kvHeads}× larger.
          </p>
        </div>
      </div>
    </div>
  );
}
