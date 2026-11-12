// Analytical table: sortable columns, data bars, status cells, group rows, total row, row click.

import { useMemo, useState, type ReactNode } from 'react';
import type { Status } from '../metrics';
import type { TableData } from './Visual';

export interface Col<T> {
  key: string; label: ReactNode; text?: string;
  value: (r: T) => number | string | null;
  render?: (r: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  bar?: boolean; status?: (r: T) => Status; width?: number; sortable?: boolean; wrap?: boolean;
  exportText?: (r: T) => string | number | null;
}

export interface Row<T> { id: string; data: T; group?: string }

export function Grid<T>({ columns, rows, total, onRowClick, selected, defaultSort, maxHeight, dense, caption, groups }: {
  columns: Col<T>[]; rows: Row<T>[]; total?: T; onRowClick?: (r: T) => void; selected?: (r: T) => boolean;
  defaultSort?: { key: string; dir: 'asc' | 'desc' }; maxHeight?: number; dense?: boolean; caption: string; groups?: boolean;
}) {
  const [sort, setSort] = useState(defaultSort);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const k = sort.dir === 'asc' ? 1 : -1;
    const cmp = (a: Row<T>, b: Row<T>) => {
      const va = col.value(a.data); const vb = col.value(b.data);
      if (va === null) return 1; if (vb === null) return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * k;
    };
    if (!groups) return [...rows].sort(cmp);
    const order: string[] = [];
    rows.forEach((r) => { if (!order.includes(r.group ?? '')) order.push(r.group ?? ''); });
    return order.flatMap((g) => rows.filter((r) => (r.group ?? '') === g).sort(cmp));
  }, [rows, sort, columns, groups]);
  const maxes = useMemo(() => Object.fromEntries(columns.filter((c) => c.bar).map((c) => [c.key, Math.max(1e-9, ...rows.map((r) => Math.abs(Number(c.value(r.data)) || 0)))])), [columns, rows]);
  const cell = (c: Col<T>, r: T) => {
    const content = c.render ? c.render(r) : c.value(r);
    const st = c.status?.(r);
    const inner = st ? <span className={`cell-status st-${st}`}>{content}</span> : content;
    if (c.bar) {
      const v = Math.abs(Number(c.value(r)) || 0);
      return <span className="bar-cell"><span className="databar" style={{ width: `${(100 * v) / maxes[c.key]}%` }} /><span className="bar-val">{inner}</span></span>;
    }
    return inner ?? '–';
  };
  let lastGroup: string | undefined;
  return (
    <div className={`grid-wrap ${dense ? 'dense' : ''}`} style={maxHeight ? { maxHeight } : undefined}>
      <table className="grid">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={c.key} className={`al-${c.align ?? (i === 0 ? 'left' : 'right')} ${i === 0 ? 'sticky-col' : ''}`} style={c.width ? { minWidth: c.width } : undefined}
                aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                {c.sortable === false ? c.label : (
                  <button type="button" className="th-btn" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 'desc' ? 'asc' : 'desc' }))}>
                    {c.label}<span className="sort-ind">{sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={columns.length} className="nodata-cell">No rows for the current filters.</td></tr>}
          {sorted.map((r) => {
            const head = groups && r.group !== lastGroup ? r.group : undefined;
            lastGroup = r.group;
            return [
              head !== undefined && <tr key={`g-${head}`} className="row-group"><td colSpan={columns.length}>{head}</td></tr>,
              <tr key={r.id} className={`${onRowClick ? 'clickable' : ''} ${selected?.(r.data) ? 'row-sel' : ''}`} onClick={onRowClick ? () => onRowClick(r.data) : undefined}>
                {columns.map((c, i) => <td key={c.key} className={`al-${c.align ?? (i === 0 ? 'left' : 'right')} ${i === 0 ? 'sticky-col' : ''} ${c.wrap ? 'wrap-cell' : ''}`}>{cell(c, r.data)}</td>)}
              </tr>,
            ];
          })}
        </tbody>
        {total && (
          <tfoot><tr>{columns.map((c, i) => <td key={c.key} className={`al-${c.align ?? (i === 0 ? 'left' : 'right')} ${i === 0 ? 'sticky-col' : ''}`}>{c.render ? c.render(total) : c.value(total) ?? ''}</td>)}</tr></tfoot>
        )}
      </table>
    </div>
  );
}

export function gridExport<T>(columns: Col<T>[], rows: Row<T>[], total?: T): TableData {
  const txt = (c: Col<T>, r: T) => (c.exportText ? c.exportText(r) : c.value(r));
  return {
    columns: columns.map((c) => c.text ?? (typeof c.label === 'string' ? c.label : c.key)),
    rows: [...rows.map((r) => columns.map((c) => txt(c, r.data))), ...(total ? [columns.map((c) => txt(c, total))] : [])],
  };
}
