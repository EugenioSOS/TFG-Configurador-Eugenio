
// Motor de compatibilidad + presupuesto + idoneidad para el uso.
// Recibe una "build" (los componentes elegidos, ya con sus specs de la BD) y
// devuelve { errores, avisos, ok }.
//   - errores: incompatibilidades FISICAS -> impiden montar (bloqueante)
//   - avisos : presupuesto excedido / idoneidad / datos no verificables (no bloquea)
//   - ok     : comprobaciones superadas
//
// La build es un objeto: { cpu, placa, ram, gpu, caja, fuente, refrigeracion,
//                          almacenamiento, presupuesto, uso }  (cada pieza puede faltar)
// Cada pieza trae sus specs (las columnas de su tabla) + precio.

// --- helpers ---
function normSocket(s) { return (s || '').toUpperCase().replace(/\s+/g, '').replace(/^LGA/, ''); }
function mismoSocket(a, b) { return normSocket(a) && normSocket(a) === normSocket(b); }

// Clasifica la "gama" de una GPU por su nombre + precio (heuristica para idoneidad).
function gamaGpu(gpu) {
  const n = (gpu.nombre || '').toLowerCase();
  const precio = gpu.precio || 0;
  if (/quadro|rtx\s?pro|radeon\s?pro|\bpro\b w\d|nvidia t\d|tesla/i.test(n)) return 'profesional';
  if (/50 ?90|40 ?90|79 ?00 xtx|48 ?00/i.test(n) || precio >= 1500) return 'entusiasta';
  if (/50 ?80|50 ?70|40 ?80|40 ?70|90 ?70|77 ?00/i.test(n) || precio >= 700) return 'alta';
  if (/50 ?60|40 ?60|90 ?60|76 ?00|30 ?60/i.test(n) || precio >= 300) return 'media';
  return 'entrada';
}

