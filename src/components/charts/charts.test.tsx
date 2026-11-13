import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { BarChart } from "./BarChart";
import { LineChart } from "./LineChart";
import { barPath, nearestStop } from "./geometry";
import {
  axisTicks,
  formatCompact,
  formatNumber,
  numericScale,
  resolveDomain,
  textWidth,
  thinTicks,
  tickFormatter,
  X_TICK_SPACING,
} from "./scales";

describe("scales", () => {
  it("uses powers of ten on a log axis that spans several decades", () => {
    const axis = { type: "log" as const };
    const scale = numericScale(axis, [1, 100_000], [0, 600]);
    expect(axisTicks(axis, scale, 600)).toEqual([1, 10, 100, 1000, 10_000, 100_000]);
  });

  it("uses the 1-2-5 sequence on a log axis that spans one decade", () => {
    const axis = { type: "log" as const };
    const scale = numericScale(axis, [1000, 20_000], [0, 600]);
    expect(axisTicks(axis, scale, 600)).toEqual([1000, 2000, 5000, 10_000, 20_000]);
  });

  it("thins explicit ticks that would crowd a short axis, keeping both ends", () => {
    const axis = {
      type: "linear" as const,
      ticks: [1, 64, 128, 192, 256],
      domain: [1, 256] as [number, number],
    };
    // 280 px: 70 px apart, enough for three-digit labels at 60 px.
    const wide = numericScale(axis, [1, 256], [0, 280]);
    expect(axisTicks(axis, wide, 280, X_TICK_SPACING)).toEqual([1, 64, 128, 192, 256]);
    // 140 px: 35 px apart; every other one stays, and the last one always does.
    const narrow = numericScale(axis, [1, 256], [0, 140]);
    expect(axisTicks(axis, narrow, 140, X_TICK_SPACING)).toEqual([1, 128, 256]);
  });

  it("thins uneven explicit ticks by their pixel gaps, not their count", () => {
    const axis = {
      type: "linear" as const,
      ticks: [0, 0.5, 1, 2, 4],
      domain: [0, 4] as [number, number],
    };
    const scale = numericScale(axis, [0, 4], [0, 220]);
    expect(axisTicks(axis, scale, 220, X_TICK_SPACING)).toEqual([0, 2, 4]);
  });

  it("gives wide x labels at least their own width", () => {
    const axis = {
      type: "linear" as const,
      ticks: [0, 2500, 5000, 7500, 10_000],
      domain: [0, 10_000] as [number, number],
    };
    const scale = numericScale(axis, [0, 10_000], [0, 300]);
    // 75 px apart, enough for "2.5K"; full-width labels would need more.
    expect(axisTicks(axis, scale, 300, X_TICK_SPACING)).toHaveLength(5);
    const along = { ...axis, tickFormat: (v: number) => `${v.toLocaleString("en-US")} ops/s` };
    expect(axisTicks(along, scale, 300, X_TICK_SPACING)).toEqual([0, 5000, 10_000]);
  });

  it("thins the y axis by height alone, keeping the given order", () => {
    // 25 px apart on a y axis that grows upward; every other tick stays.
    const scale = numericScale({ type: "linear", domain: [0, 40] }, [0, 40], [200, 100]);
    expect(thinTicks([0, 10, 20, 30, 40], scale, 39)).toEqual([0, 20, 40]);
  });

  it("rejects a log axis that reaches zero", () => {
    expect(() => numericScale({ type: "log" }, [0, 10], [0, 100])).toThrow();
  });

  it("extends linear domains to round ticks unless the domain is explicit", () => {
    const auto = numericScale({ type: "linear" }, [0, 0.93], [0, 300]);
    expect(auto.domain()).toEqual([0, 1]);
    const fixed = numericScale({ type: "linear", domain: [0, 0.93] }, [0, 0.93], [0, 300]);
    expect(fixed.domain()).toEqual([0, 0.93]);
  });

  it("starts bar domains at zero, or a log axis at the power of ten below the data", () => {
    expect(resolveDomain({ type: "linear" }, [3, 8], { includeZero: true })).toEqual([0, 8]);
    expect(resolveDomain({ type: "log" }, [30, 800], { includeZero: true })).toEqual([10, 800]);
    expect(resolveDomain({ type: "log" }, [100, 800], { includeZero: true })).toEqual([10, 800]);
    expect(resolveDomain({ type: "log" }, [30, 800])).toEqual([30, 800]);
  });

  it("formats values in full and ticks compactly once they reach 10,000", () => {
    expect(formatNumber(18_034)).toBe("18,034");
    expect(formatNumber(2.856)).toBe("2.86");
    expect(formatNumber(0.004213)).toBe("0.00421");
    expect(formatCompact(18_000)).toBe("18K");
    expect(formatCompact(1_500_000)).toBe("1.5M");
    expect(tickFormatter({ type: "linear" }, [0, 5000])(2500)).toBe("2,500");
    expect(tickFormatter({ type: "linear" }, [0, 10_000])(2500)).toBe("2.5K");
  });

  it("measures mono text exactly", () => {
    expect(textWidth("10K")).toBeCloseTo(21.6);
  });
});

