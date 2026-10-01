const prisma = require('../db');
const { analizarBuild } = require('../compatibilidad');
const { aplanar, INCLUDE_COMPLETO } = require('../aplanar_datos');
const { generar } = require('../generador');
const { parsePreferencias } = require('../preferencias');

async function cargarComponente(id) {
  if (!id) return null;
  const comp = await prisma.componentes.findUnique({
    where: { id: Number(id) },
    include: INCLUDE_COMPLETO,
  });
  return aplanar(comp);
}

async function validarBuild(req, res) {
  try {
    const b = req.body || {};
    const claves = ['cpu', 'placa', 'ram', 'gpu', 'caja', 'fuente', 'refrigeracion', 'almacenamiento'];
    const cargadas = await Promise.all(claves.map((k) => cargarComponente(b[k])));

    const build = { presupuesto: b.presupuesto ? Number(b.presupuesto) : null, uso: b.uso || null };
    claves.forEach((k, i) => { build[k] = cargadas[i]; });

    const resultado = analizarBuild(build);
    const total = claves.reduce((s, k) => s + (build[k]?.precio || 0), 0);

    res.json({
      compatible: resultado.compatible,
      errores: resultado.errores,
      avisos: resultado.avisos,
      ok: resultado.ok,
      total: Number(total.toFixed(2)),
      piezas: build,
    });
  } catch (err) {
    console.error('Error validarBuild:', err);
    res.status(500).json({ error: 'Error al validar la configuracion' });
  }
}

async function generarBuild(req, res) {
  try {
    const { uso, presupuesto, preferencias } = req.body || {};
    if (!uso || !presupuesto)
      return res.status(400).json({ error: 'Faltan uso o presupuesto' });
    if (!['juegos', 'diseno', 'ofimatica'].includes(uso))
      return res.status(400).json({ error: "uso debe ser 'juegos', 'diseno' u 'ofimatica'" });

    const minimo = uso === 'ofimatica' ? 500 : 800;
    if (Number(presupuesto) < minimo)
      return res.status(400).json({ error: `El presupuesto minimo para ${uso} es ${minimo} €.` });

    const { filtros, entendido } = parsePreferencias(preferencias);
    const builds = await generar(uso, presupuesto, filtros);
    res.json({ uso, presupuesto: Number(presupuesto), builds, preferencias: entendido });
  } catch (err) {
    console.error('Error generarBuild:', err);
    res.status(500).json({ error: 'Error al generar la configuracion' });
  }
}

module.exports = { validarBuild, generarBuild, cargarComponente };