import { describe, expect, it } from "vitest";
import { minorProjects, projects } from "./projects";
import { projectPages } from "../projects/registry";

describe("content", () => {
  it("gives every flagship project a page and a unique slug", () => {
    const slugs = projects.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(Object.keys(projectPages).sort()).toEqual([...slugs].sort());
  });

  it("links every project to its GitHub repository", () => {
    for (const p of [...projects, ...minorProjects]) {
      expect(p.repo).toMatch(/^https:\/\/github\.com\/[\w-]+\/[\w.-]+$/);
    }
  });

  it("keeps cards within their layout limits", () => {
    for (const p of projects) {
      expect(p.tags.length).toBeLessThanOrEqual(6);
      for (const stat of p.stats) expect(stat.value.length).toBeLessThanOrEqual(7);
    }
  });
});
