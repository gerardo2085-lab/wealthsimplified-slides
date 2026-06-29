const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
const DATA_PATH = path.join(__dirname, 'data', 'slides.json');
const OUTPUT_DIR = path.join(__dirname, 'output');

const WIDTH = 1080;
const HEIGHT = 1350;

async function main() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const slides = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  const total = slides.length;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const index = String(i + 1).padStart(2, '0');

    const html = template
      .replaceAll('{{INDEX}}', index)
      .replaceAll('{{TOTAL}}', String(total).padStart(2, '0'))
      .replaceAll('{{HEADLINE}}', slide.headline)
      .replaceAll('{{STAT}}', slide.stat)
      .replaceAll('{{CONTEXT}}', slide.context)
      .replaceAll('{{SOURCE}}', slide.source)
      .replaceAll('{{BACKGROUND}}', slide.background);

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
