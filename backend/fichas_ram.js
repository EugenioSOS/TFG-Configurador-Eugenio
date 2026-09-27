// fichas_ram.js
// Rellena la tabla ram a partir del NOMBRE del componente (que ya contiene todo).
// No hace falta navegador: los datos de RAM estan en el propio nombre.
// Campos: tipo (DDR4/DDR5), capacidad_gb, modulos, frecuencia_mhz.
//
// Uso:  node fichas_ram.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Extrae tipo, frecuencia, modulos y capacidad total del nombre.
function parseRam(nombre) {
  if (!nombre) return {};
  const n = nombre.replace(/\s+/g, ' ');

  const fMatch = n.match(/(\d{3,5})\s*MHz/i);
  const frecuencia = fMatch ? parseInt(fMatch[1]) : null;

  // Tipo: los nombres de Coolmod no suelen traer "DDR4/DDR5" literal.
  // Se deduce: DDR explicito > EXPO (solo existe en DDR5) > por frecuencia (>=4800 = DDR5).
  let tipoNorm = null;
  const ddr = n.match(/DDR\d/i);
  if (ddr) tipoNorm = ddr[0].toUpperCase();
  else if (/EXPO/i.test(n)) tipoNorm = 'DDR5';
  else if (frecuencia != null) tipoNorm = frecuencia >= 4800 ? 'DDR5' : 'DDR4';

  let modulos = null, capacidad = null;
  const kit = n.match(/(\d+)\s*x\s*(\d+)\s*GB/i);   // "2x16GB"
  if (kit) {
    modulos = parseInt(kit[1]);
    capacidad = parseInt(kit[1]) * parseInt(kit[2]);
  } else {
    const cap = n.match(/(\d+)\s*GB/i);             // solo "16GB"
    if (cap) capacidad = parseInt(cap[1]);
  }

  return { tipo: tipoNorm, frecuencia, modulos, capacidad };
}

async function main() {
  console.log('>>> Rellenando specs de RAM desde el nombre');

  const rams = await prisma.componentes.findMany({ where: { tipo: 'ram' } });
  console.log(`>>> ${rams.length} memorias RAM`);

  let ok = 0, incompletas = 0;
  for (const r of rams) {
    const p = parseRam(r.nombre);

    const data = {};
    if (p.tipo) data.tipo = p.tipo;                 // columna NOT NULL: siempre intentamos
    if (p.capacidad != null) data.capacidad_gb = p.capacidad;
    if (p.modulos != null) data.modulos = p.modulos;
    if (p.frecuencia != null) data.frecuencia_mhz = p.frecuencia;

    // 'tipo' es NOT NULL en la tabla ram: si no se detecta, valor temporal.
    const dataCreate = Object.assign({ id: r.id, tipo: data.tipo || 'PENDIENTE' }, data);

    try {
      // upsert: actualiza si la fila existe, la crea si no (p.ej. tras borrar la tabla).
      await prisma.ram.upsert({
        where: { id: r.id },
        update: data,
        create: dataCreate,
      });
      ok++;
      const faltan = !p.tipo || p.capacidad == null;
      if (faltan) incompletas++;
      console.log(`   ${faltan ? '~~' : 'OK'}  ${p.tipo || '?'} ${p.capacidad ?? '?'}GB ${p.modulos ?? '?'}mod ${p.frecuencia ?? '?'}MHz  <- ${r.nombre.slice(0, 45)}`);
    } catch (e) {
      console.error(`   !  ${r.nombre}: ${e.message}`);
    }
  }

  console.log(`\n>>> Actualizadas: ${ok} | Incompletas (revisar nombre): ${incompletas}`);
  await prisma.$disconnect();
}

main();