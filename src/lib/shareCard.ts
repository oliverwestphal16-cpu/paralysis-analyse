import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Award } from '../domain/awards';
import type { PlayerStats } from '../domain/stats';
import type { Game, GamePlayer } from '../domain/types';
import { Meeple } from '../ui/avatars';
import { fmtClock, fmtDate, fmtDur, fmtNum } from './format';

const W = 1080;
const H = 1350;
const C = { bg: '#1b1612', surface: '#2a221c', text: '#f3ece2', muted: '#b5a797', gold: '#e2b23a', silver: '#b9c0c8', bronze: '#c27c46' };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Photo or meeple as an image element. */
async function avatarImage(p: GamePlayer): Promise<HTMLImageElement> {
  if (p.photo) return loadImage(p.photo);
  const svg = renderToStaticMarkup(createElement(Meeple, { avatar: p.avatar, color: p.color, size: 256 }))
    .replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function drawAvatar(ctx: CanvasRenderingContext2D, img: HTMLImageElement, p: GamePlayer, x: number, y: number, size: number) {
  if (p.photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
    ctx.lineWidth = 8;
    ctx.strokeStyle = p.color;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.drawImage(img, x, y, size, size);
  }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

export interface ShareCardInput {
  game: Game;
  rank: PlayerStats[];
  awards: Award[];
  durationLine: string;
  /** Overall rating 1..10, shown as stars under the title. */
  rating?: number;
}

function fmtAward(a: Award): string {
  if (a.format === 'time') return fmtClock(a.value);
  if (a.format === 'percent') return `${fmtNum(a.value * 100, 0)} %`;
  return fmtNum(a.value);
}

/** Renders the 1080×1350 summary card as a PNG blob. */
export async function renderShareCard({ game, rank, awards, durationLine, rating }: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const font = (px: number, weight = 400) => `${weight} ${px}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  const by = Object.fromEntries(game.players.map((p) => [p.id, p]));
  const imgs = Object.fromEntries(await Promise.all(game.players.map(async (p) => [p.id, await avatarImage(p)] as const)));

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.textAlign = 'center';
  ctx.fillStyle = C.text;
  ctx.font = font(64, 800);
  ctx.fillText(fitText(ctx, game.title || 'Partie', W - 120), W / 2, 110);
  ctx.fillStyle = C.muted;
  ctx.font = font(32);
  ctx.fillText(fmtDate(game.createdAt), W / 2, 160);
  ctx.fillText(fitText(ctx, durationLine, W - 120), W / 2, 205);

  if (rating !== undefined) {
    // Five stars, filled in half steps (1..10 → 0.5..5 stars), plus the number.
    const size = 40;
    const x0 = W / 2 - (5 * size + 4 * 8 + 90) / 2;
    ctx.font = font(size);
    ctx.textAlign = 'left';
    for (let i = 0; i < 5; i++) {
      const x = x0 + i * (size + 8);
      const fill = Math.min(1, Math.max(0, rating / 2 - i));
      ctx.fillStyle = '#4a3d32';
      ctx.fillText('★', x, 262);
      if (fill > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, 262 - size, size * fill, size + 10);
        ctx.clip();
        ctx.fillStyle = C.gold;
        ctx.fillText('★', x, 262);
        ctx.restore();
      }
    }
    ctx.fillStyle = C.gold;
    ctx.font = font(36, 800);
    ctx.fillText(rating.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), x0 + 5 * (size + 8) + 6, 260);
    ctx.textAlign = 'center';
  }

  // Podium (2 – 1 – 3)
  const slots = [
    { s: rank[1], place: 2, h: 190, color: C.silver },
    { s: rank[0], place: 1, h: 260, color: C.gold },
    { s: rank[2], place: 3, h: 140, color: C.bronze },
  ];
  const baseY = 800;
  const bw = 280;
  slots.forEach(({ s, place, h, color }, i) => {
    if (!s) return;
    const x = 80 + i * (bw + 20);
    const p = by[s.id];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, baseY - h, bw, h, [16, 16, 0, 0]);
    ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.font = font(72, 800);
    ctx.fillText(String(place), x + bw / 2, baseY - h + 80);
    const size = place === 1 ? 170 : 140;
    drawAvatar(ctx, imgs[s.id], p, x + bw / 2 - size / 2, baseY - h - size - 90, size);
    ctx.fillStyle = C.text;
    ctx.font = font(36, 700);
    ctx.fillText(fitText(ctx, p.name, bw), x + bw / 2, baseY - h - 48);
    ctx.fillStyle = C.muted;
    ctx.font = font(32);
    ctx.fillText(fmtClock(s.adjusted), x + bw / 2, baseY - h - 12);
  });

  // Titles and scores
  ctx.textAlign = 'left';
  let y = 870;
  ctx.fillStyle = C.gold;
  ctx.font = font(36, 800);
  ctx.fillText('Titel', 80, y);
  if (game.scores) ctx.fillText('Punkte', 720, y);
  ctx.font = font(30);
  y += 52;
  for (const a of awards.slice(0, 8)) {
    ctx.fillStyle = C.text;
    ctx.font = font(30, 700);
    ctx.fillText(a.title, 80, y);
    ctx.fillStyle = C.muted;
    ctx.font = font(30);
    ctx.fillText(fitText(ctx, `${a.playerIds.map((id) => by[id].name).join(', ')} · ${fmtAward(a)}`, 360), 330, y);
    y += 50;
  }
  if (game.scores) {
    let sy = 922;
    [...game.players].sort((a, b) => (game.scores![b.id] ?? 0) - (game.scores![a.id] ?? 0)).forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(732, sy - 10, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.font = font(30);
      ctx.fillText(fitText(ctx, p.name, 180), 756, sy);
      ctx.textAlign = 'right';
      ctx.fillText(fmtNum(game.scores![p.id] ?? 0), W - 80, sy);
      ctx.textAlign = 'left';
      sy += 50;
    });
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = C.muted;
  ctx.font = font(26);
  ctx.fillText(`ParalysisAnalyse · ${fmtDur(rank.reduce((a, s) => a + s.raw, 0))} reine Zugzeit`, W / 2, H - 50);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden'))), 'image/png'));
}
