// Renderizadores de SVG na identidade Junonn (mesmos tokens do junonn.com.br).
// As fontes vão embutidas em base64: um SVG servido como <img> não carrega recursos externos.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const theme = {
  bg: '#071226',
  panel: '#101f38',
  primary: '#39a5ff',
  neon: '#68d8ff',
  text: '#f3f8ff',
  soft: 'rgba(243,248,255,.64)',
  line: 'rgba(104,216,255,.16)',
  ok: '#3ee38a',
};

const fontsDir = fileURLToPath(new URL('../../assets/fonts/', import.meta.url));
const fontCache = new Map();

function font(file) {
  if (!fontCache.has(file)) fontCache.set(file, readFileSync(fontsDir + file).toString('base64'));
  return fontCache.get(file);
}

// Só embute as fontes que o SVG usa, para manter cada arquivo leve.
function fontFaces({ sora400 = true, sora800 = true, mono400 = true, mono700 = false } = {}) {
  const faces = [
    sora800 && ['S', 800, 'sora-800.woff2'],
    sora400 && ['S', 400, 'sora-400.woff2'],
    mono400 && ['M', 400, 'jetbrains-mono-400.woff2'],
    mono700 && ['M', 700, 'jetbrains-mono-700.woff2'],
  ].filter(Boolean);
  return faces
    .map(([fam, w, file]) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${font(file)}) format('woff2')}`)
    .join('');
}

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Cores do linguist para as linguagens que aparecem nos seus repos; o resto cai no neon.
const LANG_COLORS = {
  'C#': '#178600', TypeScript: '#3178c6', JavaScript: '#f1e05a', Vue: '#41b883', 'C++': '#f34b7d',
  Java: '#b07219', PHP: '#4F5D95', HCL: '#844FBA', PowerShell: '#012456', CSS: '#663399',
  Python: '#3572A5', Go: '#00ADD8', Dart: '#00B4AB', SCSS: '#c6538c',
};
export const langColor = (lang) => LANG_COLORS[lang] ?? theme.neon;

export function relativeTime(iso, now = new Date()) {
  if (!iso) return 'sem atividade pública';
  const days = Math.floor((now - new Date(iso)) / 86_400_000);
  if (days <= 0) return 'atualizado hoje';
  if (days === 1) return 'atualizado ontem';
  if (days < 14) return `atualizado há ${days} dias`;
  if (days < 60) return `atualizado há ${Math.round(days / 7)} semanas`;
  if (days < 365) return `atualizado há ${Math.round(days / 30)} meses`;
  const years = Math.round(days / 365);
  return `atualizado há ${years} ano${years > 1 ? 's' : ''}`;
}

function wrap(text, maxChars, maxLines) {
  const lines = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

const frame = (w, h, body, style = '', fonts) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">
<style>${fontFaces(fonts)}${style}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<defs><pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="rgba(104,216,255,.06)"/></pattern>
<linearGradient id="hl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${theme.primary}"/><stop offset="1" stop-color="${theme.neon}"/></linearGradient></defs>
<rect width="${w}" height="${h}" rx="16" fill="${theme.bg}"/><rect width="${w}" height="${h}" rx="16" fill="url(#grid)"/>
${body}
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="15.5" fill="none" stroke="${theme.neon}" stroke-opacity=".2"/>
</svg>`;

// ---------- card de projeto ----------
export function projectCard(project, live, now = new Date()) {
  const W = 590, H = 214, PAD = 26;
  const desc = wrap(project.description, 66, 2);
  const lang = live.mainLanguage;

  let x = PAD;
  const chips = [];
  const room = W - PAD;
  const tech = [...project.tech];
  while (tech.length) {
    const t = tech[0];
    const w = t.length * 7.2 + 22;
    const remaining = tech.length - 1;
    const plusW = remaining ? `+${remaining}`.length * 7.2 + 22 + 6 : 0;
    if (x + w + plusW > room) {
      chips.push(chip(`+${tech.length}`, x, true));
      break;
    }
    chips.push(chip(t, x));
    x += w + 6;
    tech.shift();
  }
  function chip(label, cx, ghost = false) {
    const w = label.length * 7.2 + 22;
    return `<rect x="${cx}" y="134" width="${w}" height="26" rx="13" fill="${ghost ? 'none' : theme.panel}" stroke="${theme.line}"/>
<text x="${cx + w / 2}" y="151.5" text-anchor="middle" font-family="M" font-size="12" fill="${ghost ? theme.soft : theme.text}">${esc(label)}</text>`;
  }

  const footer = [];
  if (project.status) footer.push(`<tspan fill="${theme.ok}">●</tspan> ${esc(project.status)}`);
  if (lang) footer.push(`<tspan fill="${langColor(lang)}">●</tspan> ${esc(lang)}`);
  if (live.repoCount > 1) footer.push(`${live.repoCount} repositórios`);
  if (live.stars > 0) footer.push(`★ ${live.stars}`);
  if (live.repoCount > 0) footer.push(esc(relativeTime(live.pushedAt, now)));
  else if (!project.status) footer.push('repositório privado');

  const body = `
<rect x="0" y="22" width="3" height="40" rx="1.5" fill="url(#hl)"/>
<text x="${PAD}" y="38" font-family="M" font-size="12" fill="${theme.neon}">${esc(project.kicker)}</text>
<text x="${W - PAD}" y="38" text-anchor="end" font-family="M" font-size="13" fill="${theme.soft}">↗</text>
<text x="${PAD}" y="70" font-family="S" font-weight="800" font-size="23" letter-spacing="-.4" fill="${theme.text}">${esc(project.title)}</text>
${desc.map((l, i) => `<text x="${PAD}" y="${98 + i * 20}" font-family="S" font-size="13.5" fill="${theme.soft}">${esc(l)}</text>`).join('\n')}
${chips.join('\n')}
<path d="M${PAD} 176H${W - PAD}" stroke="${theme.line}"/>
<text x="${PAD}" y="199" font-family="M" font-size="12" fill="${theme.soft}">${footer.join('  ·  ')}</text>`;
  return frame(W, H, body, '', { mono700: false });
}

