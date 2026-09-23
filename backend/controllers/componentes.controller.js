
const prisma = require('../db');

// GET /api/componentes?tipo=cpu&pagina=1&porPagina=20
async function listarComponentes(req, res) {
  try {
    const { tipo } = req.query;
    const pagina = Math.max(parseInt(req.query.pagina) || 1, 1);
    const porPagina = Math.min(parseInt(req.query.porPagina) || 20, 100);

    const where = tipo ? { tipo } : {};

    const [total, componentes] = await Promise.all([
      prisma.componentes.count({ where }),
      prisma.componentes.findMany({
        where,
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        orderBy: { id: 'asc' },
        include: {
          ofertas: {
            include: { tiendas: true },
            orderBy: { precio: 'asc' },
          },
        },
      }),
    ]);

    res.json({
      total,
      pagina,
      porPagina,
      totalPaginas: Math.ceil(total / porPagina),
      datos: componentes,
    });
  } catch (err) {
    console.error('Error listarComponentes:', err);
    res.status(500).json({ error: 'Error al listar componentes' });
  }
}


async function obtenerComponente(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Id no valido' });

    const componente = await prisma.componentes.findUnique({
      where: { id },
      include: {
        ofertas: { include: { tiendas: true }, orderBy: { precio: 'asc' } },
        // Relaciones 1-a-1 con las tablas de tipo (Prisma las nombra segun tu schema):
        cpus: true, gpus: true, placas: true, ram: true,
        almacenamiento: true, fuentes: true, refrigeracion: true, cajas: true,
      },
    });

    if (!componente) return res.status(404).json({ error: 'Componente no encontrado' });
    res.json(componente);
  } catch (err) {
    console.error('Error obtenerComponente:', err);
    res.status(500).json({ error: 'Error al obtener el componente' });
  }
}


async function listarTipos(req, res) {
  try {
    const grupos = await prisma.componentes.groupBy({
      by: ['tipo'],
      _count: { _all: true },
      orderBy: { tipo: 'asc' },
    });
    res.json(grupos.map((g) => ({ tipo: g.tipo, total: g._count._all })));
  } catch (err) {
    console.error('Error listarTipos:', err);
    res.status(500).json({ error: 'Error al listar tipos' });
  }
}

module.exports = { listarComponentes, obtenerComponente, listarTipos };