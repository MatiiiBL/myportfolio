interface MatrixTableProps {
  /** The matrix's name, also the caption's start: "A (M × K)". */
  caption: string;
  /** Row header prefix and column header prefix, e.g. "i" and "k". */
  rowName: string;
  colName: string;
  cells: (number | null)[][];
  /** Extra class for a cell, to show where it is in the pipeline. */
  cellClass?: (i: number, j: number) => string | undefined;
}

/** A small matrix as a real table, so its values read the same to a screen reader. */
export function MatrixTable({ caption, rowName, colName, cells, cellClass }: MatrixTableProps) {
  const cols = cells[0]?.length ?? 0;
  return (
    <table className="matrix">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <td />
          {Array.from({ length: cols }, (_, j) => (
            <th key={j} scope="col" aria-label={`${colName} ${j}`}>
              {j}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cells.map((row, i) => (
          <tr key={i}>
            <th scope="row" aria-label={`${rowName} ${i}`}>
              {i}
            </th>
            {row.map((v, j) => (
              <td key={j} className={cellClass?.(i, j)}>
                {v ?? "·"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