// ---------- linguagens ----------
export function languagesCard(langs, { repoCount, orgCount }) {
  const W = 1200, H = 196, PAD = 40, BAR_Y = 76, BAR_W = W - PAD * 2;
  const total = langs.reduce((s, l) => s + l.bytes, 0) || 1;
  let x = PAD;
  const segs = langs.map((l, i) => {
    const w = Math.max((l.bytes / total) * BAR_W, 3);
    const seg = `<rect class="seg" style="animation-delay:${i * 0.08}s" x="${x}" y="${BAR_Y}" width="${w}" height="14" fill="${langColor(l.name)}"/>`;
    x += w;
    return seg;
  });
  const colW = BAR_W / Math.min(langs.length, 7);
  const legend = langs.map((l, i) => {
    const lx = PAD + i * colW;
    return `<circle cx="${lx + 6}" cy="${128}" r="5" fill="${langColor(l.name)}"/>
<text x="${lx + 18}" y="${133}" font-family="S" font-weight="800" font-size="14" fill="${theme.text}">${esc(l.name)}</text>
<text x="${lx + 18}" y="${154}" font-family="M" font-size="12" fill="${theme.soft}">${((l.bytes / total) * 100).toFixed(1).replace('.', ',')}%</text>`;
  });
  const body = `
<text x="${PAD}" y="48" font-family="M" font-size="14" fill="${theme.neon}">$ junonn langs --public</text>
<text x="${W - PAD}" y="48" text-anchor="end" font-family="M" font-size="12" fill="${theme.soft}">${repoCount} repositórios · ${orgCount + 1} contas · por bytes de código</text>
<clipPath id="bar"><rect x="${PAD}" y="${BAR_Y}" width="${BAR_W}" height="14" rx="7"/></clipPath>
<g clip-path="url(#bar)"><rect x="${PAD}" y="${BAR_Y}" width="${BAR_W}" height="14" fill="${theme.panel}"/>${segs.join('')}</g>
${legend.join('\n')}`;
  const style = `.seg{animation:grow .9s cubic-bezier(.2,.7,.2,1) both;transform-box:fill-box;transform-origin:left}@keyframes grow{from{transform:scaleX(0)}}`;
  return frame(W, H, body, style);
}

// ---------- números ----------
export function statsCard(stats) {
  const W = 1200, H = 150, PAD = 40;
  const items = [
    stats.contributions != null && [stats.contributions.toLocaleString('pt-BR'), 'contribuições no último ano'],
    stats.currentStreak != null && [`${stats.currentStreak} ${stats.currentStreak === 1 ? 'dia' : 'dias'}`, 'sequência atual'],
    stats.longestStreak != null && [`${stats.longestStreak} dias`, 'maior sequência do ano'],
    [String(stats.publicRepos), 'repositórios públicos'],
    [String(stats.orgRepos), 'repositórios nas orgs'],
  ].filter(Boolean);
  const colW = (W - PAD * 2) / items.length;
  const cols = items.map(([value, label], i) => {
    const cx = PAD + i * colW;
    return `${i ? `<path d="M${cx} 58V118" stroke="${theme.line}"/>` : ''}
<text x="${cx + (i ? 24 : 0)}" y="94" font-family="S" font-weight="800" font-size="34" letter-spacing="-1" fill="url(#hl)">${esc(value)}</text>
<text x="${cx + (i ? 24 : 0)}" y="118" font-family="M" font-size="12" fill="${theme.soft}">${esc(label)}</text>`;
  });
  const body = `
<text x="${PAD}" y="40" font-family="M" font-size="14" fill="${theme.neon}">$ junonn stats</text>
<text x="${W - PAD}" y="40" text-anchor="end" font-family="M" font-size="12" fill="${theme.soft}">atualizado em ${esc(stats.updatedAt)}</text>
${cols.join('\n')}`;
  return frame(W, H, body, '', { sora400: false });
}
