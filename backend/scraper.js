const { chromium } = require('playwright');

const BASE = 'https://www.coolmod.com';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toAbsolute(href) {
  if (!href || typeof href !== 'string') return null;
  const limpio = href.trim();
  if (!limpio) return null;
  try {
    return new URL(limpio, BASE).href;
  } catch (e) {
    return null;
  }
}

async function scrapeListado(page, url) {
  console.log('>>> Navegando a:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Espera a que aparezcan las tarjetas (la web puede tardar en pintarlas).
  try {
    await page.waitForSelector('.product-card', { timeout: 15000 });
  } catch (e) {
    console.warn('>>> No aparecieron .product-card en 15s (puede ser bloqueo o pagina distinta).');
  }

  
  const productos = await page.$$eval('.product-card', (cards, BASE) => {
    const abs = (href) => {
      if (!href) return null;
      try { return new URL(href, BASE).href; } catch { return null; }
    };
    return cards.map((card) => {
      const a = card.querySelector('a[data-itemname]');
      const titA = card.querySelector('.card-title a');
      const img = card.querySelector('figure img');

      const nombre = (a?.getAttribute('data-itemname') || titA?.textContent || '').trim() || null;
      const precio = parseFloat(a?.getAttribute('data-itemprice')) || null;
      const precioSinIva = parseFloat(a?.getAttribute('data-itempricetaxexc')) || null;
      const marca = a?.getAttribute('data-itembrand') || null;
      const categoria = a?.getAttribute('data-itemcategory2') || null;
      const itemId = a?.getAttribute('data-itemid') || null;
      const codigo = card.getAttribute('data-code') || null;
      const enlace = abs(a?.getAttribute('href') || titA?.getAttribute('href'));
      const imagen = abs(img?.getAttribute('src'));

      return { codigo, itemId, nombre, marca, categoria, precio, precioSinIva, enlace, imagen };
    }).filter((p) => p.nombre && p.enlace);
  }, BASE);

  return productos;
}

async function main() {
  console.log('>>> El script ha arrancado (Playwright)');

  const urlCategoria = 'https://www.coolmod.com/componentes-pc-procesadores/';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    locale: 'es-ES',
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();

  try {
    const productos = await scrapeListado(page, urlCategoria);
    console.log('>>> Productos encontrados:', productos.length, '\n');
    console.log(JSON.stringify(productos.slice(0, 5), null, 2));
  } catch (err) {
    console.error('>>> ERROR:', err.message);
  } finally {
    await browser.close();
  }
}

main();

module.exports = { scrapeListado };