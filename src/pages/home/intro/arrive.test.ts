import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { arrive, introMode, isAfter } from "./arrive";

function stage(): { root: HTMLElement; pin: HTMLElement; figure: HTMLElement; after: HTMLElement } {
  document.body.innerHTML = `
    <div class="intro"><div class="intro-pin"><div class="hero-figure"></div></div></div>
    <section id="work"></section>`;
  const root = document.querySelector<HTMLElement>(".intro");
  const pin = document.querySelector<HTMLElement>(".intro-pin");
  const figure = document.querySelector<HTMLElement>(".hero-figure");
  const after = document.querySelector<HTMLElement>("#work");
  if (!root || !pin || !figure || !after) throw new Error("no stage");
  return { root, pin, figure, after };
}

describe("arriving", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-intro", "play");
    sessionStorage.clear();
  });
  afterEach(() => {
    document.documentElement.removeAttribute("data-intro");
    vi.restoreAllMocks();
  });

  it("marks the page arrived, remembers it, and shows the hero's search", () => {
    const { root, figure } = stage();
    figure.style.opacity = "0.4";
    figure.style.pointerEvents = "none";
    arrive(root);
    expect(introMode()).toBe("arrived");
    expect(root.dataset.stage).toBe("arrived");
    expect(sessionStorage.getItem("intro")).toBe("arrived");
    expect(figure.style.opacity).toBe("");
    expect(figure.style.pointerEvents).toBe("");
  });

  it("scrolls by the height that went away, so the stage stays where it was", () => {
    const { root, pin } = stage();
    // The pinned stage is 56 px from the top before; collapsed, it would be 2,000 px higher.
    let top = 56;
    vi.spyOn(pin, "getBoundingClientRect").mockImplementation(() => new DOMRect(0, top, 0, 0));
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    const setAttribute = document.documentElement.setAttribute.bind(document.documentElement);
    vi.spyOn(document.documentElement, "setAttribute").mockImplementation((name, value) => {
      setAttribute(name, value);
      if (name === "data-intro" && value === "arrived") top = 56 - 2000;
    });
    arrive(root);
    expect(scrollBy).toHaveBeenCalledWith({ top: -2000, left: 0, behavior: "instant" });
  });

  it("does not scroll when told not to, and does nothing once arrived", () => {
    const { root } = stage();
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    arrive(root, false);
    expect(introMode()).toBe("arrived");
    root.dataset.stage = "kept";
    arrive(root);
    expect(root.dataset.stage).toBe("kept");
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("knows what comes after the intro", () => {
    const { root, figure, after } = stage();
    expect(isAfter(root, after)).toBe(true);
    expect(isAfter(root, figure)).toBe(false);
    expect(isAfter(root, document.body)).toBe(false);
  });
});
