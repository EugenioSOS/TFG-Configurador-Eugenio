const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONCURRENCIA = 6;   // fichas en paralelo (sube/baja segun tu maquina y la web)

// ---- parseo texto libre -> valor limpio ----
const numInt = (t) => { if (!t) return null; const m = t.replace(/\./g, '').match(/\d+/); return m ? parseInt(m[0]) : null; };
const numFloat = (t) => { if (!t) return null; const m = t.replace(',', '.').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };

// Socket desde el nombre: coge lo que va justo detras de "Socket".
function socketDesdeNombre(nombre) {
  if (!nombre) return null;
  const m = nombre.match(/(?:socket|z[oó]calo)\s+([A-Za-z]*\d+[A-Za-z0-9]*|[A-Za-z]+\d*)/i);
  if (!m) return null;
  let s = m[1].trim();
  const lga = nombre.match(/(LGA|sTR|sWRX|sTRX|SP)\s?\d+[A-Za-z0-9]*/i);
  if (lga) s = lga[0].replace(/\s+/g, '');
  return s.toUpperCase();
}

// Frecuencia desde el nombre: "5.2GHz", "3.4 GHz", "6,0GHz"...
function frecuenciaDesdeNombre(nombre) {
  if (!nombre) return null;
  const m = nombre.match(/(\d+(?:[.,]\d+)?)\s?GHz/i);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

// Quita acentos/mayusculas para comparar claves de forma robusta.
function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

// Busca en specs la primera clave que contenga TODAS las palabras dadas (sin acentos).
function buscarSpec(specs, ...palabras) {
  for (const clave of Object.keys(specs)) {
    const kn = norm(clave);
    if (palabras.every((w) => kn.includes(norm(w)))) return specs[clave];
  }
  return null;
}

// Tipo de RAM (DDR4/DDR5) a partir de un texto.
function tipoRamDesde(txt) {
  if (!txt) return null;
  const m = txt.match(/DDR\d/i);
  return m ? m[0].toUpperCase() : null;
}

// Cierra el banner de cookies (Cookiebot) si aparece: bloquea clics y ensucia el DOM.
async function aceptarCookies(page) {
  const sel = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept';
  try {
    const btn = page.locator(sel).first();
    if (await btn.count() > 0) { await btn.click({ timeout: 2000 }).catch(() => {}); }
  } catch (e) { /* si no hay banner, nada */ }
}

async function extraerSpecs(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await aceptarCookies(page);

  // Esperar a que aparezca alguna spec conocida (hasta 6s); si no, seguimos con lo que haya.
  try {
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('li strong'))
        .some((s) => /Socket|Cantidad de n|Consumo de energ/i.test(s.textContent || '')),
      { timeout: 6000 });
  } catch (e) { /* puede no cargar; devolvemos lo que haya */ }

  // Leer los pares <li><strong>Clave</strong>: valor</li>, EXCLUYENDO la basura de cookies.
  // (el banner de cookies mete li con "Duración máxima de almacenamiento", "Tipo: Cookie"...)
  return page.$$eval('li', (lis) => {
    const out = {};
    for (const li of lis) {
      const strong = li.querySelector('strong');
      if (!strong) continue;
      const txt = li.textContent || '';
      // Descarta el ruido del banner de cookies (valores larguisimos o con estas marcas).
      if (/Duraci..n m..xima|Tipo: Cookie|Almacenamiento Local|proveedor|IndexedDB/i.test(txt)) continue;
      if (txt.length > 300) continue;

      const clave = strong.textContent.replace(':', '').trim();
      let valor = txt.replace(strong.textContent, '').replace(/^[:\s]+/, '').trim();
      if (clave && valor) out[clave] = valor;
    }
    return out;
  });
}

function mapearCpu(specs, nombre) {
  const socket = buscarSpec(specs, 'socket') || socketDesdeNombre(nombre);
  const tdp = numInt(buscarSpec(specs, 'consumo', 'tdp') || buscarSpec(specs, 'tdp'));
  const nucleos = numInt(buscarSpec(specs, 'cantidad', 'nucleos'));
  const hilos = numInt(buscarSpec(specs, 'cantidad', 'hilos'));
  const frecuencia = numFloat(buscarSpec(specs, 'frecuencia', 'maxima')) || frecuenciaDesdeNombre(nombre);
  const tipoRam = tipoRamDesde(buscarSpec(specs, 'memoria', 'compatible') || buscarSpec(specs, 'soporte', 'memoria'));
  const descModelo = (buscarSpec(specs, 'descripcion', 'modelo') || nombre || '').toLowerCase();
  const graficaIntegrada = /integrad|radeon|graphics|uhd|vega/.test(descModelo);

  const data = {};
  if (socket) data.socket = socket;
  if (tdp != null) data.tdp_watts = tdp;
  if (nucleos != null) data.nucleos = nucleos;
  if (hilos != null) data.hilos = hilos;
  if (frecuencia != null) data.frecuencia_ghz = frecuencia;
  if (tipoRam) data.tipo_ram = tipoRam;
  data.grafica_integrada = graficaIntegrada;
  return { data, socket };
}

async function worker(context, cola, contador) {
  const page = await context.newPage();
  while (cola.length > 0) {
    const cpu = cola.pop();
    if (!cpu) break;
    const url = cpu.ofertas[0]?.url;
    let specs = {};
    if (url) {
      try { specs = await extraerSpecs(page, url); }
      catch (e) { /* seguimos con lo que haya (socket/frecuencia del nombre) */ }
    }
    const { data, socket } = mapearCpu(specs, cpu.nombre);
    try {
      await prisma.cpus.update({ where: { id: cpu.id }, data });
      contador.ok++;
      console.log(`   OK [${contador.ok}] socket=${socket || '?'} tdp=${data.tdp_watts ?? '?'} nuc=${data.nucleos ?? '?'} ghz=${data.frecuencia_ghz ?? '?'}  ${cpu.nombre.slice(0, 45)}`);
    } catch (e) {
      contador.err++;
      console.error(`   ! ${cpu.nombre}: ${e.message}`);
    }
  }
  await page.close();
}

async function main() {
  console.log('>>> Rellenando specs de CPUs (paralelo)');

  const cpus = await prisma.componentes.findMany({
    where: { tipo: 'cpu' },
    include: { ofertas: true },
  });
  console.log(`>>> ${cpus.length} CPUs por completar | concurrencia ${CONCURRENCIA}`);
  if (cpus.length === 0) { await prisma.$disconnect(); return; }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    locale: 'es-ES',
    viewport: { width: 1366, height: 768 },
  });
  // Bloqueamos imagenes, fuentes y media (el CSS se deja para no romper el acordeon).
  await context.route('**/*', (route) => {
    const t = route.request().resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return route.abort();
    return route.continue();
  });

  const cola = [...cpus];
  const contador = { ok: 0, err: 0 };

  const workers = [];
  for (let i = 0; i < CONCURRENCIA; i++) workers.push(worker(context, cola, contador));
  await Promise.all(workers);

  await browser.close();
  await prisma.$disconnect();
  console.log(`\n>>> Completadas: ${contador.ok} | Errores: ${contador.err}`);
}

main();