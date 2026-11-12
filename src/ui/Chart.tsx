import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, CanvasRenderer]);

/** ECharts wrapper. onClick receives the category index and the series name. */
export function Chart({ option, height, onClick, ariaLabel }: { option: EChartsOption; height: number; onClick?: (index: number, seriesName: string) => void; ariaLabel: string }) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<echarts.ECharts | null>(null);
  const click = useRef(onClick);
  click.current = onClick;

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: 'canvas' });
    inst.current = c;
    c.on('click', (p) => { if (click.current && typeof p.dataIndex === 'number') click.current(p.dataIndex, String(p.seriesName ?? '')); });
    // Clicking anywhere in the plot band of a category also counts (easier targets for small bars).
    c.getZr().on('click', (e) => {
      if (!click.current || e.target) return;
      const pt = [e.offsetX, e.offsetY];
      if (!c.containPixel('grid', pt)) return;
      const opt = c.getOption() as { yAxis?: { type?: string }[] };
      const horizontal = opt.yAxis?.[0]?.type === 'category';
      const v = c.convertFromPixel('grid', pt) as number[];
      const i = Math.round(horizontal ? v[1] : v[0]);
      if (Number.isFinite(i) && i >= 0) click.current(i, '');
    });
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => { ro.disconnect(); c.dispose(); inst.current = null; };
  }, []);

  useEffect(() => { inst.current?.setOption(option, true); }, [option]);

  return <div ref={el} className={`chart ${onClick ? 'clickable' : ''}`} style={{ height }} role="img" aria-label={ariaLabel} />;
}
