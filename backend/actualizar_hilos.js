

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
  const ruta = process.argv[2] || 'cpus_hilos.csv';
  if (!fs.existsSync(ruta)) { console.error('No existe el fichero:', ruta); process.exit(1); }

  const filas = parseCSV(fs.readFileSync(ruta, 'utf8'));
  const cab = filas.shift().map((h) => h.toLowerCase());
  const col = (...n) => { for (const x of n) { const i = cab.indexOf(x); if (i > -1) return i; } return -1; };
  const iId = col('id');
  const iHilos = col('hilos', 'threads');
  if (iId === -1 || iHilos === -1) { console.error('El CSV necesita columnas "id" e "hilos"'); process.exit(1); }

  let ok = 0, vacias = 0, err = 0;
  for (const fila of filas) {
    const id = parseInt(fila[iId]);
    const hilos = parseInt(fila[iHilos]);
    if (isNaN(id)) continue;
    if (isNaN(hilos)) { vacias++; continue; }          // hilos vacio (REVISAR) -> se salta
    if (hilos < 1 || hilos > 256) { vacias++; continue; } // valor absurdo -> se salta
    try {
      await prisma.cpus.update({ where: { id }, data: { hilos } });
      ok++;
    } catch (e) {
      err++;
      console.error(`   ! id=${id}: ${e.message}`);
    }
  }
  console.log(`\n>>> Hilos actualizados: ${ok} | Sin valor (saltadas): ${vacias} | Errores: ${err}`);
  await prisma.$disconnect();
}
main();