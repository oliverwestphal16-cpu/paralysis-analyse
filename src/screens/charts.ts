import {
  gameSpan, pauseSummary, quantile, raceSeries, turnRecords, type Efficiency, type PlayerStats, type RadarAxis,
} from '../domain/stats';
import type { Game } from '../domain/types';
import { fmtClock, fmtNum } from '../lib/format';
import { chartTheme, type ChartOption } from '../ui/EChart';

const sec = (ms: number) => Math.round(ms / 100) / 10;

function axisStyle() {
  const t = chartTheme();
  return {
    axisLine: { lineStyle: { color: t.border } },
    axisLabel: { color: t.muted },
    splitLine: { lineStyle: { color: t.border, opacity: 0.5 } },
    nameTextStyle: { color: t.muted },
  };
}

function names(game: Game) {
  return Object.fromEntries(game.players.map((p) => [p.id, p]));
}

/** Single band over wall-clock time, coloured by the active player; pauses grey on top. */
export function timelineOption(game: Game, now: number): ChartOption {
  const by = names(game);
  const { start } = gameSpan(game, now);
  const t = chartTheme();
  const rect = (_params: unknown, api: any) => {
    const a = api.coord([api.value(0), 0]);
    const b = api.coord([api.value(1), 0]);
    const h = api.size([0, 1])[1] * 0.8;
    return { type: 'rect', shape: { x: a[0], y: a[1] - h / 2, width: Math.max(1, b[0] - a[0]), height: h }, style: { fill: api.visual('color') } };
  };
  return {
    grid: { left: 24, right: 32, top: 10, bottom: 56 },
    tooltip: {
      formatter: (p: any) => `${p.name}<br/>${fmtClock(p.value[0])} – ${fmtClock(p.value[1])} (${fmtClock(p.value[2])})`,
    },
    xAxis: { type: 'value', min: 0, max: gameSpan(game, now).end - start, axisLabel: { ...axisStyle().axisLabel, formatter: (v: number) => fmtClock(v) }, splitLine: axisStyle().splitLine, axisLine: axisStyle().axisLine },
    yAxis: { type: 'category', data: [''], show: false },
    dataZoom: [{ type: 'inside', filterMode: 'weakFilter' }, { type: 'slider', height: 18, bottom: 8, filterMode: 'weakFilter', labelFormatter: '' }],
    series: [
      {
        type: 'custom',
        renderItem: rect,
        encode: { x: [0, 1], y: 3 },
        data: turnRecords(game, now).map((r) => ({
          name: `${by[r.playerId].name} · Zug ${r.playerTurnNo}`,
          value: [r.start - start, r.end - start, r.net, 0],
          itemStyle: { color: by[r.playerId].color },
        })),
      },
      {
        type: 'custom',
        renderItem: rect,
        encode: { x: [0, 1], y: 3 },
        data: game.pauses.map((p) => ({
          name: `Pause (${p.category === 'rules' ? 'Regelklärung' : 'Sonstiges'})`,
          value: [p.start - start, (p.end ?? now) - start, (p.end ?? now) - p.start, 0],
          itemStyle: { color: t.pause },
        })),
      },
    ],
  };
}

/** One line per player: duration of the n-th own turn. */
export function lineOption(game: Game, now: number): ChartOption {
  const recs = turnRecords(game, now);
  const maxN = Math.max(0, ...recs.map((r) => r.playerTurnNo));
  return {
    grid: { left: 50, right: 16, top: 36, bottom: 30 },
    legend: { top: 0, textStyle: { color: chartTheme().text } },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmtClock(v * 1000) },
    xAxis: { type: 'category', name: 'Zug', data: Array.from({ length: maxN }, (_, i) => i + 1), ...axisStyle() },
    yAxis: { type: 'value', ...axisStyle(), axisLabel: { ...axisStyle().axisLabel, formatter: (v: number) => fmtClock(v * 1000) } },
    series: game.players.map((p) => ({
      name: p.name,
      type: 'line',
      smooth: 0.2,
      symbolSize: 7,
      color: p.color,
      data: recs.filter((r) => r.playerId === p.id).map((r) => sec(r.net)),
    })),
  };
}

/** Every turn as a bar in game order, coloured by player. */
export function barsOption(game: Game, now: number): ChartOption {
  const by = names(game);
  const recs = turnRecords(game, now);
  return {
    grid: { left: 50, right: 16, top: 16, bottom: 56 },
    tooltip: { trigger: 'item', formatter: (p: any) => `${p.name}<br/>${fmtClock(p.value * 1000)}` },
    xAxis: { type: 'category', data: recs.map((r) => r.index + 1), ...axisStyle() },
    yAxis: { type: 'value', ...axisStyle(), axisLabel: { ...axisStyle().axisLabel, formatter: (v: number) => fmtClock(v * 1000) } },
    dataZoom: recs.length > 40 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }] : [],
    series: [{
      type: 'bar',
      barCategoryGap: '15%',
      data: recs.map((r) => ({ name: `${by[r.playerId].name} · Zug ${r.playerTurnNo}`, value: sec(r.net), itemStyle: { color: by[r.playerId].color, borderRadius: [3, 3, 0, 0] } })),
    }],
  };
}

