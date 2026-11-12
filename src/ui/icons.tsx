const PATHS: Record<string, string> = {
  chart: 'M3 13V9m3.5 4V5m3.5 8V7.5M13.5 13V3',
  filter: 'M2.5 3.5h11l-4.2 5v4l-2.6 1.2V8.5z',
  chevronLeft: 'M10 3 5 8l5 5',
  chevronRight: 'M6 3l5 5-5 5',
  chevronDown: 'M3 6l5 5 5-5',
  close: 'M4 4l8 8M12 4l-8 8',
  info: 'M8 7.2v4.3M8 4.6v.1M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z',
  table: 'M2.5 3.5h11v9h-11zM2.5 6.5h11M2.5 9.5h11M6.5 3.5v9',
  expand: 'M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9',
  download: 'M8 2.5v8m-3.5-3.5L8 10.5l3.5-3.5M3 13.5h10',
  share: 'M6 9.5 10 6m-4 1 4 3.5M4.5 10a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zm7-4.4a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zm0 9.4a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  print: 'M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z',
  note: 'M3.5 2.5h9v11h-9zM5.5 5.5h5M5.5 8h5M5.5 10.5h3',
  database: 'M8 2.5c3 0 5 .9 5 2s-2 2-5 2-5-.9-5-2 2-2 5-2zM3 4.5v7c0 1.1 2 2 5 2s5-.9 5-2v-7M3 8c0 1.1 2 2 5 2s5-.9 5-2',
  search: 'M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.3 10.3l3.2 3.2',
  warn: 'M8 2.5 14 13H2zM8 6.5v3M8 11.2v.1',
  back: 'M6.5 4 2.5 8l4 4M3 8h10.5',
  drill: 'M3 3.5h4v4H3zM9 8.5h4v4H9zM5 7.5v3h4',
  calendar: 'M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3',
  present: 'M2.5 3h11v7.5h-11zM8 10.5V13M5.5 13.5h5',
};

export function Icon({ name, size = 14 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
