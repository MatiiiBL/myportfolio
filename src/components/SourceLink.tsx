import type { ReactNode } from "react";
import { sourceUrl, type SourceTarget } from "./sourceUrl";
import "./ProjectPage.css";

interface SourceLinkProps extends SourceTarget {
  /** The link text; the path in the mono face by default. */
  children?: ReactNode;
}

/**
 * A link to a file, folder, heading or line range of a project's repository at the commit the
 * page's numbers come from. Pass the full SHA from the project's data/SOURCE.md:
 *
 *   const source = { repo: project.repo, commit: "5bc8ccf…(40 hex digits)" };
 *   <SourceLink {...source} file="docs/npu.md" anchor="4-timing" />
 *   <SourceLink {...source} file="rtl/npu/pe.sv" line={[12, 30]} />
 *   <SourceLink {...source} file="bench/results" dir />
 */
export function SourceLink({ children, ...target }: SourceLinkProps) {
  return (
    <a className="project-file" href={sourceUrl(target)}>
      {children ?? target.file}
    </a>
  );
}
