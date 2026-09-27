// actualizar_gpus_csv.js
// Actualiza longitud_mm y watts_recomendados de las GPUs a partir de un CSV.
// El CSV casa por NOMBRE con la tabla componentes (tipo='gpu') para obtener el id.
//
// CSV esperado (cabecera):  gpu,longitud_mm,watts_recomendados
// Uso:  node actualizar_gpus_csv.js gpus_longitud_watts_recomendados_3_columnas.csv

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parser CSV simple (respeta comillas y comas dentro de campos entrecomillados).
function parseCSV(texto) {
  const filas = [];
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/); // quita BOM
  for (const linea of lineas) {
    if (!linea.trim()) continue;
    const campos = [];
    let cur = '', dentro = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') { dentro = !dentro; continue; }
      if (ch === ',' && !dentro) { campos.push(cur); cur = ''; continue; }
      cur += ch;
    }
    campos.push(cur);
    filas.push(campos.map((c) => c.trim()));
  }
  return filas;
}

// Normaliza un nombre para comparar (sin acentos, minusculas, espacios colapsados).
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

async function main() {
  const ruta = process.argv[2] || 'gpus_longitud_watts_recomendados_3_columnas.csv';
  if (!fs.existsSync(ruta)) { console.error('No existe el fichero:', ruta); process.exit(1); }

  const filas = parseCSV(fs.readFileSync(ruta, 'utf8'));
  const cabecera = filas.shift(); // descarta cabecera
  console.log(`>>> ${filas.length} filas en el CSV`);

  // Cargar todas las GPUs de la BD e indexarlas por nombre normalizado.
  const gpus = await prisma.componentes.findMany({ where: { tipo: 'gpu' }, select: { id: true, nombre: true } });
  const indice = new Map();
  for (const g of gpus) indice.set(norm(g.nombre), g.id);
  console.log(`>>> ${gpus.length} GPUs en la BD`);

  let ok = 0, noEncontradas = 0, sinDatos = 0;
  const faltan = [];

  for (const [nombre, longStr, wattStr] of filas) {
    const id = indice.get(norm(nombre));
    if (id == null) { noEncontradas++; faltan.push(nombre); continue; }

    const longitud = Math.round(parseFloat((longStr || '').replace(',', '.')));
    const watts = Math.round(parseFloat((wattStr || '').replace(',', '.')));

    const data = {};
    if (!isNaN(longitud)) data.longitud_mm = longitud;
    if (!isNaN(watts)) data.watts_recomendados = watts;
    if (Object.keys(data).length === 0) { sinDatos++; continue; }

    try {
      await prisma.gpus.update({ where: { id }, data });
      ok++;
    } catch (e) {
      console.error(`   ! id=${id} (${nombre}): ${e.message}`);
    }
  }

  console.log(`\n>>> Actualizadas: ${ok} | No encontradas por nombre: ${noEncontradas} | Sin datos: ${sinDatos}`);
  if (faltan.length) {
    console.log('\n--- Nombres del CSV que NO casaron con la BD (revisar) ---');
    faltan.slice(0, 30).forEach((n) => console.log('   ', n));
    if (faltan.length > 30) console.log(`   ...y ${faltan.length - 30} mas`);
  }

  await prisma.$disconnect();
}

main();