// fichas_placas.js
// Rellena la tabla placas desde los campos rapidos de la ficha de Coolmod.
// Campos: socket, tipo_ram (DDR4/DDR5), formato (ATX/Micro-ATX/Mini-ITX), chipset.
// Los datos estan en los bloques <div class="font-bold">Etiqueta</div> <span title="valor">.
//
// Uso:  node fichas_placas.js

const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONCURRENCIA = 6;

async function aceptarCookies(page) {
  const sel = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept';
  try { const b = page.locator(sel).first(); if (await b.count() > 0) await b.click({ timeout: 2000 }).catch(() => {}); } catch (e) {}
}

// --- normalizadores (para que casen con los valores de las otras tablas) ---
function normSocket(v) {
  if (!v) return null;
  const s = v.replace(/AMD|Intel/ig, '').trim().toUpperCase().replace(/\s+/g, '');
  return s || null;
}
function normTipoRam(v) { if (!v) return null; const m = v.match(/DDR\d/i); return m ? m[0].toUpperCase() : null; }
// El nombre manda si trae un DDR explicito (ej. "...Tomahawk DDR4"). Las placas
// modernas sin DDR en el nombre son DDR5; el tipo final se decide con la ficha.
function tipoRamDesdeNombre(nombre) {
  if (!nombre) return null;
  const m = nombre.match(/DDR\d/i);
  return m ? m[0].toUpperCase() : null;
}
function normFormato(v) {
  if (!v) return null;
  const t = v.toLowerCase();
  if (/e-?atx/.test(t)) return 'E-ATX';
  if (/micro|matx|m-atx/.test(t)) return 'Micro-ATX';
  if (/mini|itx/.test(t)) return 'Mini-ITX';
  if (/atx/.test(t)) return 'ATX';
  return v.trim();
}

// Socket desde el nombre como respaldo ("Socket AM4").
function socketDesdeNombre(nombre) {
  if (!nombre) return null;
  const m = nombre.match(/socket\s+([A-Za-z]*\d+[A-Za-z0-9]*|[A-Za-z]+\d*)/i);
  if (!m) return null;
  const lga = nombre.match(/(LGA|sTR|SP)\s?\d+[A-Za-z0-9]*/i);
  return (lga ? lga[0].replace(/\s+/g, '') : m[1]).toUpperCase();
}

async function extraerPlaca(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await aceptarCookies(page);
  // abrir acordeones marcando checkboxes
  try {
    await page.evaluate(() => document.querySelectorAll('.collapse input[type="checkbox"]').forEach((cb) => { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }));
  } catch (e) {}
  // Esperar a que el bloque de especificaciones detalladas cargue de verdad
  // (memoria interna maxima con su valor, o ranuras de memoria).
  try {
    await page.waitForFunction(() => {
      const t = document.body.innerText;
      return /memoria interna m[aá]xima[\s-:]*\d+\s*GB/i.test(t) || /ranuras? de memoria[\s-:]*\d+/i.test(t);
    }, { timeout: 8000 });
  } catch (e) { /* algunas no lo tienen; seguimos con lo que haya */ }
  await page.waitForTimeout(300);

  // Campos rapidos: <div class="font-bold">Etiqueta</div> ... <span title="valor">
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

  // Texto completo (para slots DIMM y capacidad maxima, que estan en la ficha detallada).
  const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const intDe = (rx) => { const m = texto.match(rx); return m ? parseInt(m[1]) : null; };
  // Separador flexible: la etiqueta puede ir seguida de ':', '-' o solo espacios.
  const SEP = '\\s*[-:]?\\s*';
  campos.__slots = intDe(new RegExp('(?:n[uú]mero de )?ranuras? de memoria' + SEP + '(\\d+)', 'i'))
    || intDe(new RegExp('(?:n[uú]mero de )?ranuras? DIMM' + SEP + '(\\d+)', 'i'))
    || intDe(/(\d+)\s*x\s*DIMM/i);
  // Solo "memoria interna maxima" (fiable). El patron generico daba falsos 8/16 GB.
  campos.__ramMax = intDe(new RegExp('memoria interna m[aá]xima' + SEP + '(\\d+)\\s*GB', 'i'));
  // Tipo de RAM de respaldo: "tipos de memoria compatibles - DDR5-SDRAM"
  campos.__tipoRamTexto = (texto.match(/memoria compatibles?\s*[-:]?\s*(DDR\d)/i) || [])[1] || null;

  return campos;
}

async function worker(context, cola, cont) {
  const page = await context.newPage();
  while (cola.length > 0) {
    const placa = cola.pop();
    if (!placa) break;
    const url = placa.ofertas[0]?.url;
    let campos = {};
    if (url) { try { campos = await extraerPlaca(page, url); } catch (e) {} }

    const socket = normSocket(campos['Socket']) || socketDesdeNombre(placa.nombre);
    const tipoRam = tipoRamDesdeNombre(placa.nombre)   // DDR explicito en el nombre manda
      || normTipoRam(campos['Memoria'])
      || normTipoRam(campos.__tipoRamTexto);
    const formato = normFormato(campos['Formato']);
    const chipset = campos['Chipset'] || null;

    const data = {};
    if (socket) data.socket = socket;
    if (tipoRam) data.tipo_ram = tipoRam;
    if (formato) data.formato = formato;
    if (chipset) data.chipset = chipset;
    if (campos.__slots != null) data.slots_ram = campos.__slots;
    if (campos.__ramMax != null) data.ram_max_gb = campos.__ramMax;

    try {
      await prisma.placas.upsert({
        where: { id: placa.id },
        update: data,
        create: Object.assign({ id: placa.id, socket: socket || 'PENDIENTE', tipo_ram: tipoRam || 'PENDIENTE', formato: formato || 'PENDIENTE' }, data),
      });
      cont.ok++;
      console.log(`   OK socket=${socket || '?'} ram=${tipoRam || '?'} fmt=${formato || '?'} slots=${campos.__slots ?? '?'} max=${campos.__ramMax ?? '?'}GB  ${placa.nombre.slice(0, 35)}`);
    } catch (e) {
      cont.err++;
      console.error(`   ! ${placa.nombre}: ${e.message}`);
    }
  }
  await page.close();
}

async function main() {
  console.log('>>> Rellenando specs de PLACAS BASE');
  const placas = await prisma.componentes.findMany({ where: { tipo: 'placa' }, include: { ofertas: true } });
  console.log(`>>> ${placas.length} placas | concurrencia ${CONCURRENCIA}`);
  if (placas.length === 0) { await prisma.$disconnect(); return; }

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

  const cola = [...placas];
  const cont = { ok: 0, err: 0 };
  const workers = [];
  for (let i = 0; i < CONCURRENCIA; i++) workers.push(worker(context, cola, cont));
  await Promise.all(workers);

  await browser.close();
  await prisma.$disconnect();
  console.log(`\n>>> Completadas: ${cont.ok} | Errores: ${cont.err}`);
}

main();