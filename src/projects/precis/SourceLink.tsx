const REPO = "https://github.com/MatiiiBL/precis";
// The commit the page's numbers come from (data/SOURCE.md).
const COMMIT = "f2ee462";

/** A link to a file of the Précis repository, at that commit. */
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
