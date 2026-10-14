
function parsePreferencias(texto) {
  const filtros = {};
  const entendido = [];   
  if (!texto || !texto.trim()) return { filtros, entendido };

  const t = ' ' + texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.;:!?]/g, ' ').replace(/\s+/g, ' ') + ' ';

 
  const negada = (palabra) => {
    const re = new RegExp('\\b(no|nada|sin|evitar|excepto)\\b(\\s+\\w+){0,3}\\s+' + palabra + '\\b');
    return re.test(t);
  };
  const presente = (re) => re.test(t);

  if (presente(/\bintel\b/)) {
    if (negada('intel')) { filtros.marcaCpuExcluir = 'intel'; entendido.push('CPU: evitar Intel'); }
    else { filtros.marcaCpu = 'intel'; entendido.push('CPU: Intel'); }
  }
  
  // Cada aparicion de "amd" se clasifica como CPU o GPU segun la palabra que la
  // acompana: "gpu amd" / "amd radeon" -> GPU; "cpu amd" / "amd ryzen" -> CPU;
  // sin contexto -> CPU. Asi "gpu amd cpu intel" no se lee como CPU AMD.
  const PAL_GPU = /^(gpu|grafica|graficas|tarjeta|tarjetas|radeon|rx)$/;
  const PAL_CPU = /^(cpu|procesador|procesadores|ryzen)$/;
  let amdCpu = false, amdGpu = false;
  const palabras = t.trim().split(' ');
  palabras.forEach((w, i) => {
    if (w !== 'amd') return;
    const antes = palabras.slice(Math.max(0, i - 2), i);
    const despues = palabras[i + 1] || '';
    if (antes.some((x) => PAL_GPU.test(x))) amdGpu = true;
    else if (antes.some((x) => PAL_CPU.test(x))) amdCpu = true;
    else if (PAL_GPU.test(despues)) amdGpu = true;
    else amdCpu = true;
  });
  if (presente(/\bryzen\b/) || amdCpu) {
    if (negada('amd') || negada('ryzen')) { filtros.marcaCpuExcluir = 'amd'; entendido.push('CPU: evitar AMD'); }
    else { filtros.marcaCpu = 'amd'; entendido.push('CPU: AMD'); }
  }

  // --- Marca de GPU ---
  if (presente(/\bnvidia\b|\bgeforce\b|\brtx\b|\bgtx\b/)) {
    if (negada('nvidia') || negada('geforce') || negada('rtx') || negada('gtx')) { filtros.marcaGpuExcluir = 'nvidia'; entendido.push('GPU: evitar Nvidia'); }
    else { filtros.marcaGpu = 'nvidia'; entendido.push('GPU: Nvidia'); }
  }
  if (presente(/\bradeon\b/) || amdGpu) {
    if (negada('radeon') || negada('amd')) { filtros.marcaGpuExcluir = 'amd'; entendido.push('GPU: evitar AMD/Radeon'); }
    else { filtros.marcaGpu = 'amd'; entendido.push('GPU: AMD/Radeon'); }
  }

  // --- RAM minima (ej. "32gb", "al menos 16 gb") ---
  const mRam = t.match(/(\d{1,3})\s*gb/);
  if (mRam) { filtros.ramMinima = parseInt(mRam[1]); entendido.push(`RAM: minimo ${mRam[1]} GB`); }

  // --- DDR ---
  const mDdr = t.match(/ddr\s*([45])/);
  if (mDdr) { filtros.tipoRam = 'DDR' + mDdr[1]; entendido.push(`Memoria: DDR${mDdr[1]}`); }

  // --- Exclusiones por palabra en el nombre (ej. "sin rgb", "nada de wifi") ---
  const exclusiones = [];
  for (const kw of ['rgb', 'wifi', 'blanco', 'blanca']) {
    const re = new RegExp('(no|nada|sin)\\s+(de\\s+)?' + kw);
    if (re.test(t)) { exclusiones.push(kw); entendido.push(`Excluir: ${kw}`); }
  }
  if (exclusiones.length) filtros.excluirNombre = exclusiones;

  // --- Formato compacto ---
  if (/mini-?itx|compacto|peque/.test(t)) { filtros.formato = 'Mini-ITX'; entendido.push('Formato: Mini-ITX'); }

  return { filtros, entendido };
}

// Aplica los filtros a una pieza aplanada. Devuelve true si la pieza los cumple.
// 'tipo' es el tipo de componente ('cpu','gpu','ram','placa'...).
function cumpleFiltros(pieza, tipo, filtros) {
  if (!pieza || !filtros) return true;
  const nombre = (pieza.nombre || '').toLowerCase();
  const marca = (pieza.marca || '').toLowerCase();

  if (tipo === 'cpu') {
    if (filtros.marcaCpu && !marca.includes(filtros.marcaCpu) && !nombre.includes(filtros.marcaCpu)) return false;
    if (filtros.marcaCpuExcluir && (marca.includes(filtros.marcaCpuExcluir) || nombre.includes(filtros.marcaCpuExcluir))) return false;
  }
  if (tipo === 'gpu') {
    const esNvidia = /nvidia|geforce|rtx|gtx/.test(nombre);
    const esAmd = /radeon|\brx\s*\d/.test(nombre);
    if (filtros.marcaGpu === 'nvidia' && !esNvidia) return false;
    if (filtros.marcaGpu === 'amd' && !esAmd) return false;
    if (filtros.marcaGpuExcluir === 'nvidia' && esNvidia) return false;
    if (filtros.marcaGpuExcluir === 'amd' && esAmd) return false;
  }
  if (tipo === 'ram') {
    if (filtros.ramMinima && (pieza.capacidad_gb || 0) < filtros.ramMinima) return false;
    if (filtros.tipoRam && pieza.tipo_spec && pieza.tipo_spec.toUpperCase() !== filtros.tipoRam) return false;
  }
  if (tipo === 'placa' && filtros.formato) {
    if (pieza.formato && pieza.formato !== filtros.formato) return false;
  }
  if (tipo === 'caja' && filtros.formato) {
    if (pieza.formatos_admitidos && !pieza.formatos_admitidos.includes(filtros.formato)) return false;
  }

  if (filtros.excluirNombre) {
    for (const kw of filtros.excluirNombre) if (nombre.includes(kw)) return false;
  }

  return true;
}

module.exports = { parsePreferencias, cumpleFiltros };