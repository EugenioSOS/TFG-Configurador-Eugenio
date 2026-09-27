// diag_placa.js — Ver como aparecen slots y capacidad max en UNA placa.
// Uso: node diag_placa.js "URL_DE_UNA_PLACA"
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
  await page.evaluate(() => document.querySelectorAll('.collapse input[type="checkbox"]').forEach((cb) => { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }));
  await page.waitForTimeout(800);

  const t = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');

  console.log('=== fragmentos con memoria/ranura/DIMM/slot/módulo ===');
  for (const kw of ['ranura', 'DIMM', 'slot', 'm[oó]dulos de memoria', 'memoria interna', 'capacidad', 'memoria m[aá]xima', 'soportad']) {
    const re = new RegExp('.{0,30}' + kw + '.{0,45}', 'i');
    const m = t.match(re);
    if (m) console.log(`  [${kw}] ...${m[0].trim().slice(0,85)}`);
  }
  console.log('\n=== todos los "N GB" ===');
  console.log((t.match(/\d+\s*GB/gi) || []).slice(0, 12));
  await browser.close();
}
main();