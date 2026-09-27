// aplanar.js
// Convierte un componente de la BD (base + tabla de tipo + ofertas) en el objeto
// plano que espera el motor de compatibilidad: { nombre, tipo, precio, ...specs }.

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
  return Object.assign(
    {
      id: componente.id,
      nombre: componente.nombre,
      tipo: componente.tipo,
      marca: componente.marca,
      imagen_url: componente.imagen_url,
      precio: oferta ? Number(oferta.precio) : null,
      url: oferta ? oferta.url : null,
    },
    specs   // socket, tdp_watts, formato, longitud_mm, etc.
  );
}

module.exports = { aplanar, INCLUDE_COMPLETO, RELACION_TIPO };