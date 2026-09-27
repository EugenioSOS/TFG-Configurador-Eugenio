// diag_specs.js — Diagnostico: que specs lee Playwright de UNA ficha.
// Uso:  node diag_specs.js "URL_DE_UNA_FICHA_DE_CPU"

const { chromium } = require('playwright');

async function main() {
  const url = process.argv[2];
  if (!url) { console.error('Pasa una URL: node diag_specs.js "https://..."'); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    locale: 'es-ES', viewport: { width: 1366, height: 768 },
  });
  await context.route('**/*', (r) => {
    const t = r.request().resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return r.abort();
    return r.continue();
  });
  const page = await context.newPage();

  console.log('Navegando a:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Intentar desplegar "Especificaciones"
  const titulo = page.locator('.collapse-title', { hasText: /Especificaciones/i }).first();
  const hayTitulo = await titulo.count();
  console.log('Titulo "Especificaciones" encontrado:', hayTitulo > 0);
  if (hayTitulo > 0) { await titulo.click({ timeout: 4000 }).catch((e) => console.log('  click fallo:', e.message)); }

  await page.waitForTimeout(2500);

  // Cuantos li con strong hay
  const nLi = await page.$$eval('li', (lis) => lis.filter((li) => li.querySelector('strong')).length);
  console.log('li con <strong> en la pagina:', nLi);

  // Volcar TODOS los pares clave->valor
  const pares = await page.$$eval('li', (lis) => {
    const out = [];
    for (const li of lis) {
      const s = li.querySelector('strong');
      if (!s) continue;
      const clave = s.textContent.replace(':', '').trim();
      const valor = li.textContent.replace(s.textContent, '').replace(/^:\s*/, '').trim();
      if (clave && valor) out.push(clave + '  ->  ' + valor);
    }
    return out;
  });
  console.log('\n--- PARES CLAVE -> VALOR que ve Playwright ---');
  pares.forEach((p) => console.log('  ' + p));

  // ¿Aparece TDP / DDR en el texto completo?
  const txt = await page.evaluate(() => document.body.innerText);
  console.log('\n"TDP" en el texto visible:', /TDP/i.test(txt));
  console.log('"DDR" en el texto visible:', /DDR\d/i.test(txt));

  await browser.close();
}
main();