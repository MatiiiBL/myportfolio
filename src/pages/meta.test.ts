import { describe, expect, it } from "vitest";
import { projects } from "../content/projects";
import { absoluteUrl, metaFor, notFoundMeta, routePaths, sentenceTail } from "./meta";

describe("route metadata", () => {
  it("lists the home page and every project page, with a trailing slash", () => {
    expect(routePaths).toEqual(["/", ...projects.map((p) => `/projects/${p.slug}/`)]);
  });

  it("describes each project page from its content", () => {
    for (const p of projects) {
      for (const path of [`/projects/${p.slug}`, `/projects/${p.slug}/`]) {
        const meta = metaFor(path);
        expect(meta.title.startsWith(`${p.name}: `)).toBe(true);
        expect(meta.description).toBe(p.summary);
        expect(meta.path).toBe(`/projects/${p.slug}/`);
      }
    }
  });

  it("treats unknown paths as not found", () => {
    expect(metaFor("/projects/nope/")).toBe(notFoundMeta);
    expect(metaFor("/about")).toBe(notFoundMeta);
    expect(metaFor("/")).not.toBe(notFoundMeta);
  });

  it("builds public URLs under the site's base path", () => {
    expect(absoluteUrl("/")).toBe("https://matiiibl.github.io/myportfolio/");
    expect(absoluteUrl("/projects/pulse/")).toBe(
      "https://matiiibl.github.io/myportfolio/projects/pulse/",
    );
  });

  it("lowercases a tagline after a colon unless it starts with an acronym", () => {
    expect(sentenceTail("A tensor compiler for Apple silicon.")).toBe(
      "a tensor compiler for Apple silicon",
    );
    expect(sentenceTail("HNSW vector search.")).toBe("HNSW vector search");
  });
});
