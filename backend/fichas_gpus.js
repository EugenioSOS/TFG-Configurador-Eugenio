// fichas_gpu.js
// Rellena la tabla gpus desde la ficha de Coolmod + el nombre.
// Campos: longitud_mm (1er num de "Tamaño de la Tarjeta"), watts_recomendados
//         ("PSU Recomendado"), vram_gb (del nombre). tdp_watts se deja si ya existe.
//
// Uso:  node fichas_gpu.js

const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONCURRENCIA = 6;

async function aceptarCookies(page) {
  const sel = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept';
  try { const b = page.locator(sel).first(); if (await b.count() > 0) await b.click({ timeout: 2000 }).catch(() => {}); } catch (e) {}
}

// VRAM desde el nombre: "16GB", "8 GB"...
function vramDesdeNombre(nombre) {
  if (!nombre) return null;
  const m = nombre.match(/(\d{1,3})\s*GB/i);
  return m ? parseInt(m[1]) : null;
}

// Longitud de la GPU = numero mayor del bloque de dimensiones de la tarjeta.
function longitudGpu(texto) {
  if (!texto) return null;
  const mTarjeta = texto.match(/(?:Tama[nñ]o de la Tarjeta|Dimensiones de la Tarjeta|Tarjeta)[^\d]{0,15}(\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?)\s*mm/i);
  let bloque = mTarjeta ? mTarjeta[1] : null;
  if (!bloque) {
    const todos = texto.match(/\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?(?:\s*x\s*\d+(?:\.\d+)?)?\s*mm/gi) || [];
    for (const b of todos) {
      const idx = texto.indexOf(b);
      const antes = texto.slice(Math.max(0, idx - 25), idx).toLowerCase();
      if (/caja|embalaje|paquete/.test(antes)) continue;
      bloque = b; break;
    }
  }
  if (!bloque) return null;
  const nums = (bloque.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  return nums.length ? Math.round(Math.max(...nums)) : null;
}

async function extraerGpu(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await aceptarCookies(page);
  // Los acordeones DaisyUI se abren MARCANDO su checkbox (no clicando el titulo).
  try {
    await page.evaluate(() => {
      document.querySelectorAll('.collapse input[type="checkbox"]').forEach((cb) => {
        if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    });
  } catch (e) {}
  await page.waitForTimeout(500);

  const texto = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

  // Longitud = numero MAYOR del bloque de dimensiones de la TARJETA (el largo
  // siempre es la mayor de las 3 medidas). Se evita el bloque de la caja/embalaje.
  const longitud = longitudGpu(texto);

  // Watts recomendados = "PSU Recomendado: 850 W"
  const wMatch = texto.match(/PSU\s*Recomendad[oa]:?\s*(\d{3,4})\s*W/i)
    || texto.match(/fuente[^.]{0,25}recomendad[oa][^.]{0,10}?(\d{3,4})\s*W/i)
    || texto.match(/alimentaci[oó]n recomendad[oa][^.]{0,10}?(\d{3,4})\s*W/i);
  const watts = wMatch ? parseInt(wMatch[1]) : null;

  return { longitud, watts };
}

async function worker(context, cola, cont) {
  const page = await context.newPage();
  while (cola.length > 0) {
    const gpu = cola.pop();
    if (!gpu) break;
    const url = gpu.ofertas[0]?.url;
    let r = { longitud: null, watts: null };
    if (url) { try { r = await extraerGpu(page, url); } catch (e) {} }

    const vram = vramDesdeNombre(gpu.nombre);
    const data = {};
    if (r.longitud != null) data.longitud_mm = r.longitud;
    if (r.watts != null) data.watts_recomendados = r.watts;
    if (vram != null) data.vram_gb = vram;

    try {
      await prisma.gpus.upsert({
        where: { id: gpu.id },
        update: data,
        create: Object.assign({ id: gpu.id }, data),
      });
      cont.ok++;
      console.log(`   OK long=${r.longitud ?? '?'} psu=${r.watts ?? '?'} vram=${vram ?? '?'}  ${gpu.nombre.slice(0, 42)}`);
    } catch (e) {
      cont.err++;
      console.error(`   ! ${gpu.nombre}: ${e.message}`);
    }
  }
  await page.close();
}

async function main() {
  console.log('>>> Rellenando specs de GPUs');
  const gpus = await prisma.componentes.findMany({ where: { tipo: 'gpu' }, include: { ofertas: true } });
  console.log(`>>> ${gpus.length} GPUs | concurrencia ${CONCURRENCIA}`);
  if (gpus.length === 0) { await prisma.$disconnect(); return; }

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

  const cola = [...gpus];
  const cont = { ok: 0, err: 0 };
  const workers = [];
  for (let i = 0; i < CONCURRENCIA; i++) workers.push(worker(context, cola, cont));
  await Promise.all(workers);

  await browser.close();
  await prisma.$disconnect();
  console.log(`\n>>> Completadas: ${cont.ok} | Errores: ${cont.err}`);
}

main();