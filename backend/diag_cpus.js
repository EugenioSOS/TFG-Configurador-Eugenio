// diag_cpu2.js — Ver los campos RAPIDOS (font-bold + span) de una CPU.
// Uso: node diag_cpu2.js "URL"
const { chromium } = require('playwright');
async function main() {
  const url = process.argv[2];
  if (!url) { console.error('Pasa una URL'); process.exit(1); }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0 Safari/537.36', locale: 'es-ES', viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const c = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept').first();
  if (await c.count() > 0) await c.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // campos rapidos: <div class="font-bold">Etiqueta</div> ... <span title="valor">
  const campos = await page.evaluate(() => {
    const out = {};
    const labels = Array.from(document.querySelectorAll('div')).filter((d) => d.className.includes('font-bold'));
    for (const lab of labels) {
      const et = lab.textContent.trim();
      const span = lab.parentElement && lab.parentElement.querySelector('span[title]');
      if (span) out[et] = (span.getAttribute('title') || span.textContent).trim();
    }
    return out;
  });
  console.log('=== CAMPOS RAPIDOS (font-bold + span) ===');
  console.log(JSON.stringify(campos, null, 2));
  await browser.close();
}
main();