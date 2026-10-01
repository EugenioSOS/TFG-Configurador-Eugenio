

// Mapa tipo -> nombre de la relacion 1-a-1 en Prisma (ajustar si tu schema difiere).
const RELACION_TIPO = {
  cpu: 'cpus', gpu: 'gpus', placa: 'placas', ram: 'ram',
  almacenamiento: 'almacenamiento', fuente: 'fuentes',
  refrigeracion: 'refrigeracion', caja: 'cajas',
};

// include para traer TODAS las tablas de tipo + ofertas de un componente.
const INCLUDE_COMPLETO = {
  ofertas: { include: { tiendas: true }, orderBy: { precio: 'asc' } },
  cpus: true, gpus: true, placas: true, ram: true,
  almacenamiento: true, fuentes: true, refrigeracion: true, cajas: true,
};

function aplanar(componente) {
  if (!componente) return null;
  const rel = RELACION_TIPO[componente.tipo];
  const specs = (rel && componente[rel]) ? componente[rel] : {};
  // precio = el menor de sus ofertas (ya vienen ordenadas asc)
  const oferta = componente.ofertas && componente.ofertas[0];
  // Las specs van PRIMERO; los campos del componente van DESPUES para que no los
  // pise una spec con el mismo nombre. Ojo: ram.tipo (DDR5) y almacenamiento.tipo
  // (SSD) chocaban con componente.tipo ('ram'/'almacenamiento') -> por eso el 'tipo'
  // final debe ser SIEMPRE el del componente.
  const plano = Object.assign({}, specs, {
    id: componente.id,
    nombre: componente.nombre,
    tipo: componente.tipo,                 // 'cpu','ram','almacenamiento'... (manda este)
    marca: componente.marca,
    imagen_url: componente.imagen_url,
    precio: oferta ? Number(oferta.precio) : null,
    url: oferta ? oferta.url : null,
  });
  // Conservar la spec 'tipo' (DDR5 / SSD NVMe) con otro nombre, por si se quiere mostrar.
  if (specs && specs.tipo !== undefined) plano.tipo_spec = specs.tipo;
  return plano;
}

module.exports = { aplanar, INCLUDE_COMPLETO, RELACION_TIPO };