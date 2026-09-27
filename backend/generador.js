

const prisma = require('./db');
const { analizarBuild } = require('./compatibilidad');
const { aplanar, INCLUDE_COMPLETO } = require('./aplanar_datos');

// Reparto del presupuesto (% por pieza) segun el uso. gpu=0 -> sin GPU dedicada.
const REPARTO = {
  juegos:    { cpu: 0.24, gpu: 0.30, placa: 0.10, ram: 0.10, almacenamiento: 0.08, fuente: 0.07, caja: 0.06, refrigeracion: 0.05 },
  diseno:    { cpu: 0.26, gpu: 0.16, placa: 0.10, ram: 0.16, almacenamiento: 0.14, fuente: 0.06, caja: 0.06, refrigeracion: 0.06 },
  ofimatica: { cpu: 0.34, gpu: 0.00, placa: 0.16, ram: 0.16, almacenamiento: 0.16, fuente: 0.08, caja: 0.06, refrigeracion: 0.04 },
};

// Factor de gama: económica coge piezas mas baratas, alta las mas caras dentro del %.
const GAMAS = { economica: 0.75, equilibrada: 1.0, alta: 1.3 };

// Carga y aplana todos los componentes de un tipo (con specs + precio).
async function cargarTipo(tipo) {
  const comps = await prisma.componentes.findMany({ where: { tipo }, include: INCLUDE_COMPLETO });
  return comps.map(aplanar).filter((c) => c.precio != null);   // solo con precio
}

// De una lista, elige la pieza mas cara que NO supere 'tope' y cumpla 'filtro'.
// Si ninguna cumple el tope, coge la mas barata que cumpla el filtro (para no quedarse sin pieza).
function elegir(lista, tope, filtro = () => true) {
  const validas = lista.filter(filtro);
  if (validas.length === 0) return null;
  const dentro = validas.filter((c) => c.precio <= tope).sort((a, b) => b.precio - a.precio);
  if (dentro.length) return dentro[0];
  return validas.sort((a, b) => a.precio - b.precio)[0];
}

function norm(s) { return (s || '').toUpperCase().replace(/\s+/g, '').replace(/^LGA/, ''); }

// Arma UNA build para un uso, presupuesto y gama.
function armarBuild(cat, uso, presupuesto, factorGama) {
  const rep = REPARTO[uso] || REPARTO.juegos;
  const tope = (pieza) => presupuesto * (rep[pieza] || 0) * factorGama;

  // 1) CPU
  const cpu = elegir(cat.cpu, tope('cpu'));
  // 2) Placa que case el socket de la CPU
  const placa = elegir(cat.placa, tope('placa'), (p) => !cpu || norm(p.socket) === norm(cpu.socket));
  // 3) RAM que case el tipo de la placa
  const ram = elegir(cat.ram, tope('ram'), (r) => !placa || (placa.tipo_ram && r.tipo && placa.tipo_ram.toUpperCase() === r.tipo.toUpperCase()));
  // 4) GPU (si el uso la lleva)
  const gpu = rep.gpu > 0 ? elegir(cat.gpu, tope('gpu')) : null;
  // 5) Almacenamiento
  const almacenamiento = elegir(cat.almacenamiento, tope('almacenamiento'));
  // 6) Caja que admita el formato de la placa
  const caja = elegir(cat.caja, tope('caja'), (c) => !placa || (c.formatos_admitidos || []).includes(placa.formato));
  // 7) Refrigeracion compatible con el socket (o sin lista de sockets)
  const refrigeracion = elegir(cat.refrigeracion, tope('refrigeracion'),
    (r) => !cpu || !(r.socket_compat && r.socket_compat.length) || r.socket_compat.map(norm).includes(norm(cpu.socket)));
  // 8) Fuente suficiente para el consumo estimado
  const consumo = (cpu?.tdp_watts || 0) + (gpu?.tdp_watts || 0);
  const wattsMin = Math.max(Math.ceil((consumo * 1.4) / 50) * 50, gpu?.watts_recomendados || 0, 400);
  const fuente = elegir(cat.fuente, tope('fuente'), (f) => (f.watts || 0) >= wattsMin)
    || elegir(cat.fuente, tope('fuente'));   // si ninguna llega, la mejor disponible

  const build = { cpu, placa, ram, gpu, almacenamiento, caja, refrigeracion, fuente, uso, presupuesto };
  const analisis = analizarBuild(build);
  const total = ['cpu', 'placa', 'ram', 'gpu', 'almacenamiento', 'caja', 'refrigeracion', 'fuente']
    .reduce((s, k) => s + (build[k]?.precio || 0), 0);

  return { piezas: build, total: Number(total.toFixed(2)), ...analisis };
}

// Genera las 3 gamas.
async function generar(uso, presupuesto) {
  const tipos = ['cpu', 'placa', 'ram', 'gpu', 'almacenamiento', 'caja', 'refrigeracion', 'fuente'];
  const cargados = await Promise.all(tipos.map(cargarTipo));
  const cat = {};
  tipos.forEach((t, i) => { cat[t] = cargados[i]; });

  const builds = {};
  for (const [nombreGama, factor] of Object.entries(GAMAS)) {
    builds[nombreGama] = armarBuild(cat, uso, Number(presupuesto), factor);
  }
  return builds;
}

module.exports = { generar };