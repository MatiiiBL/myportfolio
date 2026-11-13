const REPO = "https://github.com/MatiiiBL/tessera";
// The commit the page's numbers and code excerpts come from (data/SOURCE.md).
const COMMIT = "9eda498";

/** A link to a file of the Tessera repository, at that commit. */
export function SourceLink({ file, anchor }: { file: string; anchor?: string }) {
  return (
    <a
      className="project-file"
      href={`${REPO}/blob/${COMMIT}/${file}${anchor ? `#${anchor}` : ""}`}
    >
      {file}
    </a>
  );
}
