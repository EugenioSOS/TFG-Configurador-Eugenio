// fichas_cajas.js
// Rellena la tabla cajas desde la ficha de Coolmod.
// Campos: formatos_admitidos (ATX...), long_max_gpu_mm, altura_max_disip_mm.
// Las cajas usan <li>Clave: valor</li> SIN <strong>, y la longitud de GPU suele
// estar en el texto descriptivo ("GPU de hasta 413 mm").
//
// Uso:  node fichas_cajas.js

const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONCURRENCIA = 6;

async function aceptarCookies(page) {
  const sel = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept';
  try {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0) await btn.click({ timeout: 2000 }).catch(() => {});
  } catch (e) {}
}

// Normaliza el texto de "Compatibilidad de placa base" a formatos estandar.
function parseFormatos(txt) {
  if (!txt) return [];
  const out = new Set();
  if (/e-?atx/i.test(txt)) out.add('E-ATX');
  if (/micro-?atx|matx|m-atx|µatx/i.test(txt)) out.add('Micro-ATX');
  if (/mini-?itx|itx/i.test(txt)) out.add('Mini-ITX');
  const sinEyM = txt.replace(/e-?atx|m-?atx|matx/ig, '');
  if (/(^|[^a-z-])atx/i.test(sinEyM)) out.add('ATX');
  return [...out];
}
const mmDe = (txt, regex) => { const m = (txt || '').match(regex); return m ? parseInt(m[1]) : null; };

// Una caja admite su formato y todos los mas pequenos (compatibilidad "hacia abajo").
function expandirFormatos(base) {
  const orden = ['E-ATX', 'ATX', 'Micro-ATX', 'Mini-ITX'];
  const set = new Set();
  for (const f of base) {
    const i = orden.indexOf(f);
    if (i >= 0) for (let j = i; j < orden.length; j++) set.add(orden[j]);
    else set.add(f);
  }
  return [...set];
}

async function extraerCaja(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await aceptarCookies(page);

  // Desplegar todos los acordeones para que su contenido este en el DOM.
  try {
    const titulos = page.locator('.collapse-title');
    const n = await titulos.count();
    for (let i = 0; i < n; i++) await titulos.nth(i).click({ timeout: 1200 }).catch(() => {});
  } catch (e) {}
  await page.waitForTimeout(500);

  // 1) Campo rapido "Formato" -> valor en <span title="...">
  const formatoRapido = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('div'));
    const lab = labels.find((d) => d.textContent.trim() === 'Formato' && d.className.includes('font-bold'));
    if (!lab) return null;
    const span = lab.parentElement.querySelector('span[title]');
    return span ? (span.getAttribute('title') || span.textContent).trim() : null;
  });

  // 2) Texto completo (para "Compatibilidad de placa base" y las medidas)
  const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const compat = (texto.match(/Compatibilidad de placa base:?\s*([^\n]{3,80})/i) || [])[1] || '';

  // Combina ambas fuentes y expande "hacia abajo".
  let formatos = parseFormatos((formatoRapido || '') + ' ' + compat);
  formatos = expandirFormatos(formatos);

  // Longitud de GPU: varias formas segun la caja.
  const longGpu = mmDe(texto, /(?:longitud (?:de la |m[aá]x[a-z.]* de )?)?(?:GPU|tarjeta gr[aá]fica|VGA)[^\d]{0,25}(\d{3})\s*mm/i)
    || mmDe(texto, /GPU de hasta\s+(\d+)\s*mm/i);

  // Altura del disipador/refrigerador de CPU: varias formas.
  const alturaDisip = mmDe(texto, /(?:altura[^\d]{0,30})?(?:refrigerador de cpu|disipador|cpu cooler)[^\d]{0,25}(\d{2,3})\s*mm/i)
    || mmDe(texto, /disipador[^.]{0,40}?hasta\s+(\d+)\s*mm/i);

  return { formatos, longGpu, alturaDisip };
}

async function worker(context, cola, cont) {
  const page = await context.newPage();
  while (cola.length > 0) {
    const caja = cola.pop();
    if (!caja) break;
    const url = caja.ofertas[0]?.url;
    let r = { formatos: [], longGpu: null, alturaDisip: null };
    if (url) { try { r = await extraerCaja(page, url); } catch (e) {} }

    const data = { formatos_admitidos: r.formatos };
    if (r.longGpu != null) data.long_max_gpu_mm = r.longGpu;
    if (r.alturaDisip != null) data.altura_max_disip_mm = r.alturaDisip;

    try {
      await prisma.cajas.upsert({
        where: { id: caja.id },
        update: data,
        create: Object.assign({ id: caja.id }, data),
      });
      cont.ok++;
      console.log(`   OK formatos=[${r.formatos.join(',')}] gpu=${r.longGpu ?? '?'} disip=${r.alturaDisip ?? '?'}  ${caja.nombre.slice(0, 40)}`);
    } catch (e) {
      cont.err++;
      console.error(`   ! ${caja.nombre}: ${e.message}`);
    }
  }
  await page.close();
}

async function main() {
  console.log('>>> Rellenando specs de CAJAS');
  const cajas = await prisma.componentes.findMany({ where: { tipo: 'caja' }, include: { ofertas: true } });
  console.log(`>>> ${cajas.length} cajas | concurrencia ${CONCURRENCIA}`);
  if (cajas.length === 0) { await prisma.$disconnect(); return; }

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

  const cola = [...cajas];
  const cont = { ok: 0, err: 0 };
  const workers = [];
  for (let i = 0; i < CONCURRENCIA; i++) workers.push(worker(context, cola, cont));
  await Promise.all(workers);

  await browser.close();
  await prisma.$disconnect();
  console.log(`\n>>> Completadas: ${cont.ok} | Errores: ${cont.err}`);
}

main();