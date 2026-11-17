import {
  PAUSE_LABELS, PHASES, gameSpan, mean, pauseSummary, phaseBounds, phaseOf, prepTimes, quantile, raceSeries,
  roundNumbers, turnRecords, type Efficiency, type Phase, type PlayerStats, type RadarAxis,
} from '../domain/stats';
import type { Game } from '../domain/types';
import { fmtClock, fmtNum } from '../lib/format';
import { chartTheme, type ChartOption } from '../ui/EChart';

const sec = (ms: number) => Math.round(ms / 100) / 10;
export const PREP_COLORS = { setup: '#8d6e4f', rules: '#b59a6e' };
const PREP_LABELS = { setup: 'Aufbau', rules: 'Regelerklärung' };
const BAND_COLORS = ['rgba(120,170,255,0.14)', 'rgba(255,255,255,0.0)', 'rgba(255,140,90,0.16)'];

function axisStyle() {
  const t = chartTheme();
  return {
    axisLine: { lineStyle: { color: t.border } },
    axisLabel: { color: t.muted },
    splitLine: { lineStyle: { color: t.border, opacity: 0.5 } },
    nameTextStyle: { color: t.muted },
  };
}

const timeAxis = () => ({ ...axisStyle(), axisLabel: { ...axisStyle().axisLabel, formatter: (v: number) => fmtClock(v * 1000) } });

function names(game: Game) {
  return Object.fromEntries(game.players.map((p) => [p.id, p]));
}

const SHORT: Record<Phase, string> = { early: 'Early', mid: 'Mid', late: 'Late' };

/** Background bands for the three phases on a category axis of global turn numbers ("1".."n"). */
function categoryBands(n: number) {
  if (n < 4) return undefined;
  const { earlyEnd, lateStart } = phaseBounds(n);
  const ranges: [Phase, number, number][] = [['early', 0, earlyEnd - 1], ['mid', earlyEnd, lateStart - 1], ['late', lateStart, n - 1]];
  return {
    silent: true,
    label: { color: chartTheme().muted, position: 'insideTop' },
    data: ranges.map(([p, a, b], i) => [
      { name: SHORT[p], xAxis: String(a + 1), itemStyle: { color: BAND_COLORS[i] } },
      { xAxis: String(b + 1) },
    ]),
  };
}

/** Single band over wall-clock time: preparation, turns coloured by player, pauses grey; phase bands behind. */
export function timelineOption(game: Game, now: number, showPrep: boolean): ChartOption {
  const by = names(game);
  const t = chartTheme();
  const recs = turnRecords(game, now);
  const prep = showPrep ? (game.prep ?? []) : [];
  const origin = prep[0]?.start ?? gameSpan(game, now).start;
  const end = gameSpan(game, now).end;
  // Bars sit in the lower part of the row so the phase labels above them stay readable.
  const rect = (_params: unknown, api: any) => {
    const a = api.coord([api.value(0), 0]);
    const b = api.coord([api.value(1), 0]);
    const full = api.size([0, 1])[1];
    const h = full * 0.62;
    return { type: 'rect', shape: { x: a[0], y: a[1] - full / 2 + full * 0.3, width: Math.max(1, b[0] - a[0]), height: h }, style: { fill: api.visual('color') } };
  };
  const { earlyEnd, lateStart } = phaseBounds(recs.length);
  const at = (i: number) => (recs[i] ? recs[i].start - origin : end - origin);
  const bands = recs.length >= 4 ? {
    silent: true,
    label: { color: t.muted, position: 'insideTop', fontSize: 11 },
    data: [[0, earlyEnd, 'early'], [earlyEnd, lateStart, 'mid'], [lateStart, recs.length, 'late']].map(([a, b, p], i) => [
      { name: SHORT[p as Phase], xAxis: at(a as number), itemStyle: { color: BAND_COLORS[i] } },
      { xAxis: (b as number) >= recs.length ? end - origin : at(b as number) },
    ]),
  } : undefined;
  return {
    grid: { left: 24, right: 32, top: 8, bottom: 56 },
    tooltip: {
      formatter: (p: any) => p.componentType === 'markArea' ? '' : `${p.name}<br/>${fmtClock(p.value[0])} – ${fmtClock(p.value[1])} (${fmtClock(p.value[2])})`,
    },
    xAxis: { type: 'value', min: 0, max: end - origin, axisLabel: { ...axisStyle().axisLabel, formatter: (v: number) => fmtClock(v) }, splitLine: axisStyle().splitLine, axisLine: axisStyle().axisLine },
    yAxis: { type: 'category', data: [''], show: false },
    dataZoom: [{ type: 'inside', filterMode: 'weakFilter' }, { type: 'slider', height: 18, bottom: 8, filterMode: 'weakFilter', labelFormatter: '' }],
    series: [
      {
        type: 'custom',
        renderItem: rect,
        encode: { x: [0, 1], y: 3 },
        markArea: bands,
        data: [
          ...prep.map((ph) => ({
            name: PREP_LABELS[ph.kind],
            value: [ph.start - origin, (ph.end ?? now) - origin, (ph.end ?? now) - ph.start, 0],
            itemStyle: { color: PREP_COLORS[ph.kind] },
          })),
          ...recs.map((r) => ({
            name: `${by[r.playerId].name} · Zug ${r.playerTurnNo}`,
            value: [r.start - origin, r.end - origin, r.net, 0],
            itemStyle: { color: by[r.playerId].color },
          })),
        ],
      },
      {
        type: 'custom',
        renderItem: rect,
        encode: { x: [0, 1], y: 3 },
        data: game.pauses.filter((p) => (p.end ?? now) > origin).map((p) => ({
          name: `Pause (${PAUSE_LABELS[p.category]})`,
          value: [Math.max(0, p.start - origin), (p.end ?? now) - origin, (p.end ?? now) - p.start, 0],
          itemStyle: { color: t.pause },
        })),
      },
    ],
  };
}

