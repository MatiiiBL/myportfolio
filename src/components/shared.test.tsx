import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceLink } from "./SourceLink";
import { TableRegion } from "./TableRegion";
import { sourceUrl } from "./sourceUrl";

const repo = "https://github.com/MatiiiBL/riscv-npu-soc";
const commit = "5bc8ccf0123456789abcdef0123456789abcdef0";

describe("sourceUrl", () => {
  it("links a file, a folder and a heading at the pinned commit", () => {
    expect(sourceUrl({ repo, commit, file: "rtl/npu/pe.sv" })).toBe(
      `${repo}/blob/${commit}/rtl/npu/pe.sv`,
    );
    expect(sourceUrl({ repo: `${repo}/`, commit, file: "bench/results", dir: true })).toBe(
      `${repo}/tree/${commit}/bench/results`,
    );
    expect(sourceUrl({ repo, commit, file: "README.md", anchor: "limitations" })).toBe(
      `${repo}/blob/${commit}/README.md#limitations`,
    );
  });

  it("links a line or a range, in the plain view for Markdown", () => {
    expect(sourceUrl({ repo, commit, file: "src/a.cpp", line: 42 })).toBe(
      `${repo}/blob/${commit}/src/a.cpp#L42`,
    );
    expect(sourceUrl({ repo, commit, file: "src/a.cpp", line: [12, 30] })).toBe(
      `${repo}/blob/${commit}/src/a.cpp#L12-L30`,
    );
    expect(sourceUrl({ repo, commit, file: "docs/npu.md", line: [3, 9] })).toBe(
      `${repo}/blob/${commit}/docs/npu.md?plain=1#L3-L9`,
    );
  });

  it("refuses a short or symbolic commit, and an anchor together with a line", () => {
    expect(() => sourceUrl({ repo, commit: "5bc8ccf", file: "a" })).toThrow(/40-character/);
    expect(() => sourceUrl({ repo, commit: "main", file: "a" })).toThrow(/40-character/);
    expect(() => sourceUrl({ repo, commit, file: "a.md", anchor: "x", line: 1 })).toThrow(
      /not both/,
    );
  });
});

describe("SourceLink", () => {
  it("shows the path in the mono style unless given other text", () => {
    render(
      <>
        <SourceLink repo={repo} commit={commit} file="rtl/npu/pe.sv" />
        <SourceLink repo={repo} commit={commit} file="docs/npu.md" anchor="timing">
          the timing notes
        </SourceLink>
      </>,
    );
    const file = screen.getByRole("link", { name: "rtl/npu/pe.sv" });
    expect(file).toHaveClass("project-file");
    expect(file).toHaveAttribute("href", `${repo}/blob/${commit}/rtl/npu/pe.sv`);
    expect(screen.getByRole("link", { name: "the timing notes" })).toHaveAttribute(
      "href",
      `${repo}/blob/${commit}/docs/npu.md#timing`,
    );
  });
});

describe("TableRegion", () => {
  it("is a named region that keyboards can focus to scroll", () => {
    render(
      <TableRegion label="Baseline results">
        <table>
          <tbody>
            <tr>
              <td>1</td>
            </tr>
          </tbody>
        </table>
      </TableRegion>,
    );
    const region = screen.getByRole("region", { name: "Baseline results" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("project-table-wrap");
    expect(region.querySelector("table")).not.toBeNull();
  });
});
