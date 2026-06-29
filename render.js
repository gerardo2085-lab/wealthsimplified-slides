const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const DATA_PATH = path.join(__dirname, 'data', 'slides.json');
const OUTPUT_DIR = path.join(__dirname, 'output');

const WIDTH = 1080;
const HEIGHT = 1350;

function findChromiumPath() {
  const candidates = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
  for (const p of candidates) if (fs.existsSync(p)) return p;
  const cacheDir = path.join(process.env.HOME || '/root', '.cache', 'ms-playwright');
  if (fs.existsSync(cacheDir)) {
    const dirs = fs.readdirSync(cacheDir).filter((d) => d.startsWith('chromium'));
    for (const d of dirs) {
      const exe = path.join(cacheDir, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}
function statFontSize(stat) {
  const len = stat.replace(/\s/g, '').length;
  if (len <= 5) return 300;
  if (len <= 8) return 220;
  if (len <= 12) return 160;
  return 120;
}
function buildBody(slide) {
  if (slide.layout === 'hero') {
    return `
      <div class="hero-headline">${slide.headline}</div>
      <div class="hero-stat-wrap">
        <div class="hero-stat" style="font-size:${statFontSize(slide.stat)}px;">${slide.stat}</div>
        <svg class="hero-ticker" width="560" height="56" viewBox="0 0 560 56">
          <line x1="0" y1="40" x2="560" y2="40" stroke="#3B82F6" stroke-width="1.5" opacity="0.35"/>
          <polyline points="0,46 90,42 180,44 270,30 360,33 450,16 560,10" fill="none" stroke="#3B82F6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 6px rgba(59,130,246,0.7));"/>
          <circle cx="560" cy="10" r="5" fill="#3B82F6"/>
        </svg>
      </div>
      <div class="hero-context">${slide.context}</div>
      <div class="hero-divider"></div>`;
  }
  if (slide.layout === 'list') {
    const items = slide.items.map((it) => `
      <div class="list-item">
        <div class="list-ticker">${it.ticker}</div>
        <div class="list-reason">${it.reason}</div>
      </div>`).join('');
    return `<div class="list-headline">${slide.headline}</div><div class="list-items">${items}</div>`;
  }
  if (slide.layout === 'cta') {
    return `<div class="cta-wrap"><div class="cta-line">${slide.line}</div></div>`;
  }
  throw new Error(`Unknown layout: ${slide.layout}`);
}

async function main() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const slides = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const total = slides.length;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const chromiumPath = findChromiumPath();
  const browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {});
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const index = String(i + 1).padStart(2, '0');
    const bodyHtml = buildBody(slide);

    const html = template
      .replaceAll('{{INDEX}}', index)
      .replaceAll('{{TOTAL}}', String(total).padStart(2, '0'))
      .replaceAll('{{CATEGORY}}', slide.category)
      .replaceAll('{{BACKGROUND}}', slide.background)
      .replaceAll('{{SOURCE}}', slide.source || '')
      .replace('{{BODY}}', bodyHtml);

    const tempPath = path.join(__dirname, `_temp_slide_${index}.html`);
    fs.writeFileSync(tempPath, html);

    await page.goto(`file://${tempPath}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `slide_${index}.png`) });

    fs.unlinkSync(tempPath);
    console.log(`Rendered slide_${index}.png`);
  }

  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
