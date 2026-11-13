import { useEffect, useState } from "react";

interface Entry {
  id: string;
  label: string;
}

/**
 * "On this page": a sticky list of the page's top-level sections, read from the rendered page
 * (each <Section> carries its id and label), with the section being read marked. Project bodies
 * load lazily, so the list follows the DOM as it fills in. Shown beside the body on wide
 * screens only; it is a reading aid, so it is left out of the prerendered HTML.
 */
export function TableOfContents({ bodySelector }: { bodySelector: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const body = document.querySelector(bodySelector);
    if (!body) return;
    const read = () => {
      const sections = [...body.querySelectorAll<HTMLElement>("section.section[id]")].filter(
        (s) => !s.parentElement?.closest("section.section"),
      );
      const next = sections.map((s) => ({ id: s.id, label: s.dataset.navLabel ?? s.id }));
      setEntries((prev) => (sameEntries(prev, next) ? prev : next));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [bodySelector]);

  useEffect(() => {
    if (entries.length === 0) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = entries[0]?.id ?? null;
      for (const { id } of entries) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.3) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [entries]);

  if (entries.length < 2) return null;
  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ul>
        {entries.map(({ id, label }) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={active === id ? "location" : undefined}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function sameEntries(a: Entry[], b: Entry[]): boolean {
  return a.length === b.length && a.every((e, i) => e.id === b[i]?.id && e.label === b[i]?.label);
}
