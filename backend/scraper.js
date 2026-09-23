const { chromium } = require('playwright');
const { guardarProductos, prisma } = require('./guardar');

const BASE = 'https://www.coolmod.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================
//  MAPEO DE CATEGORIAS -> TIPO
//  Rellena cada 'slug' con la parte final de la URL en Coolmod.
//  (procesadores esta confirmado; el resto AJUSTALOS con las URLs reales)
//  Si una categoria tiene VARIAS URLs (p.ej. SSD y HDD -> almacenamiento),
//  añade varias entradas con el mismo 'tipo'.
// ============================================================
const CATEGORIAS = [
  { tipo: 'cpu',            slug: 'componentes-pc-procesadores' },
  { tipo: 'gpu',            slug: 'tarjetas-graficas' },
  { tipo: 'placa',          slug: 'componentes-pc-placas-base' },
  { tipo: 'ram',            slug: 'componentes-pc-memorias-ram' },
  { tipo: 'almacenamiento', slug: 'componentes-pc-discos-duros' },
  { tipo: 'fuente',         slug: 'componentes-pc-fuentes-alimentacion' },
  { tipo: 'refrigeracion',  slug: 'componentes-pc-disipadores-ventiladores' },
  { tipo: 'caja',           slug: 'componentes-pc-torres-cajas' },
];

function urlDePagina(urlBase, n) {
  if (n === 1) return urlBase;
  return `${urlBase}?pagina=${n}`;
}

async function scrapePagina(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  try {
    await page.waitForSelector('.product-card', { timeout: 12000 });
  } catch (e) {
    return [];
  }
  return page.$$eval('.product-card', (cards, BASE) => {
    const abs = (href) => { if (!href) return null; try { return new URL(href, BASE).href; } catch { return null; } };
    return cards.map((card) => {
      const a = card.querySelector('a[data-itemname]');
      const titA = card.querySelector('.card-title a');
      const img = card.querySelector('figure img');
      const nombre = (a?.getAttribute('data-itemname') || titA?.textContent || '').trim() || null;
      return {
        codigo: card.getAttribute('data-code') || null,
        itemId: a?.getAttribute('data-itemid') || null,
        nombre,
        marca: a?.getAttribute('data-itembrand') || null,
        categoria: a?.getAttribute('data-itemcategory2') || null,
        precio: parseFloat(a?.getAttribute('data-itemprice')) || null,
        precioSinIva: parseFloat(a?.getAttribute('data-itempricetaxexc')) || null,
        enlace: abs(a?.getAttribute('href') || titA?.getAttribute('href')),
        imagen: abs(img?.getAttribute('src')),
      };
    }).filter((p) => p.nombre && p.enlace);
  }, BASE);
}

async function scrapeCategoria(page, urlBase, maxPaginas = 50) {
  const todos = [];
  let ultimaFirma = null;
  for (let n = 1; n <= maxPaginas; n++) {
    const url = urlDePagina(urlBase, n);
    console.log(`   pagina ${n}: ${url}`);
    const productos = await scrapePagina(page, url);
    console.log(`      -> ${productos.length} productos`);
    if (productos.length === 0) break;
    const firma = productos.map((p) => p.codigo).join(',');
    if (firma === ultimaFirma) { console.log('      -> pagina repetida, fin.'); break; }
    ultimaFirma = firma;
    todos.push(...productos);
    await sleep(1500);
  }
  return todos;
}

async function main() {
  console.log('>>> Scraper Coolmod - TODAS las categorias');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    locale: 'es-ES',
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  try {
    for (const cat of CATEGORIAS) {
      const urlBase = `${BASE}/${cat.slug}/`;
      console.log(`\n=== Categoria: ${cat.tipo} (${cat.slug}) ===`);
      const productos = await scrapeCategoria(page, urlBase);
      console.log(`   TOTAL ${cat.tipo}: ${productos.length}`);
      if (productos.length > 0) {
        await guardarProductos(productos, cat.tipo);   // guarda en BD con su tipo
      }
    }
  } catch (err) {
    console.error('>>> ERROR:', err.message);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main();

module.exports = { scrapeCategoria, scrapePagina };