import type { ChartTable } from "./types";

/**
 * The chart's numbers as a table, visually hidden: the screen-reader twin of the drawing. The
 * wrapper does the hiding because a table grows to fit its content whatever width it is given.
 */
export function DataTable({ title, table }: { title: string; table: ChartTable }) {
  const [rowHeader, ...valueHeaders] = table.columns;
  return (
    <div className="visually-hidden">
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{rowHeader}</th>
            {valueHeaders.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map(([head, ...cells], i) => (
            <tr key={`${head}-${i}`}>
              <th scope="row">{head}</th>
              {cells.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
