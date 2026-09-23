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

async function extraerSpecs(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
 
  try {
    await page.waitForSelector('.collapse-content li, .collapse-title', { timeout: 8000 });
  } catch (e) { return {}; }

  return page.$$eval('.collapse-content li', (lis) => {
    const out = {};
    for (const li of lis) {
      const strong = li.querySelector('strong');
      if (!strong) continue;
      const clave = strong.textContent.replace(':', '').trim();
      const valor = li.textContent.replace(strong.textContent, '').replace(/^:\s*/, '').trim();
      if (clave && valor) out[clave] = valor;
    }
    return out;
  });
}

function mapearCpu(specs, nombre) {
  const socket = specs['Socket'] || socketDesdeNombre(nombre);
  const tdp = numInt(specs['Consumo de energía (TDP)']);
  const nucleos = numInt(specs['Cantidad de núcleos']);
  const hilos = numInt(specs['Cantidad de hilos']);
  const frecuencia = numFloat(specs['Frecuencia máxima']);
  const descModelo = (specs['Descripción del modelo'] || nombre || '').toLowerCase();
  const graficaIntegrada = /integrad|radeon|graphics|uhd|vega/.test(descModelo);

  const data = {};
  if (socket) data.socket = socket;
  if (tdp != null) data.tdp_watts = tdp;
  if (nucleos != null) data.nucleos = nucleos;
  if (hilos != null) data.hilos = hilos;
  if (frecuencia != null) data.frecuencia_ghz = frecuencia;
  data.grafica_integrada = graficaIntegrada;
  return { data, socket };
}

// Procesa un lote de CPUs con UNA pagina (un "worker").
async function worker(context, cola, contador) {
  const page = await context.newPage();
  while (cola.length > 0) {
    const cpu = cola.pop();
    if (!cpu) break;
    const url = cpu.ofertas[0]?.url;
    let specs = {};
    if (url) {
      try { specs = await extraerSpecs(page, url); }
      catch (e) { /* seguimos con lo que haya (socket del nombre) */ }
    }
    const { data, socket } = mapearCpu(specs, cpu.nombre);
    try {
      await prisma.cpus.update({ where: { id: cpu.id }, data });
      contador.ok++;
      console.log(`   OK [${contador.ok}] socket=${socket || '?'} tdp=${data.tdp_watts ?? '?'}  ${cpu.nombre.slice(0, 55)}`);
    } catch (e) {
      contador.err++;
      console.error(`   ! ${cpu.nombre}: ${e.message}`);
    }
  }
  await page.close();
}

async function main() {
  console.log('>>> Rellenando specs de CPUs (paralelo)');

  // TODAS las CPUs (para rellenar los campos que falten, no solo las PENDIENTE).
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
  // Solo bloqueamos imagenes y fuentes (el CSS se deja para no romper el acordeon).
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