

const prisma = require('./db');
const { analizarBuild } = require('./compatibilidad');
const { aplanar, INCLUDE_COMPLETO } = require('./aplanar_datos');
const { cumpleFiltros } = require('./preferencias');

const REPARTO = {
  juegos:    { cpu: 0.24, gpu: 0.30, placa: 0.10, ram: 0.10, almacenamiento: 0.08, fuente: 0.07, caja: 0.06, refrigeracion: 0.05 },
  diseno:    { cpu: 0.30, gpu: 0.10, placa: 0.10, ram: 0.20, almacenamiento: 0.16, fuente: 0.05, caja: 0.05, refrigeracion: 0.04 },
  ofimatica: { cpu: 0.34, gpu: 0.00, placa: 0.16, ram: 0.16, almacenamiento: 0.16, fuente: 0.08, caja: 0.06, refrigeracion: 0.04 },
};

const GAMAS = { economica: 0.75, equilibrada: 1.0 };

async function cargarTipo(tipo) {
  const comps = await prisma.componentes.findMany({ where: { tipo }, include: INCLUDE_COMPLETO });
  return comps.map(aplanar).filter((c) => c.precio != null);   // solo con precio
}

function elegir(lista, tope, filtro = () => true) {
  const validas = lista.filter(filtro);
  if (validas.length === 0) return null;
  const dentro = validas.filter((c) => c.precio <= tope).sort((a, b) => b.precio - a.precio);
  if (dentro.length) return dentro[0];
  return validas.sort((a, b) => a.precio - b.precio)[0];
}

function norm(s) { return (s || '').toUpperCase().replace(/\s+/g, '').replace(/^LGA/, ''); }


function armarBuild(cat, uso, presupuesto, factorGama, filtros = {}) {
  const catF = {};
  for (const tipo of Object.keys(cat)) {
    const filtradas = cat[tipo].filter((pz) => cumpleFiltros(pz, tipo, filtros));
    catF[tipo] = filtradas.length > 0 ? filtradas : cat[tipo];
  }
  cat = catF;
  const rep = REPARTO[uso] || REPARTO.juegos;
  const tope = (pieza) => presupuesto * (rep[pieza] || 0) * factorGama;
  const socketsConPlaca = new Set(cat.placa.map((p) => norm(p.socket)));
  const cpu = elegir(cat.cpu, tope('cpu'), (c) => socketsConPlaca.has(norm(c.socket)))|| elegir(cat.cpu, tope('cpu'));  
  const placa = elegir(cat.placa, tope('placa'), (p) => !cpu || norm(p.socket) === norm(cpu.socket));
  const ddrRam = (r) => r.tipo_spec || r.tipo;   // respaldo por compatibilidad
  const casaRam = (r) => !placa || !placa.tipo_ram || !ddrRam(r) || placa.tipo_ram.toUpperCase() === ddrRam(r).toUpperCase();
  const ram = elegir(cat.ram, tope('ram'), casaRam)  || elegir(cat.ram, tope('ram')) || (cat.ram.length ? cat.ram.slice().sort((a, b) => a.precio - b.precio)[0] : null); 
  const necesitaGpu = rep.gpu > 0 || (cpu && cpu.grafica_integrada === false);
  const gpuConWatts = cat.gpu.filter((g) => g.watts_recomendados != null);
  const catGpu = gpuConWatts.length > 0 ? gpuConWatts : cat.gpu;   
  const gpu = necesitaGpu ? elegir(catGpu, tope('gpu')) : null;
  const almacenamiento = elegir(cat.almacenamiento, tope('almacenamiento'));
  const caja = elegir(cat.caja, tope('caja'),
    (c) => !placa || !placa.formato || (c.formatos_admitidos || []).includes(placa.formato));
  const refrigeracion = elegir(cat.refrigeracion, tope('refrigeracion'),
    (r) => !cpu || !(r.socket_compat && r.socket_compat.length) || r.socket_compat.map(norm).includes(norm(cpu.socket)));
  const consumo = (cpu?.tdp_watts || 0) + (gpu?.tdp_watts || 0);
  const wattsMin = Math.max(Math.ceil((consumo * 1.4) / 50) * 50, gpu?.watts_recomendados || 0, 400);
  const fuente = elegir(cat.fuente, tope('fuente'), (f) => (f.watts || 0) >= wattsMin)
    || elegir(cat.fuente, tope('fuente'));  
  const build = { cpu, placa, ram, gpu, almacenamiento, caja, refrigeracion, fuente, uso, presupuesto };
  const analisis = analizarBuild(build);
  const total = ['cpu', 'placa', 'ram', 'gpu', 'almacenamiento', 'caja', 'refrigeracion', 'fuente']
    .reduce((s, k) => s + (build[k]?.precio || 0), 0);

  return { piezas: build, total: Number(total.toFixed(2)), ...analisis };
}

// Genera las 3 gamas.
async function generar(uso, presupuesto, filtros = {}) {
  const tipos = ['cpu', 'placa', 'ram', 'gpu', 'almacenamiento', 'caja', 'refrigeracion', 'fuente'];
  const cargados = await Promise.all(tipos.map(cargarTipo));
  const cat = {};
  tipos.forEach((t, i) => { cat[t] = cargados[i]; });

  const builds = {};
  for (const [nombreGama, factor] of Object.entries(GAMAS)) {
    builds[nombreGama] = armarBuild(cat, uso, Number(presupuesto), factor, filtros);
  }
  return builds;
}

module.exports = { generar };