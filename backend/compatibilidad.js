function normSocket(s) { return (s || '').toUpperCase().replace(/\s+/g, '').replace(/^LGA/, ''); }
function mismoSocket(a, b) { return normSocket(a) && normSocket(a) === normSocket(b); }


function gamaGpu(gpu) {
  const n = (gpu.nombre || '').toLowerCase();
  const precio = gpu.precio || 0;
  if (/quadro|rtx\s?pro|radeon\s?pro|\bpro\b w\d|nvidia t\d|tesla/i.test(n)) return 'profesional';
  if (/50 ?90|40 ?90|79 ?00 xtx|48 ?00/i.test(n) || precio >= 1500) return 'entusiasta';
  if (/50 ?80|50 ?70|40 ?80|40 ?70|90 ?70|77 ?00/i.test(n) || precio >= 700) return 'alta';
  if (/50 ?60|40 ?60|90 ?60|76 ?00|30 ?60/i.test(n) || precio >= 300) return 'media';
  return 'entrada';
}

function analizarBuild(build) {
  const errores = [];   
  const avisos = [];  
  const ok = [];

  const { cpu, placa, ram, gpu, caja, fuente, refrigeracion } = build;

 
  const OBLIGATORIAS = [
    ['cpu', cpu, 'procesador'],
    ['placa', placa, 'placa base'],
    ['ram', ram, 'memoria RAM'],
    ['almacenamiento', build.almacenamiento, 'almacenamiento'],
    ['fuente', fuente, 'fuente de alimentacion'],
    ['caja', caja, 'caja'],
  ];
  for (const [, pieza, etiqueta] of OBLIGATORIAS) {
    if (!pieza) errores.push(`Falta un componente imprescindible: ${etiqueta}.`);
  }

  if (cpu && cpu.grafica_integrada === false && !gpu)
    errores.push('Falta la tarjeta grafica: la CPU no tiene graficos integrados.');

  if (cpu && placa) {
    if (mismoSocket(cpu.socket, placa.socket)) ok.push(`Socket CPU y placa coinciden (${cpu.socket}).`);
    else errores.push(`El socket de la CPU (${cpu.socket}) no coincide con el de la placa (${placa.socket}).`);
  }

  if (cpu && refrigeracion && refrigeracion.socket_compat && refrigeracion.socket_compat.length) {
    const compat = refrigeracion.socket_compat.map(normSocket);
    if (compat.includes(normSocket(cpu.socket))) ok.push(`La refrigeracion es compatible con el socket ${cpu.socket}.`);
    else errores.push(`La refrigeracion no soporta el socket de la CPU (${cpu.socket}).`);
  }

  const ddrRam = ram ? (ram.tipo_spec || ram.tipo) : null;
  if (placa && ram) {
    if (placa.tipo_ram && ddrRam && placa.tipo_ram.toUpperCase() === ddrRam.toUpperCase())
      ok.push(`La RAM (${ddrRam}) es del tipo que admite la placa.`);
    else if (placa.tipo_ram && ddrRam)
      errores.push(`La placa admite ${placa.tipo_ram} pero la RAM es ${ddrRam}.`);
  
    if (placa.slots_ram && ram.modulos && ram.modulos > placa.slots_ram)
      errores.push(`El kit tiene ${ram.modulos} modulos pero la placa solo tiene ${placa.slots_ram} slots.`);
   
    if (placa.ram_max_gb && ram.capacidad_gb && ram.capacidad_gb > placa.ram_max_gb)
      errores.push(`La RAM (${ram.capacidad_gb}GB) supera el maximo de la placa (${placa.ram_max_gb}GB).`);
  }

  if (placa && caja && caja.formatos_admitidos && caja.formatos_admitidos.length) {
    if (placa.formato && caja.formatos_admitidos.includes(placa.formato))
      ok.push(`La placa (${placa.formato}) cabe en la caja.`);
    else if (placa.formato)
      errores.push(`La caja no admite placas de formato ${placa.formato}.`);
  }

  if (gpu && caja) {
    if (gpu.longitud_mm && caja.long_max_gpu_mm) {
      if (gpu.longitud_mm <= caja.long_max_gpu_mm) ok.push(`La GPU (${gpu.longitud_mm}mm) cabe en la caja (max ${caja.long_max_gpu_mm}mm).`);
      else errores.push(`La GPU (${gpu.longitud_mm}mm) no cabe en la caja (max ${caja.long_max_gpu_mm}mm).`);
    } else {
      avisos.push('No se puede verificar que la GPU quepa en la caja (falta la longitud de la GPU o de la caja).');
    }
  }

  if (refrigeracion && caja && refrigeracion.clase === 'Aire') {
    if (refrigeracion.altura_mm && caja.altura_max_disip_mm) {
      if (refrigeracion.altura_mm <= caja.altura_max_disip_mm) ok.push(`El disipador (${refrigeracion.altura_mm}mm) cabe en la caja.`);
      else errores.push(`El disipador (${refrigeracion.altura_mm}mm) no cabe en la caja (max ${caja.altura_max_disip_mm}mm).`);
    } else {
      avisos.push('No se puede verificar que el disipador quepa en la caja (falta la altura del disipador o de la caja).');
    }
  }

  if (fuente && fuente.watts) {
    let objetivo;
    if (gpu) {
      const consumo = (cpu?.tdp_watts || 0) + (gpu?.tdp_watts || 0);
      const porConsumo = consumo > 0 ? Math.ceil((consumo * 1.4) / 50) * 50 : 0;
      objetivo = Math.max(gpu.watts_recomendados || 0, porConsumo);
      if (objetivo === 0) objetivo = 550;   // GPU sin datos de consumo -> minimo prudente
      // Minimo de seguridad para builds de juegos/diseno con GPU dedicada: 650W.
      if (build.uso === 'juegos' || build.uso === 'diseno') objetivo = Math.max(objetivo, 650);
    } else {
      objetivo = 550;   // sin GPU dedicada (graficos integrados)
    }
    if (fuente.watts >= objetivo) ok.push(`La fuente (${fuente.watts}W) es suficiente (recomendado ~${objetivo}W).`);
    else errores.push(`La fuente (${fuente.watts}W) puede quedarse corta (recomendado ~${objetivo}W).`);
  }

  if (build.presupuesto) {
    const total = ['cpu', 'placa', 'ram', 'gpu', 'caja', 'fuente', 'refrigeracion', 'almacenamiento']
      .reduce((s, k) => s + (build[k]?.precio || 0), 0);
    if (total > build.presupuesto)
      avisos.push(`El total (${total.toFixed(2)} €) supera tu presupuesto (${build.presupuesto} €).`);
    else
      ok.push(`Dentro de presupuesto: ${total.toFixed(2)} € de ${build.presupuesto} €.`);
  }

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
 
  if (build.uso === 'juegos' && cpu && cpu.nucleos != null && cpu.nucleos < 6)
    avisos.push(`Para juegos se recomiendan CPU de 6 nucleos o mas; la elegida tiene ${cpu.nucleos}.`);

  if (build.uso === 'diseno' && cpu && cpu.nucleos != null && cpu.nucleos < 8)
    avisos.push(`Para diseno/render conviene una CPU de 8 nucleos o mas; la elegida tiene ${cpu.nucleos}.`);

  if (build.uso === 'ofimatica' && cpu && ((cpu.nucleos && cpu.nucleos >= 12) || (cpu.precio && cpu.precio >= 400)))
    avisos.push('La CPU elegida es mas potente de lo que necesita la ofimatica; podrias ahorrar con una gama media.');

  return { errores, avisos, ok, compatible: errores.length === 0 };
}

module.exports = { analizarBuild, gamaGpu };