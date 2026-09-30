
const prisma = require('../db');
const { aplanar, INCLUDE_COMPLETO } = require('../aplanar_datos');

const TIPOS = ['cpu', 'placa', 'ram', 'gpu', 'almacenamiento', 'fuente', 'refrigeracion', 'caja'];

// POST /api/builds/guardar
// body: { nombre, uso, presupuesto, modo, componentes: { cpu: id, gpu: id, ... } }
async function guardarBuild(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const { nombre, uso, presupuesto, modo, componentes } = req.body || {};
    if (!componentes || Object.keys(componentes).length === 0)
      return res.status(400).json({ error: 'No hay componentes que guardar' });

    // uso y modo son ENUMS en Prisma: solo valores validos, o null.
    const USOS = ['juegos', 'diseno', 'ofimatica'];
    const usoValido = USOS.includes(uso) ? uso : null;
    // el front puede mandar 'avanzado'/'manual' -> lo mapeamos a 'detallado'
    let modoValido = null;
    if (modo === 'simple' || modo === 'auto') modoValido = 'simple';
    else if (modo === 'detallado' || modo === 'avanzado' || modo === 'manual') modoValido = 'detallado';

    const ids = TIPOS.map((t) => componentes[t]).filter(Boolean).map(Number);
    const comps = await prisma.componentes.findMany({
      where: { id: { in: ids } },
      include: { ofertas: { orderBy: { precio: 'asc' }, take: 1 } },
    });
    const precioPorId = {};
    comps.forEach((c) => { precioPorId[c.id] = c.ofertas[0] ? Number(c.ofertas[0].precio) : null; });

    const build = await prisma.builds.create({
      data: {
        usuario_id: usuarioId,
        nombre: nombre || `Build ${new Date().toLocaleDateString('es-ES')}`,
        uso: usoValido,
        presupuesto_objetivo: presupuesto ? Number(presupuesto) : null,
        modo: modoValido,
        build_componentes: {
          create: ids.map((id) => ({ componente_id: id, precio_en_creacion: precioPorId[id] })),
        },
      },
      include: { build_componentes: true },
    });

    res.status(201).json({ mensaje: 'Build guardada', id: build.id });
  } catch (err) {
    console.error('Error guardarBuild:', err);
    res.status(500).json({ error: 'Error al guardar la configuracion' });
  }
}

// GET /api/builds/mis-builds
async function misBuild(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const builds = await prisma.builds.findMany({
      where: { usuario_id: usuarioId },
      orderBy: { creado_en: 'desc' },
      include: {
        build_componentes: { include: { componentes: { include: INCLUDE_COMPLETO } } },
      },
    });

    const salida = builds.map((b) => {
      const piezas = b.build_componentes.map((bc) => {
        const comp = aplanar(bc.componentes);
        return {
          ...comp,
          precio_guardado: bc.precio_en_creacion != null ? Number(bc.precio_en_creacion) : null,
          precio_actual: comp ? comp.precio : null,
        };
      });
      const totalGuardado = piezas.reduce((s, p) => s + (p.precio_guardado || 0), 0);
      const totalActual = piezas.reduce((s, p) => s + (p.precio_actual || 0), 0);
      return {
        id: b.id,
        nombre: b.nombre,
        uso: b.uso,
        presupuesto: b.presupuesto_objetivo ? Number(b.presupuesto_objetivo) : null,
        modo: b.modo,
        creado_en: b.creado_en,
        total_guardado: Number(totalGuardado.toFixed(2)),
        total_actual: Number(totalActual.toFixed(2)),
        piezas,
      };
    });

    res.json(salida);
  } catch (err) {
    console.error('Error misBuild:', err);
    res.status(500).json({ error: 'Error al listar tus configuraciones' });
  }
}

// DELETE /api/builds/:id
async function borrarBuild(req, res) {
  try {
    const usuarioId = req.usuario.id;
    const id = Number(req.params.id);
    const build = await prisma.builds.findUnique({ where: { id } });
    if (!build || build.usuario_id !== usuarioId)
      return res.status(404).json({ error: 'Configuracion no encontrada' });

    await prisma.builds.delete({ where: { id } });
    res.json({ mensaje: 'Configuracion borrada' });
  } catch (err) {
    console.error('Error borrarBuild:', err);
    res.status(500).json({ error: 'Error al borrar la configuracion' });
  }
}

module.exports = { guardarBuild, misBuild, borrarBuild };