export function scatterOption(game: Game, stats: PlayerStats[], eff: Efficiency[]): ChartOption {
  const by = names(game);
  return {
    grid: { left: 50, right: 40, top: 34, bottom: 40 },
    tooltip: { formatter: (p: any) => `${p.name}<br/>${fmtClock(p.value[0] * 60000)} · ${fmtNum(p.value[1])} Punkte` },
    xAxis: { type: 'value', name: 'Zeit (min)', nameLocation: 'middle', nameGap: 26, scale: true, ...axisStyle() },
    yAxis: { type: 'value', name: 'Punkte', scale: true, ...axisStyle() },
    series: [{
      type: 'scatter',
      symbolSize: 22,
      label: { show: true, position: 'right', formatter: '{b}', color: chartTheme().text },
      data: eff.filter((e) => e.score !== undefined).map((e) => ({
        name: by[e.id].name,
        value: [stats.find((s) => s.id === e.id)!.adjusted / 60000, e.score],
        itemStyle: { color: by[e.id].color, borderColor: 'rgba(0,0,0,.4)' },
      })),
    }],
  };
}

function fmtAxis(v: number, f: RadarAxis['format']): string {
  if (f === 'time') return fmtClock(v);
  if (f === 'percent') return `${fmtNum(v * 100, 0)} %`;
  return fmtNum(v);
}

export function radarOption(game: Game, axes: RadarAxis[]): ChartOption {
  const t = chartTheme();
  return {
    legend: { bottom: 0, textStyle: { color: t.text } },
    tooltip: {
      formatter: (p: any) => {
        const id = game.players[p.dataIndex].id;
        return `<b>${p.name}</b><br/>` + axes.map((a) => `${a.label}: ${fmtAxis(a.raw[id], a.format)}`).join('<br/>');
      },
    },
    radar: {
      indicator: axes.map((a) => ({ name: a.label, min: 0, max: 1 })),
      radius: '62%',
      axisName: { color: t.text },
      splitLine: { lineStyle: { color: t.border } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: t.border } },
    },
    series: [{
      type: 'radar',
      data: game.players.map((p) => ({
        name: p.name,
        value: axes.map((a) => a.norm[p.id]),
        itemStyle: { color: p.color },
        lineStyle: { color: p.color, width: 2 },
        areaStyle: { color: p.color, opacity: 0.15 },
      })),
    }],
  };
}

export function boxplotOption(game: Game, stats: PlayerStats[]): ChartOption {
  return {
    grid: { left: 50, right: 16, top: 16, bottom: 30 },
    tooltip: {
      formatter: (p: any) => {
        const [, min, q1, med, q3, max] = p.value;
        return `<b>${p.name}</b><br/>Max ${fmtClock(max * 1000)}<br/>Q3 ${fmtClock(q3 * 1000)}<br/>Median ${fmtClock(med * 1000)}<br/>Q1 ${fmtClock(q1 * 1000)}<br/>Min ${fmtClock(min * 1000)}`;
      },
    },
    xAxis: { type: 'category', data: game.players.map((p) => p.name), ...axisStyle() },
    yAxis: { type: 'value', ...axisStyle(), axisLabel: { ...axisStyle().axisLabel, formatter: (v: number) => fmtClock(v * 1000) } },
    series: [{
      type: 'boxplot',
      data: stats.map((s, i) => {
        const d = [...s.durations].sort((a, b) => a - b);
        const color = game.players[i].color;
        return {
          name: game.players[i].name,
          value: [d[0] ?? 0, quantile(d, 0.25), quantile(d, 0.5), quantile(d, 0.75), d[d.length - 1] ?? 0].map(sec),
          itemStyle: { color: `${color}55`, borderColor: color, borderWidth: 2 },
        };
      }),
    }],
  };
}

export function pieOption(game: Game, stats: PlayerStats[], now: number): ChartOption {
  const t = chartTheme();
  const pauses = pauseSummary(game, now).total;
  return {
    tooltip: { formatter: (p: any) => `${p.name}: ${fmtClock(p.value)} (${fmtNum(p.percent, 1)} %)` },
    legend: { bottom: 0, textStyle: { color: t.text } },
    series: [{
      type: 'pie',
      radius: ['38%', '68%'],
      center: ['50%', '45%'],
      label: { color: t.text, formatter: '{d} %' },
      itemStyle: { borderColor: t.surface, borderWidth: 2 },
      data: [
        ...stats.map((s, i) => ({ name: game.players[i].name, value: s.raw, itemStyle: { color: game.players[i].color } })),
        ...(pauses > 0 ? [{ name: 'Pausen', value: pauses, itemStyle: { color: t.pause } }] : []),
      ],
    }],
  };
}

export function raceOption(game: Game, now: number): ChartOption {
  const race = raceSeries(game, now);
  const n = turnRecords(game, now).length;
  return {
    grid: { left: 56, right: 16, top: 36, bottom: 30 },
    legend: { top: 0, textStyle: { color: chartTheme().text } },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmtClock(v * 1000) },
    xAxis: { type: 'category', name: 'Zug', data: Array.from({ length: n }, (_, i) => i + 1), ...axisStyle() },
    yAxis: { type: 'value', ...axisStyle(), axisLabel: { ...axisStyle().axisLabel, formatter: (v: number) => fmtClock(v * 1000) } },
    series: game.players.map((p) => ({
      name: p.name, type: 'line', step: 'end', showSymbol: false, color: p.color, lineStyle: { width: 3 },
      data: race[p.id].map(sec),
    })),
  };
}
