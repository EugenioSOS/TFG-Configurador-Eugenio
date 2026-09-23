const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COOLMOD = 'Coolmod';

// Minimos obligatorios (NOT NULL) de cada tabla de tipo, con valores temporales.
// Se sustituyen por los reales cuando scrapeemos las fichas.
const CREADORES_TIPO = {
  cpu:            (id) => prisma.cpus.create({ data: { id, socket: 'PENDIENTE' } }),
  gpu:            (id) => prisma.gpus.create({ data: { id } }),
  placa:          (id) => prisma.placas.create({ data: { id, socket: 'PENDIENTE', tipo_ram: 'PENDIENTE', formato: 'PENDIENTE' } }),
  ram:            (id) => prisma.ram.create({ data: { id, tipo: 'PENDIENTE', capacidad_gb: 0 } }),
  almacenamiento: (id) => prisma.almacenamiento.create({ data: { id, capacidad_gb: 0 } }),
  fuente:         (id) => prisma.fuentes.create({ data: { id, watts: 0 } }),
  refrigeracion:  (id) => prisma.refrigeracion.create({ data: { id } }),
  caja:           (id) => prisma.cajas.create({ data: { id, formatos_admitidos: [] } }),
};

async function obtenerTiendaCoolmod() {
  const tienda = await prisma.tiendas.upsert({
    where: { nombre: COOLMOD },
    update: {},
    create: { nombre: COOLMOD, web_url: 'https://www.coolmod.com' },
  });
  return tienda.id;
}

// Guarda UN producto de un tipo dado.
async function guardarProducto(prod, tipo, tiendaId) {
  const crearTipo = CREADORES_TIPO[tipo];
  if (!crearTipo) throw new Error(`Tipo no soportado: ${tipo}`);

  // 1) Componente base (buscar por nombre+tipo para no duplicar)
  const existente = await prisma.componentes.findFirst({
    where: { nombre: prod.nombre, tipo },
  });

  let componente;
  if (existente) {
    componente = await prisma.componentes.update({
      where: { id: existente.id },
      data: { marca: prod.marca, imagen_url: prod.imagen, actualizado_en: new Date() },
    });
  } else {
    componente = await prisma.componentes.create({
      data: { tipo, nombre: prod.nombre, marca: prod.marca, imagen_url: prod.imagen },
    });
    await crearTipo(componente.id);   // fila en la tabla de tipo con minimos
  }

  // 2) Oferta en Coolmod (precio + enlace)
  await prisma.ofertas.upsert({
    where: { componente_id_tienda_id: { componente_id: componente.id, tienda_id: tiendaId } },
    update: { precio: prod.precio, url: prod.enlace, disponible: true, actualizado_en: new Date() },
    create: { componente_id: componente.id, tienda_id: tiendaId, precio: prod.precio, url: prod.enlace },
  });

  // 3) Historico de precios
  if (prod.precio != null) {
    await prisma.precios_historico.create({
      data: { componente_id: componente.id, tienda_id: tiendaId, precio: prod.precio },
    });
  }

  return componente.id;
}

// Guarda una lista de productos de un mismo tipo.
async function guardarProductos(productos, tipo) {
  const tiendaId = await obtenerTiendaCoolmod();
  let ok = 0, err = 0;

  for (const prod of productos) {
    try {
      await guardarProducto(prod, tipo, tiendaId);
      ok++;
    } catch (e) {
      err++;
      console.error(`   ! Error guardando "${prod.nombre}" (${tipo}):`, e.message);
    }
  }

  console.log(`>>> [${tipo}] Guardados: ${ok} | Errores: ${err}`);
}

module.exports = { guardarProductos, prisma };