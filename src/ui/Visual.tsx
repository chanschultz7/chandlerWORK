// Standard frame for every chart and table: title, subtitle, actions, definition, show-as-table,
// focus mode and CSV export.

import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../state';
import { InfoIcon } from './common';
import { Icon } from './icons';

export interface TableData { columns: string[]; rows: (string | number | null)[][] }

export function downloadCsv(name: string, t: TableData) {
  const esc = (v: string | number | null) => { const s = v === null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [t.columns, ...t.rows].map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${name.replace(/[^\w]+/g, '_').toLowerCase()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function Visual({ title, subtitle, metricId, table, actions, noData, className, children }: {
  title: string; subtitle?: ReactNode; metricId?: string; table?: TableData; actions?: ReactNode; noData?: string | null; className?: string; children: ReactNode;
}) {
  const { toast } = useApp();
  const [focus, setFocus] = useState(false);
  const [asTable, setAsTable] = useState(false);
  useEffect(() => {
    if (!focus) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocus(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [focus]);
  return (
    <>
      {focus && <div className="focus-backdrop" onClick={() => setFocus(false)} />}
      <section className={`visual ${focus ? 'visual-focus' : ''} ${className ?? ''}`} aria-label={title}>
        <div className="visual-head">
          <div className="visual-titles">
            <h3>{title}{metricId && <InfoIcon id={metricId} />}</h3>
            {subtitle && <div className="visual-sub">{subtitle}</div>}
          </div>
          <div className="visual-tools no-print">
            {actions}
            {table && <button type="button" className={`icon-btn ${asTable ? 'on' : ''}`} title={asTable ? 'Show visual' : 'Show as table'} onClick={() => setAsTable((x) => !x)}><Icon name="table" size={13} /></button>}
            {table && <button type="button" className="icon-btn" title="Export data (CSV)" onClick={() => { downloadCsv(title, table); toast(`Exported "${title}"`); }}><Icon name="download" size={13} /></button>}
            <button type="button" className={`icon-btn ${focus ? 'on' : ''}`} title={focus ? 'Exit focus mode (Esc)' : 'Focus mode'} onClick={() => setFocus((x) => !x)}><Icon name="expand" size={13} /></button>
          </div>
        </div>
        <div className="visual-body">
          {noData ? <div className="state state-empty">{noData}</div> : asTable && table ? <TableView t={table} /> : children}
        </div>
      </section>
    </>
  );
}

function TableView({ t }: { t: TableData }) {
  return (
    <div className="tableview">
      <table className="grid compact">
        <thead><tr>{t.columns.map((c, i) => <th key={i} className={i === 0 ? 'al-left' : ''}>{c}</th>)}</tr></thead>
        <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={j === 0 ? 'al-left' : ''}>{v ?? '–'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
