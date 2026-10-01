// diag_tdp.js — Localiza DONDE esta el TDP en una ficha de CPU.
// Uso: node diag_tdp.js "URL_DE_UNA_CPU"
const { chromium } = require('playwright');
async function main() {
  const url = process.argv[2];
  if (!url) { console.error('Pasa una URL de CPU'); process.exit(1); }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0 Safari/537.36', locale: 'es-ES', viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const c = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept').first();
  if (await c.count() > 0) await c.click({ timeout: 2000 }).catch(() => {});
  // abrir acordeones (checkbox + clic)
  await page.evaluate(() => document.querySelectorAll('.collapse input[type="checkbox"]').forEach((cb) => { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }));
  const titulos = page.locator('.collapse-title');
  const nt = await titulos.count();
  for (let i = 0; i < nt; i++) await titulos.nth(i).click({ timeout: 800 }).catch(() => {});
  await page.waitForTimeout(1500);

  // 1) ACORDEON: pares <li><strong>
  const acordeon = await page.$$eval('li', (lis) => {
    const out = [];
    for (const li of lis) {
      const s = li.querySelector('strong'); if (!s) continue;
      const clave = s.textContent.replace(':', '').trim();
      const valor = li.textContent.replace(s.textContent, '').replace(/^[:\s]+/, '').trim();
      if (clave && valor && valor.length < 100 && /tdp|consumo|energ|watt|potencia/i.test(clave + valor)) out.push(clave + ' -> ' + valor);
    }
    return out;
  });
  console.log('=== ACORDEON (li con tdp/consumo) ===');
  acordeon.forEach((x) => console.log('  ', x));

  // 2) CAMPOS RAPIDOS font-bold
  const rapidos = await page.evaluate(() => {
    const out = {};
    Array.from(document.querySelectorAll('div')).filter((d) => d.className.includes('font-bold')).forEach((lab) => {
      const span = lab.parentElement && lab.parentElement.querySelector('span[title]');
      if (span) out[lab.textContent.trim()] = (span.getAttribute('title') || span.textContent).trim();
    });
    return out;
  });
  console.log('\n=== CAMPOS RAPIDOS ===');
  console.log(JSON.stringify(rapidos, null, 2));

  // 3) Contexto de "TDP"/"Consumo"/"W" en el texto visible
  const t = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
  console.log('\n=== contexto TDP/Consumo en texto ===');
  for (const kw of ['TDP', 'Consumo', 'Potencia']) {
    const m = t.match(new RegExp('.{0,15}' + kw + '.{0,30}', 'i'));
    if (m) console.log('  [' + kw + ']', m[0].trim());
  }
  console.log('  "\\d+ ?W" encontrados:', (t.match(/\d{2,3}\s*W\b/g) || []).slice(0, 6));

  await browser.close();
}
main();