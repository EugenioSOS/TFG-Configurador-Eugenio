// actualizar_tdp_csv.js
// Rellena el TDP (tdp_watts) de las CPU desde el CSV (cpus_tdp.csv).
// Casa por id. Salta las filas con tdp vacio (REVISAR) o fuera de rango.
//
// CSV esperado (cabecera): id,nombre,nucleos,tdp,nota   (solo usa id y tdp)
// Uso:  node actualizar_tdp_csv.js cpus_tdp.csv

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseCSV(texto) {
  const filas = [];
  for (const linea of texto.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!linea.trim()) continue;
    const campos = []; let cur = '', dentro = false;
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

async function main() {
  const ruta = process.argv[2] || 'cpus_tdp.csv';
  if (!fs.existsSync(ruta)) { console.error('No existe el fichero:', ruta); process.exit(1); }

  const filas = parseCSV(fs.readFileSync(ruta, 'utf8'));
  const cab = filas.shift().map((h) => h.toLowerCase());
  const col = (...n) => { for (const x of n) { const i = cab.indexOf(x); if (i > -1) return i; } return -1; };
  const iId = col('id');
  const iTdp = col('tdp', 'tdp_watts');
  if (iId === -1 || iTdp === -1) { console.error('El CSV necesita columnas "id" y "tdp"'); process.exit(1); }

  let ok = 0, vacias = 0, err = 0;
  for (const fila of filas) {
    const id = parseInt(fila[iId]);
    const tdp = parseInt(fila[iTdp]);
    if (isNaN(id)) continue;
    if (isNaN(tdp)) { vacias++; continue; }
    if (tdp < 10 || tdp > 400) { vacias++; continue; }  // fuera de rango razonable
    try {
      await prisma.cpus.update({ where: { id }, data: { tdp_watts: tdp } });
      ok++;
    } catch (e) {
      err++;
      console.error(`   ! id=${id}: ${e.message}`);
    }
  }
  console.log(`\n>>> TDP actualizados: ${ok} | Sin valor (saltadas): ${vacias} | Errores: ${err}`);
  await prisma.$disconnect();
}
main();