/** One line per player over the global turn number (gaps bridged), so phases line up. */
export function lineOption(game: Game, now: number): ChartOption {
  const recs = turnRecords(game, now);
  const cats = recs.map((r) => String(r.index + 1));
  return {
    grid: { left: 50, right: 16, top: 36, bottom: 30 },
    legend: { top: 0, textStyle: { color: chartTheme().text } },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v == null ? '–' : fmtClock(v * 1000)) },
    xAxis: { type: 'category', name: 'Zug', data: cats, ...axisStyle() },
    yAxis: { type: 'value', ...timeAxis() },
    series: game.players.map((p, i) => ({
      name: p.name,
      type: 'line',
      smooth: 0.2,
      symbolSize: 7,
      connectNulls: true,
      color: p.color,
      markArea: i === 0 ? categoryBands(recs.length) : undefined,
      data: recs.map((r) => (r.playerId === p.id ? sec(r.net) : null)),
    })),
  };
}

/** Every turn as a bar in game order, coloured by player; phase bands and round separators. */
export function barsOption(game: Game, now: number): ChartOption {
  const by = names(game);
  const recs = turnRecords(game, now);
  const rounds = roundNumbers(game);
  const roundStarts = rounds.map((r, i) => (i > 0 && r !== rounds[i - 1] ? i : -1)).filter((i) => i > 0);
  const t = chartTheme();
  return {
    grid: { left: 50, right: 16, top: 22, bottom: 56 },
    tooltip: { trigger: 'item', formatter: (p: any) => (p.componentType === 'series' ? `${p.name}<br/>Runde ${rounds[p.dataIndex]}<br/>${fmtClock(p.value * 1000)}` : '') },
    xAxis: { type: 'category', data: recs.map((r) => String(r.index + 1)), ...axisStyle() },
    yAxis: { type: 'value', ...timeAxis() },
    dataZoom: recs.length > 40 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }] : [],
    series: [{
      type: 'bar',
      barCategoryGap: '15%',
      markArea: categoryBands(recs.length),
      markLine: roundStarts.length ? {
        silent: true, symbol: 'none', label: { show: false },
        lineStyle: { color: t.muted, type: 'dotted', opacity: 0.6 },
        // Place the separator between the last turn of a round and the first of the next.
        data: roundStarts.map((i) => ({ xAxis: i - 0.5 })),
      } : undefined,
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
    yAxis: { type: 'value', ...timeAxis() },
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

/** Share of time: players, plus pauses and (optionally) preparation. */
export function pieOption(game: Game, stats: PlayerStats[], extra: { name: string; value: number; color: string }[]): ChartOption {
  const t = chartTheme();
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
        ...extra.filter((e) => e.value > 0).map((e) => ({ name: e.name, value: e.value, itemStyle: { color: e.color } })),
      ],
    }],
  };
}

/** Extra pie segments for the whole game: pauses and preparation. */
export function pieExtras(game: Game, now: number, showPrep: boolean) {
  const t = chartTheme();
  const prep = prepTimes(game, now);
  const pausesInPlay = pauseSummary(game, now, gameSpan(game, now)).total;
  const pausesAll = pauseSummary(game, now).total;
  return [
    { name: 'Pausen', value: showPrep ? pausesAll : pausesInPlay, color: t.pause },
    ...(showPrep ? [
      { name: 'Aufbau', value: prep.setup ?? 0, color: PREP_COLORS.setup },
      { name: 'Regelerklärung', value: prep.rules ?? 0, color: PREP_COLORS.rules },
    ] : []),
  ];
}

export function raceOption(game: Game, now: number): ChartOption {
  const race = raceSeries(game, now);
  const n = turnRecords(game, now).length;
  return {
    grid: { left: 56, right: 16, top: 36, bottom: 30 },
    legend: { top: 0, textStyle: { color: chartTheme().text } },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => fmtClock(v * 1000) },
    xAxis: { type: 'category', name: 'Zug', data: Array.from({ length: n }, (_, i) => String(i + 1)), ...axisStyle() },
    yAxis: { type: 'value', ...timeAxis() },
    series: game.players.map((p, i) => ({
      name: p.name, type: 'line', step: 'end', showSymbol: false, color: p.color, lineStyle: { width: 3 },
      markArea: i === 0 ? categoryBands(n) : undefined,
      data: race[p.id].map(sec),
    })),
  };
}

/** Mean turn per player in each phase, grouped by phase. */
export function phaseBarsOption(game: Game, now: number): ChartOption {
  const recs = turnRecords(game, now);
  return {
    grid: { left: 50, right: 16, top: 36, bottom: 30 },
    legend: { top: 0, textStyle: { color: chartTheme().text } },
    tooltip: { trigger: 'axis', valueFormatter: (v: number) => (v == null ? '–' : fmtClock(v * 1000)) },
    xAxis: { type: 'category', data: PHASES.map((p) => p.label), ...axisStyle() },
    yAxis: { type: 'value', ...timeAxis() },
    series: game.players.map((p) => ({
      name: p.name,
      type: 'bar',
      color: p.color,
      itemStyle: { borderRadius: [3, 3, 0, 0] },
      data: PHASES.map(({ key }) => {
        const d = recs.filter((r) => r.playerId === p.id && phaseOf(r.index, recs.length) === key).map((r) => r.net);
        return d.length ? sec(mean(d)) : null;
      }),
    })),
  };
}
