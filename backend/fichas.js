const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CONCURRENCIA = 6;   // fichas en paralelo (sube/baja segun tu maquina y la web)

// ---- parseo texto libre -> valor limpio ----
const numInt = (t) => { if (!t) return null; const m = t.replace(/\./g, '').match(/\d+/); return m ? parseInt(m[0]) : null; };
const numFloat = (t) => { if (!t) return null; const m = t.replace(',', '.').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };

// Socket desde el nombre: coge lo que va justo detras de "Socket".
// Forma canonica del socket: AMD sin prefijo (AM5), Intel solo numero (1700).
function normSocket(v) {
  if (!v) return null;
  let s = v.toUpperCase().replace(/\s+/g, '');
  s = s.replace(/AMD|INTEL/g, '');    // quita marcas: "AMD AM5"/"INTEL LGA1200" -> "AM5"/"LGA1200"
  s = s.replace(/(FC)?LGA/, '');      // quita LGA/FCLGA este donde este -> solo el numero en Intel
  return s || null;
}

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
    if (clave === '__texto') continue;
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

  // Abrir TODOS los acordeones: su contenido (TDP, nucleos...) esta oculto hasta
  // desplegarlos, y document.innerText no lee lo oculto. Marcamos el checkbox
  // (DaisyUI) y ademas hacemos clic en los titulos, por si acaso.
  try {
    await page.evaluate(() => document.querySelectorAll('.collapse input[type="checkbox"]')
      .forEach((cb) => { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }));
    const titulos = page.locator('.collapse-title');
    const nt = await titulos.count();
    for (let i = 0; i < nt; i++) await titulos.nth(i).click({ timeout: 800 }).catch(() => {});
  } catch (e) { /* si no hay acordeones, seguimos */ }
  await page.waitForTimeout(600);

  // Leer los pares <li><strong>Clave</strong>: valor</li> + los campos rapidos
  // (font-bold + span title), que es donde Coolmod pone "Cores", "GPU Integrada"...
  return page.evaluate(() => {
    const out = {};
    // a) lista del acordeon
    for (const li of document.querySelectorAll('li')) {
      const strong = li.querySelector('strong');
      if (!strong) continue;
      const txt = li.textContent || '';
      if (/Duraci..n m..xima|Tipo: Cookie|Almacenamiento Local|proveedor|IndexedDB/i.test(txt)) continue;
      if (txt.length > 300) continue;
      const clave = strong.textContent.replace(':', '').trim();
      const valor = txt.replace(strong.textContent, '').replace(/^[:\s]+/, '').trim();
      if (clave && valor) out[clave] = valor;
    }
    // b) campos rapidos
    const labels = Array.from(document.querySelectorAll('div')).filter((d) => d.className.includes('font-bold'));
    for (const lab of labels) {
      const et = lab.textContent.trim();
      const span = lab.parentElement && lab.parentElement.querySelector('span[title]');
      if (span && et && !out[et]) out[et] = (span.getAttribute('title') || span.textContent).trim();
    }
    // c) texto completo (para datos que vienen en prosa, p.ej. "TDP de 150W")
    out.__texto = (document.body.innerText || '').replace(/\s+/g, ' ');
    return out;
  });
}

function mapearCpu(specs, nombre) {
  const socket = normSocket(buscarSpec(specs, 'socket') || socketDesdeNombre(nombre));
  let tdp = numInt(buscarSpec(specs, 'consumo', 'tdp') || buscarSpec(specs, 'tdp'));
  if (tdp == null && specs.__texto) {
    // TDP en prosa: "TDP 65 W", "TDP: 125 vatios", "TDP de 150W"...
    // Acepta separador opcional (de/:/espacio) y unidad W o "vatios".
    const m = specs.__texto.match(/TDP\s*(?:de|:)?\s*(\d{2,3})\s*(?:W\b|vatios|watts?)/i);
    if (m) tdp = parseInt(m[1]);
  }
  const descModelo = (buscarSpec(specs, 'descripcion', 'modelo') || nombre || '').toLowerCase();

  // Nucleos: varias etiquetas + respaldo en la descripcion ("8-core" / "8 nucleos").
  let nucleos = numInt(buscarSpec(specs, 'cores'))            // campo rapido "Cores"
    || numInt(buscarSpec(specs, 'cantidad', 'nucleos'))
    || numInt(buscarSpec(specs, 'nucleos'))
    || numInt(buscarSpec(specs, 'numero', 'nucleos'));
  if (nucleos == null) {
    const m = descModelo.match(/(\d{1,2})\s*[- ]?\s*(core|nucleo|nucleos)/i);
    if (m) nucleos = parseInt(m[1]);
  }

  // Hilos: varias etiquetas + respaldo en la descripcion ("16 threads/hilos").
  let hilos = numInt(buscarSpec(specs, 'cantidad', 'hilos'))
    || numInt(buscarSpec(specs, 'hilos'))
    || numInt(buscarSpec(specs, 'threads'))
    || numInt(buscarSpec(specs, 'subprocesos'));
  if (hilos == null) {
    const m = descModelo.match(/(\d{1,3})\s*(threads|hilos|subprocesos)/i);
    if (m) hilos = parseInt(m[1]);
  }

  const frecuencia = numFloat(buscarSpec(specs, 'frecuencia', 'maxima')) || frecuenciaDesdeNombre(nombre);
  const tipoRam = tipoRamDesde(buscarSpec(specs, 'memoria', 'compatible') || buscarSpec(specs, 'soporte', 'memoria'));
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