describe("geometry", () => {
  it("rounds only the data end of a bar", () => {
    const d = barPath("horizontal", 0, 100, 10, 20);
    expect(d.startsWith("M0,10H96A4,4")).toBe(true);
    expect(d.endsWith("H0Z")).toBe(true);
    expect(barPath("vertical", 200, 50, 10, 20)).toContain("V54A4,4 0 0 1 14,50");
    expect(barPath("vertical", 200, 200, 10, 20)).toBe("");
  });

  it("picks the nearest stop along the scan direction", () => {
    const stops = [0, 100, 200].map((x) => ({ x, y: 300 - x, title: "", rows: [] }));
    expect(nearestStop(stops, 140, 0, "x")).toBe(1);
    expect(nearestStop(stops, 0, 110, "y")).toBe(2);
    expect(nearestStop(stops, 190, 120, "xy")).toBe(2);
    expect(nearestStop([], 0, 0, "x")).toBeNull();
  });
});

const lineProps = {
  title: "Throughput",
  x: { type: "linear" as const, label: "threads" },
  y: { type: "linear" as const, label: "ops/s" },
  series: [
    { id: "a", label: "Alpha", points: [1, 2, 4].map((x) => ({ x, y: x * 10 })) },
    { id: "b", label: "Beta", points: [1, 2, 4].map((x) => ({ x, y: x * 7 })) },
  ],
};

describe("LineChart", () => {
  it("renders a legend and a data table with every value", () => {
    render(<LineChart {...lineProps} />);
    expect(screen.getByRole("list", { name: "Legend" })).toHaveTextContent("Alpha");
    const table = screen.getByRole("table", { name: "Throughput" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[3]).toHaveTextContent("44028");
  });

  it("steps through positions with the arrow keys and announces them", () => {
    render(<LineChart {...lineProps} />);
    const plot = screen.getByRole("group", { name: /Throughput/ });
    fireEvent.focus(plot);
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    const live = document.querySelector("[aria-live]");
    expect(live).toHaveTextContent("threads 2: Alpha 20, Beta 14");
    fireEvent.keyDown(plot, { key: "End" });
    expect(live).toHaveTextContent("threads 4: Alpha 40, Beta 28");
    fireEvent.keyDown(plot, { key: "Escape" });
    expect(live).toHaveTextContent("");
  });

  it("gives each point its own stop when the series do not share x values", () => {
    render(
      <LineChart
        {...lineProps}
        series={[
          { id: "a", label: "Alpha", points: [{ x: 1, y: 5, note: "ef = 8" }] },
          { id: "b", label: "Beta", points: [{ x: 2, y: 9 }] },
        ]}
      />,
    );
    const plot = screen.getByRole("group", { name: /Throughput/ });
    fireEvent.focus(plot);
    expect(document.querySelector("[aria-live]")).toHaveTextContent("threads 1 · ef = 8: Alpha 5");
    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((c) => c.textContent),
    ).toEqual(["Series", "threads", "ops/s", "Note"]);
  });
});

describe("BarChart", () => {
  const barProps = {
    title: "Speedup",
    categories: ["ResNet-50", "GPT-2"],
    series: [{ id: "s", label: "Speedup", values: [1.2, null] }],
    value: { type: "linear" as const, format: (v: number) => `${v}×` },
  };

  it("prints values at the tips of a single series and has no legend", () => {
    const { container } = render(<BarChart {...barProps} />);
    expect(screen.queryByRole("list", { name: "Legend" })).toBeNull();
    expect(container.querySelectorAll(".chart-bar")).toHaveLength(1);
    expect(container.querySelector(".chart-value")).toHaveTextContent("1.2×");
    const table = screen.getByRole("table", { name: "Speedup" });
    expect(table).toHaveTextContent("GPT-2–");
  });

  it("mutes the categories that are not emphasized", () => {
    const { container } = render(
      <BarChart
        {...barProps}
        series={[{ id: "s", label: "x", values: [1, 2] }]}
        emphasis={["GPT-2"]}
      />,
    );
    const fills = [...container.querySelectorAll<SVGPathElement>(".chart-bar")].map(
      (p) => p.style.fill,
    );
    expect(fills).toEqual(["var(--text-3)", "var(--series-1)"]);
  });

  it("dims the other categories while one is active", () => {
    const { container } = render(
      <BarChart {...barProps} series={[{ id: "s", label: "x", values: [1, 2] }]} />,
    );
    fireEvent.focus(screen.getByRole("group", { name: /Speedup/ }));
    expect(container.querySelectorAll(".chart-bar.is-dimmed")).toHaveLength(1);
  });
});
