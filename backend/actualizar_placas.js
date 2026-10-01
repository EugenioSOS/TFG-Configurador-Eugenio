

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseCSV(texto) {
  const filas = [];
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const linea of lineas) {
    if (!linea.trim()) continue;
    const campos = [];
    let cur = '', dentro = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') { dentro = !dentro; continue; }
      if ((ch === ',' || ch === ';') && !dentro) { campos.push(cur); cur = ''; continue; }
      cur += ch;
    }
    campos.push(cur);
    filas.push(campos.map((c) => c.trim()));
  }
  return filas;
}

// Normaliza formato y tipo_ram a los valores que usa el sistema.
function normFormato(v) {
  if (!v) return null;
  const t = v.toLowerCase();
  if (/e-?atx/.test(t)) return 'E-ATX';
  if (/micro|matx|m-atx/.test(t)) return 'Micro-ATX';
  if (/mini|itx/.test(t)) return 'Mini-ITX';
  if (/atx/.test(t)) return 'ATX';
  return v.trim();
}
function normRam(v) { if (!v) return null; const m = v.match(/DDR\d/i); return m ? m[0].toUpperCase() : null; }
function normSocket(v) {
  if (!v) return null;
  let s = v.replace(/AMD|Intel/ig, '').trim().toUpperCase().replace(/\s+/g, '');
  s = s.replace(/^(FC)?LGA/, '');   // Intel: quitar prefijo LGA/FCLGA -> solo numero
  return s || null;
}

async function main() {
  const ruta = process.argv[2] || 'placas.csv';
  if (!fs.existsSync(ruta)) { console.error('No existe el fichero:', ruta); process.exit(1); }

  const filas = parseCSV(fs.readFileSync(ruta, 'utf8'));
  const cabecera = filas.shift().map((h) => h.toLowerCase());
  // Acepta varios nombres de columna (CSV real: id, placa_base, ram_compatible, formato).
  const col = (...nombres) => { for (const n of nombres) { const i = cabecera.indexOf(n); if (i > -1) return i; } return -1; };
  const idx = {
    id: col('id'),
    nombre: col('placa_base', 'nombre'),
    socket: col('socket'),
    tipo_ram: col('tipo_ram', 'ram_compatible', 'ram'),
    formato: col('formato'),
  };
  if (idx.id === -1) { console.error('El CSV necesita una columna "id"'); process.exit(1); }

  let ok = 0, sinCambios = 0, err = 0;

  for (const fila of filas) {
    const id = parseInt(fila[idx.id]);
    if (isNaN(id)) continue;

    const data = {};
    const nombre = idx.nombre > -1 ? fila[idx.nombre] : '';
    // socket: de su columna si existe; si no, del nombre ("... Socket AM4" / "Socket 1700")
    let socket = idx.socket > -1 ? normSocket(fila[idx.socket]) : null;
    if (!socket && nombre) {
      const m = nombre.match(/socket\s+([A-Za-z]*\d+[A-Za-z0-9]*)/i);
      if (m) socket = normSocket(m[1]);
    }
    const ram = idx.tipo_ram > -1 ? normRam(fila[idx.tipo_ram]) : null;
    const formato = idx.formato > -1 ? normFormato(fila[idx.formato]) : null;

    // Solo actualiza lo que viene relleno y no es 'PENDIENTE'.
    if (socket && socket !== 'PENDIENTE') data.socket = socket;
    if (ram && ram !== 'PENDIENTE') data.tipo_ram = ram;
    if (formato && formato !== 'PENDIENTE') data.formato = formato;

    if (Object.keys(data).length === 0) { sinCambios++; continue; }

    try {
      await prisma.placas.update({ where: { id }, data });
      ok++;
      console.log(`   OK id=${id} ->`, data);
    } catch (e) {
      err++;
      console.error(`   ! id=${id}: ${e.message}`);
    }
  }

  console.log(`\n>>> Actualizadas: ${ok} | Sin datos nuevos: ${sinCambios} | Errores: ${err}`);
  await prisma.$disconnect();
}

main();