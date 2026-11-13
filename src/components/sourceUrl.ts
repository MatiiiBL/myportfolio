/** Where in a repository a source link points. */
export interface SourceTarget {
  /** The repository's GitHub URL, e.g. a project's `repo` from src/content/projects.ts. */
  repo: string;
  /**
   * The full 40-character commit SHA the page's numbers come from (its data/SOURCE.md), so the
   * link keeps showing the code the page describes after the repository moves on.
   */
  commit: string;
  /** Path inside the repository, e.g. "rtl/npu/systolic_array.sv". */
  file: string;
  /** A heading anchor in a rendered Markdown file, e.g. "limitations". */
  anchor?: string;
  /** A line, or a [first, last] range of lines. */
  line?: number | readonly [number, number];
  /** Link the folder (GitHub's tree view) instead of a file. */
  dir?: boolean;
}

const FULL_SHA = /^[0-9a-f]{40}$/;

/**
 * The GitHub URL of a file, folder, heading or line range at a pinned commit. It refuses a
 * short or symbolic commit, because a branch name or an abbreviated SHA can later point
 * somewhere else; the prerender then fails instead of shipping a link that may drift.
 */
export function sourceUrl({ repo, commit, file, anchor, line, dir = false }: SourceTarget): string {
  if (!FULL_SHA.test(commit)) {
    throw new Error(`SourceLink needs a full 40-character commit SHA, got "${commit}"`);
  }
  if (anchor !== undefined && line !== undefined) {
    throw new Error(`SourceLink takes an anchor or a line, not both (${file})`);
  }
  const base = `${repo.replace(/\/+$/, "")}/${dir ? "tree" : "blob"}/${commit}/${file.replace(/^\/+/, "")}`;
  if (line !== undefined) {
    const [first, last] = typeof line === "number" ? [line, line] : line;
    // GitHub renders Markdown unless asked for the plain text, and line anchors only exist there.
    const plain = file.endsWith(".md") ? "?plain=1" : "";
    return `${base}${plain}#L${first}${last !== first ? `-L${last}` : ""}`;
  }
  return anchor ? `${base}#${anchor}` : base;
}
