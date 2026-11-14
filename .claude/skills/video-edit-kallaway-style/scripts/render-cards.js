// Render 1080x1920 title-card PNGs for a CapCut edit.
// Usage: node render-cards.js cards.json out-dir
// Needs Playwright with Chromium (preinstalled in Claude cloud sessions).
//
// cards.json is an array. Each card:
//   { "file": "03-lean.png", "theme": "dark" | "light",
//     "type": "title" | "list" | "check" | "cta" | "statement",
//     "title": "Make Them *Lean In*",        // *word* = italic serif accent
//     "items": ["The Context", "The Lean"],  // list / check cards
//     "active": 1,                           // list: highlighted item (0-based); others dimmed
//     "done": [0],                           // check: items that show a tick
//     "body": "Short statement text" }       // statement / cta cards
//
// Layout keeps the bottom of the frame clear: top ~58% = graphic,
// ~62-70% = caption zone, bottom ~28% = speaker inset (added in CapCut).

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const [, , specPath, outDir = 'cards'] = process.argv;
if (!specPath) {
  console.error('Usage: node render-cards.js cards.json out-dir');
  process.exit(1);
}
const cards = JSON.parse(fs.readFileSync(specPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const THEMES = {
  dark: { bg: '#000000', fg: '#ffffff', dim: '#3a3a3a', panel: '#1c1c1c', accent: '#d7263d', good: '#22c55e' },
  light: { bg: '#e6e6e6', fg: '#111111', dim: '#b5b5b5', panel: '#ffffff', accent: '#d7263d', good: '#16a34a' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const accent = (s) => esc(s).replace(/\*(.+?)\*/g, '<em>$1</em>');

function body(card, t) {
  const items = card.items || [];
  switch (card.type) {
    case 'list':
      return `<ol class="list">${items
        .map((it, i) => `<li class="${i === card.active ? 'on' : 'off'}"><span>0${i + 1}</span>${esc(it)}</li>`)
        .join('')}</ol>`;
    case 'check':
      return `<ul class="check">${items
        .map((it, i) => `<li><em>${esc(it)}</em>${(card.done || []).includes(i) ? `<b style="color:${t.good}">&#10003;</b>` : ''}</li>`)
        .join('')}</ul>`;
    case 'cta':
    case 'statement':
      return `<p class="statement">${accent(card.body)}</p>`;
    default:
      return '';
  }
}

function html(card) {
  const t = THEMES[card.theme] || THEMES.dark;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1080px;height:1920px;background:${t.bg};color:${t.fg};font-family:Inter,"Helvetica Neue",Arial,sans-serif}
  .stage{position:absolute;left:0;right:0;top:0;height:1110px;display:flex;flex-direction:column;align-items:center;padding:150px 90px 0}
  h1{font-size:96px;font-weight:800;letter-spacing:-2px;text-align:center;line-height:1.05;padding-bottom:18px;border-bottom:6px solid ${t.accent}}
  h1 em,.statement em{font-family:"Instrument Serif","Playfair Display",Georgia,"Liberation Serif",serif;font-style:italic;font-weight:400}
  .list{list-style:none;margin-top:90px;width:720px}
  .list li{display:flex;gap:36px;align-items:center;font-size:56px;font-weight:700;padding:30px 40px;margin-bottom:28px;border-radius:14px;background:${t.panel};border-left:10px solid ${t.accent}}
  .list li span{opacity:.6;font-weight:600}
  .list li.off{color:${t.dim};border-left-color:${t.dim};filter:blur(1.5px)}
  .check{list-style:none;margin-top:110px}
  .check li{font-size:64px;margin-bottom:56px;display:flex;gap:26px;align-items:center}
  .check em{font-family:"Instrument Serif",Georgia,"Liberation Serif",serif}
  .statement{margin-top:120px;font-size:80px;font-weight:800;text-align:center;line-height:1.15;letter-spacing:-1px}
  </style></head><body><div class="stage">
  ${card.title ? `<h1>${accent(card.title)}</h1>` : ''}
  ${body(card, t)}
  </div></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  for (const [i, card] of cards.entries()) {
    const file = card.file || `${String(i + 1).padStart(2, '0')}.png`;
    await page.setContent(html(card));
    await page.screenshot({ path: path.join(outDir, file) });
    console.log('wrote', path.join(outDir, file));
  }
  await browser.close();
})();
