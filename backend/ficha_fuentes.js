// fichas_fuentes.js
// Rellena la tabla fuentes desde la ficha de Coolmod (campos rapidos) + nombre.
// Campos: watts (clave para compatibilidad), certificacion, modular.
//
// Uso:  node fichas_fuentes.js

const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONCURRENCIA = 6;

async function aceptarCookies(page) {
  const sel = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept';
  try { const b = page.locator(sel).first(); if (await b.count() > 0) await b.click({ timeout: 2000 }).catch(() => {}); } catch (e) {}
}

const numInt = (t) => { if (t == null) return null; const m = ('' + t).match(/\d+/); return m ? parseInt(m[0]) : null; };
function wattsDesdeNombre(n) { const m = (n || '').match(/(\d{3,4})\s*W\b/i); return m ? parseInt(m[1]) : null; }
function normModular(v) {
  if (!v) return null;
  const t = v.toLowerCase();
  if (/full|completa/.test(t)) return 'Full';
  if (/semi/.test(t)) return 'Semi';
  if (/^s[ií]$|^si\b/.test(t.trim())) return 'Si';
  if (/^no/.test(t.trim())) return 'No';
  return v.trim();
}

async function extraerFuente(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await aceptarCookies(page);
  try {
    await page.evaluate(() => document.querySelectorAll('.collapse input[type="checkbox"]').forEach((cb) => { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }));
  } catch (e) {}
  await page.waitForTimeout(300);

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

  // Watts de respaldo desde el texto ("Potencia nominal - 850 W").
  const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  campos.__wattsTexto = numInt((texto.match(/potencia nominal\s*[-:]?\s*(\d{3,4})\s*W/i) || [])[1]);
  return campos;
}

async function worker(context, cola, cont) {
  const page = await context.newPage();
  while (cola.length > 0) {
    const f = cola.pop();
    if (!f) break;
    const url = f.ofertas[0]?.url;
    let campos = {};
    if (url) { try { campos = await extraerFuente(page, url); } catch (e) {} }

    const watts = numInt(campos['Vatios']) || campos.__wattsTexto || wattsDesdeNombre(f.nombre);
    const certificacion = campos['Eficiencia'] || null;
    const modular = normModular(campos['Modular']);

    const data = {};
    if (watts != null) data.watts = watts;
    if (certificacion) data.certificacion = certificacion;
    if (modular) data.modular = modular;

    try {
      await prisma.fuentes.upsert({
        where: { id: f.id },
        update: data,
        create: Object.assign({ id: f.id, watts: watts || 0 }, data),
      });
      cont.ok++;
      console.log(`   OK watts=${watts ?? '?'} cert=${certificacion || '?'} mod=${modular || '?'}  ${f.nombre.slice(0, 40)}`);
    } catch (e) {
      cont.err++;
      console.error(`   ! ${f.nombre}: ${e.message}`);
    }
  }
  await page.close();
}

async function main() {
  console.log('>>> Rellenando specs de FUENTES');
  const fuentes = await prisma.componentes.findMany({ where: { tipo: 'fuente' }, include: { ofertas: true } });
  console.log(`>>> ${fuentes.length} fuentes | concurrencia ${CONCURRENCIA}`);
  if (fuentes.length === 0) { await prisma.$disconnect(); return; }

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

  const cola = [...fuentes];
  const cont = { ok: 0, err: 0 };
  const workers = [];
  for (let i = 0; i < CONCURRENCIA; i++) workers.push(worker(context, cola, cont));
  await Promise.all(workers);

  await browser.close();
  await prisma.$disconnect();
  console.log(`\n>>> Completadas: ${cont.ok} | Errores: ${cont.err}`);
}

main();