// fichas_refrigeracion.js
// Rellena la tabla refrigeracion desde los campos rapidos de la ficha de Coolmod.
// Campos: clase (Aire/Liquida), altura_mm (solo aire), socket_compat (lista),
//         tdp_max_watts (si aparece).
//
// Uso:  node fichas_refrigeracion.js

const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONCURRENCIA = 6;

async function aceptarCookies(page) {
  const sel = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept';
  try { const b = page.locator(sel).first(); if (await b.count() > 0) await b.click({ timeout: 2000 }).catch(() => {}); } catch (e) {}
}

const numInt = (t) => { if (t == null) return null; const m = ('' + t).match(/\d+/); return m ? parseInt(m[0]) : null; };

function clase(tipo) {
  if (!tipo) return null;
  const t = tipo.toLowerCase();
  if (/all in one|aio|l[ií]quid|water/.test(t)) return 'Liquida';
  if (/disipador|aire|tower|air/.test(t)) return 'Aire';
  return null;
}

// Normaliza la lista de sockets a AM4/AM5/LGA1700... (para casar con las CPU).
function normSocketsList(txt) {
  if (!txt) return [];
  const out = new Set();
  const re = /\b(AM4|AM5|AM3\+?|FM2\+?|TR4|sTRX4|sWRX8|SP3)\b|LGA\s?(\d{3,4})/gi;
  let m;
  while ((m = re.exec(txt)) !== null) {
    if (m[1]) out.add(m[1].toUpperCase());
    else if (m[2]) out.add('LGA' + m[2]);
  }
  return [...out];
}

async function extraerRefri(page, url) {
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

  // TDP maximo de respaldo desde el texto ("TDP de hasta 250 W").
  const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  campos.__tdp = numInt((texto.match(/TDP[^.]{0,20}?(\d{2,3})\s*W/i) || [])[1]);
  return campos;
}

async function worker(context, cola, cont) {
  const page = await context.newPage();
  while (cola.length > 0) {
    const ref = cola.pop();
    if (!ref) break;
    const url = ref.ofertas[0]?.url;
    let campos = {};
    if (url) { try { campos = await extraerRefri(page, url); } catch (e) {} }

    const cl = clase(campos['Tipo']) || clase(ref.nombre);
    const sockets = normSocketsList(campos['Socket']);
    // Altura: solo tiene sentido en refrigeracion de aire.
    const altura = numInt(campos['Altura Disipador'] || campos['Altura']);
    const tdp = campos.__tdp;

    const data = {};
    if (cl) data.clase = cl;
    if (sockets.length) data.socket_compat = sockets;
    if (altura != null && cl !== 'Liquida') data.altura_mm = altura;
    if (tdp != null) data.tdp_max_watts = tdp;

    try {
      await prisma.refrigeracion.upsert({
        where: { id: ref.id },
        update: data,
        create: Object.assign({ id: ref.id }, data),
      });
      cont.ok++;
      console.log(`   OK ${cl || '?'} altura=${data.altura_mm ?? '-'} sockets=[${sockets.join(',')}]  ${ref.nombre.slice(0, 38)}`);
    } catch (e) {
      cont.err++;
      console.error(`   ! ${ref.nombre}: ${e.message}`);
    }
  }
  await page.close();
}

async function main() {
  console.log('>>> Rellenando specs de REFRIGERACION');
  const refris = await prisma.componentes.findMany({ where: { tipo: 'refrigeracion' }, include: { ofertas: true } });
  console.log(`>>> ${refris.length} refrigeraciones | concurrencia ${CONCURRENCIA}`);
  if (refris.length === 0) { await prisma.$disconnect(); return; }

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

  const cola = [...refris];
  const cont = { ok: 0, err: 0 };
  const workers = [];
  for (let i = 0; i < CONCURRENCIA; i++) workers.push(worker(context, cola, cont));
  await Promise.all(workers);

  await browser.close();
  await prisma.$disconnect();
  console.log(`\n>>> Completadas: ${cont.ok} | Errores: ${cont.err}`);
}

main();