// --- motor principal ---
function analizarBuild(build) {
  const errores = [];   // bloqueantes
  const avisos = [];    // permitido pero conviene saberlo
  const ok = [];

  const { cpu, placa, ram, gpu, caja, fuente, refrigeracion } = build;

  // ===================== COMPATIBILIDAD FISICA (bloqueante) =====================

  // 1) Socket CPU <-> placa
  if (cpu && placa) {
    if (mismoSocket(cpu.socket, placa.socket)) ok.push(`Socket CPU y placa coinciden (${cpu.socket}).`);
    else errores.push(`El socket de la CPU (${cpu.socket}) no coincide con el de la placa (${placa.socket}).`);
  }

  // 2) Socket refrigeracion <-> CPU
  if (cpu && refrigeracion && refrigeracion.socket_compat && refrigeracion.socket_compat.length) {
    const compat = refrigeracion.socket_compat.map(normSocket);
    if (compat.includes(normSocket(cpu.socket))) ok.push(`La refrigeracion es compatible con el socket ${cpu.socket}.`);
    else errores.push(`La refrigeracion no soporta el socket de la CPU (${cpu.socket}).`);
  }

  // 3) Tipo de RAM: placa <-> modulos
  if (placa && ram) {
    if (placa.tipo_ram && ram.tipo && placa.tipo_ram.toUpperCase() === ram.tipo.toUpperCase())
      ok.push(`La RAM (${ram.tipo}) es del tipo que admite la placa.`);
    else if (placa.tipo_ram && ram.tipo)
      errores.push(`La placa admite ${placa.tipo_ram} pero la RAM es ${ram.tipo}.`);
    // nº de modulos <= slots
    if (placa.slots_ram && ram.modulos && ram.modulos > placa.slots_ram)
      errores.push(`El kit tiene ${ram.modulos} modulos pero la placa solo tiene ${placa.slots_ram} slots.`);
    // capacidad <= maximo
    if (placa.ram_max_gb && ram.capacidad_gb && ram.capacidad_gb > placa.ram_max_gb)
      errores.push(`La RAM (${ram.capacidad_gb}GB) supera el maximo de la placa (${placa.ram_max_gb}GB).`);
  }

  // 4) Formato de placa cabe en la caja
  if (placa && caja && caja.formatos_admitidos && caja.formatos_admitidos.length) {
    if (placa.formato && caja.formatos_admitidos.includes(placa.formato))
      ok.push(`La placa (${placa.formato}) cabe en la caja.`);
    else if (placa.formato)
      errores.push(`La caja no admite placas de formato ${placa.formato}.`);
  }

  // 5) Longitud de la GPU cabe en la caja (no verificable si falta el dato)
  if (gpu && caja) {
    if (gpu.longitud_mm && caja.long_max_gpu_mm) {
      if (gpu.longitud_mm <= caja.long_max_gpu_mm) ok.push(`La GPU (${gpu.longitud_mm}mm) cabe en la caja (max ${caja.long_max_gpu_mm}mm).`);
      else errores.push(`La GPU (${gpu.longitud_mm}mm) no cabe en la caja (max ${caja.long_max_gpu_mm}mm).`);
    } else {
      avisos.push('No se puede verificar que la GPU quepa en la caja (falta la longitud de la GPU o de la caja).');
    }
  }

  // 6) Altura del disipador (aire) cabe en la caja
  if (refrigeracion && caja && refrigeracion.clase === 'Aire') {
    if (refrigeracion.altura_mm && caja.altura_max_disip_mm) {
      if (refrigeracion.altura_mm <= caja.altura_max_disip_mm) ok.push(`El disipador (${refrigeracion.altura_mm}mm) cabe en la caja.`);
      else errores.push(`El disipador (${refrigeracion.altura_mm}mm) no cabe en la caja (max ${caja.altura_max_disip_mm}mm).`);
    } else {
      avisos.push('No se puede verificar que el disipador quepa en la caja (falta la altura del disipador o de la caja).');
    }
  }

  // 7) Alimentacion: consumo estimado vs fuente
  if (fuente && fuente.watts) {
    const consumo = (cpu?.tdp_watts || 0) + (gpu?.tdp_watts || 0);
    if (consumo > 0) {
      // margen del 40% para picos, resto de componentes y eficiencia
      const recomendado = Math.ceil((consumo * 1.4) / 50) * 50;
      // si la GPU trae watts recomendados por el fabricante, usar el mayor
      const objetivo = Math.max(recomendado, gpu?.watts_recomendados || 0);
      if (fuente.watts >= objetivo) ok.push(`La fuente (${fuente.watts}W) es suficiente (recomendado ~${objetivo}W).`);
      else errores.push(`La fuente (${fuente.watts}W) puede quedarse corta (recomendado ~${objetivo}W).`);
    }
  }

  // ===================== PRESUPUESTO (aviso, no bloquea) =====================
  if (build.presupuesto) {
    const total = ['cpu', 'placa', 'ram', 'gpu', 'caja', 'fuente', 'refrigeracion', 'almacenamiento']
      .reduce((s, k) => s + (build[k]?.precio || 0), 0);
    if (total > build.presupuesto)
      avisos.push(`El total (${total.toFixed(2)} €) supera tu presupuesto (${build.presupuesto} €).`);
    else
      ok.push(`Dentro de presupuesto: ${total.toFixed(2)} € de ${build.presupuesto} €.`);
  }

  // ===================== IDONEIDAD PARA EL USO (aviso) =====================
  if (build.uso && gpu) {
    const gama = gamaGpu(gpu);
    const uso = build.uso;
    if (uso === 'ofimatica' && (gama === 'alta' || gama === 'entusiasta' || gama === 'profesional'))
      avisos.push(`Una GPU de gama "${gama}" es innecesaria para ofimatica; con la grafica integrada o una de entrada bastaria.`);
    if (uso === 'juegos' && gama === 'profesional')
      avisos.push('Las GPU profesionales (Quadro/Pro) no aportan ventaja en juegos; una GPU gaming rinde mas por el mismo precio.');
    if (uso === 'diseno' && gama === 'entrada')
      avisos.push('Para diseno/render una GPU de entrada puede quedarse corta; considera una gama superior.');
  }
  // CPU sobredimensionada para ofimatica (por nucleos/precio)
  if (build.uso === 'ofimatica' && cpu && ((cpu.nucleos && cpu.nucleos >= 12) || (cpu.precio && cpu.precio >= 400)))
    avisos.push('La CPU elegida es mas potente de lo que necesita la ofimatica; podrias ahorrar con una gama media.');

  return { errores, avisos, ok, compatible: errores.length === 0 };
}

module.exports = { analizarBuild, gamaGpu };