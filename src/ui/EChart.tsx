import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, BoxplotChart, CustomChart, LineChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts';
import {
  DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, RadarComponent, TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart, BoxplotChart, CustomChart, LineChart, PieChart, RadarChart, ScatterChart,
  DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, RadarComponent, TooltipComponent,
  SVGRenderer,
]);

export type ChartOption = echarts.EChartsCoreOption;

/** Reads the current theme tokens so charts follow light/dark mode. */
export function chartTheme() {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(n).trim();
  return { text: v('--text'), muted: v('--muted'), border: v('--border'), surface: v('--surface'), pause: v('--pause') };
}

export function EChart({ option, height = 300 }: { option: ChartOption; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts>();

  useEffect(() => {
    if (!el.current) return;
    const c = echarts.init(el.current, undefined, { renderer: 'svg' });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      c.dispose();
    };
  }, []);

  useEffect(() => {
    const t = chartTheme();
    chart.current?.setOption(
      {
        backgroundColor: 'transparent',
        textStyle: { color: t.text },
        tooltip: { backgroundColor: t.surface, borderColor: t.border, textStyle: { color: t.text } },
        ...option,
      },
      true,
    );
  }, [option]);

  return <div ref={el} style={{ width: '100%', height }} />;
}
