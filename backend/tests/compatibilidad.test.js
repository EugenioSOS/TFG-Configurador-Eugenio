// Pruebas unitarias del motor de compatibilidad (compatibilidad.js).
const { analizarBuild, gamaGpu } = require('../compatibilidad');

// ---------- fixtures: una build base completamente compatible ----------
const CPU = { nombre: 'AMD Ryzen 7 9800X3D', socket: 'AM5', tipo_ram: 'DDR5', tdp_watts: 120, nucleos: 8, grafica_integrada: true, precio: 445 };
const PLACA = { nombre: 'MSI B650', socket: 'AM5', tipo_ram: 'DDR5', formato: 'ATX', slots_ram: 4, ram_max_gb: 128, precio: 180 };
const RAM = { nombre: 'Corsair 32GB', tipo_spec: 'DDR5', capacidad_gb: 32, modulos: 2, precio: 110 };
const GPU = { nombre: 'MSI GeForce RTX 5070', longitud_mm: 300, tdp_watts: 250, watts_recomendados: 650, precio: 620 };
const CAJA = { nombre: 'Lian Li O11D', formatos_admitidos: ['ATX', 'Micro-ATX', 'Mini-ITX'], long_max_gpu_mm: 420, altura_max_disip_mm: 170, precio: 180 };
const FUENTE = { nombre: 'Corsair RM850', watts: 850, precio: 130 };
const REFRI = { nombre: 'Noctua NH-U12S', clase: 'Aire', altura_mm: 158, socket_compat: ['AM5', 'AM4', 'LGA1700'], precio: 70 };
const ALM = { nombre: 'Samsung 990 Pro 1TB', precio: 100 };

const buildOk = (extra = {}) => ({
  cpu: CPU, placa: PLACA, ram: RAM, gpu: GPU, caja: CAJA,
  fuente: FUENTE, refrigeracion: REFRI, almacenamiento: ALM, ...extra,
});

const tiene = (lista, texto) => lista.some((m) => m.toLowerCase().includes(texto.toLowerCase()));

// ---------- 1. build completa y compatible ----------
describe('Build completa y compatible', () => {
  test('no genera errores y se marca como compatible', () => {
    const r = analizarBuild(buildOk());
    expect(r.errores).toHaveLength(0);
    expect(r.compatible).toBe(true);
    expect(tiene(r.ok, 'Socket CPU y placa coinciden')).toBe(true);
  });

  test('devuelve siempre la estructura errores/avisos/ok/compatible', () => {
    const r = analizarBuild({});
    expect(Array.isArray(r.errores)).toBe(true);
    expect(Array.isArray(r.avisos)).toBe(true);
    expect(Array.isArray(r.ok)).toBe(true);
    expect(typeof r.compatible).toBe('boolean');
  });
});

// ---------- 2. piezas imprescindibles (RF-12) ----------
describe('Piezas imprescindibles (RF-12)', () => {
  test('una build vacia marca como error cada componente obligatorio', () => {
    const r = analizarBuild({});
    const faltan = r.errores.filter((e) => e.startsWith('Falta un componente imprescindible'));
    expect(faltan).toHaveLength(6); // cpu, placa, ram, almacenamiento, fuente, caja
    expect(r.compatible).toBe(false);
  });

  test('la GPU no es obligatoria si la CPU tiene graficos integrados', () => {
    const r = analizarBuild(buildOk({ gpu: undefined }));
    expect(tiene(r.errores, 'Falta la tarjeta grafica')).toBe(false);
  });

  test('la GPU es obligatoria si la CPU no tiene graficos integrados', () => {
    const r = analizarBuild(buildOk({ gpu: undefined, cpu: { ...CPU, grafica_integrada: false } }));
    expect(tiene(r.errores, 'Falta la tarjeta grafica')).toBe(true);
    expect(r.compatible).toBe(false);
  });
});

// ---------- 3. socket CPU / placa / refrigeracion (RF-11) ----------
describe('Compatibilidad de socket (RF-11)', () => {
  test('sockets distintos entre CPU y placa generan error bloqueante', () => {
    const r = analizarBuild(buildOk({ placa: { ...PLACA, socket: '1700' } }));
    expect(tiene(r.errores, 'no coincide con el de la placa')).toBe(true);
    expect(r.compatible).toBe(false);
  });

  test('el socket se compara de forma normalizada (LGA1700 equivale a 1700)', () => {
    const r = analizarBuild(buildOk({
      cpu: { ...CPU, socket: 'LGA 1700' },
      placa: { ...PLACA, socket: '1700' },
      refrigeracion: { ...REFRI, socket_compat: ['lga1700'] },
    }));
    expect(tiene(r.errores, 'socket')).toBe(false);
  });

  test('una refrigeracion que no soporta el socket de la CPU genera error', () => {
    const r = analizarBuild(buildOk({ refrigeracion: { ...REFRI, socket_compat: ['LGA1700'] } }));
    expect(tiene(r.errores, 'La refrigeracion no soporta el socket')).toBe(true);
  });
});

// ---------- 4. memoria RAM (RF-11) ----------
describe('Compatibilidad de la memoria RAM (RF-11)', () => {
  test('RAM DDR4 en una placa DDR5 genera error', () => {
    const r = analizarBuild(buildOk({ ram: { ...RAM, tipo_spec: 'DDR4' } }));
    expect(tiene(r.errores, 'La placa admite DDR5 pero la RAM es DDR4')).toBe(true);
  });

  test('mas modulos que slots en la placa genera error', () => {
    const r = analizarBuild(buildOk({ ram: { ...RAM, modulos: 4 }, placa: { ...PLACA, slots_ram: 2 } }));
    expect(tiene(r.errores, 'slots')).toBe(true);
  });

  test('capacidad superior al maximo de la placa genera error', () => {
    const r = analizarBuild(buildOk({ ram: { ...RAM, capacidad_gb: 256 } }));
    expect(tiene(r.errores, 'supera el maximo de la placa')).toBe(true);
  });
});

// ---------- 5. dimensiones fisicas: formato, GPU y disipador (RF-11, RNF-04) ----------
describe('Compatibilidad fisica con la caja (RF-11, RNF-04)', () => {
  test('una placa E-ATX en una caja que no la admite genera error', () => {
    const r = analizarBuild(buildOk({ placa: { ...PLACA, formato: 'E-ATX' } }));
    expect(tiene(r.errores, 'La caja no admite placas de formato E-ATX')).toBe(true);
  });

  test('una GPU mas larga que el maximo de la caja genera error', () => {
    const r = analizarBuild(buildOk({ gpu: { ...GPU, longitud_mm: 450 } }));
    expect(tiene(r.errores, 'no cabe en la caja')).toBe(true);
  });

  test('un disipador de aire mas alto que el maximo de la caja genera error', () => {
    const r = analizarBuild(buildOk({ refrigeracion: { ...REFRI, altura_mm: 180 } }));
    expect(tiene(r.errores, 'El disipador (180mm) no cabe en la caja')).toBe(true);
  });

  test('si falta la longitud de la GPU la comprobacion es un aviso, no un error (RNF-04)', () => {
    const r = analizarBuild(buildOk({ gpu: { ...GPU, longitud_mm: undefined } }));
    expect(tiene(r.avisos, 'No se puede verificar que la GPU quepa')).toBe(true);
    expect(tiene(r.errores, 'GPU')).toBe(false);
    expect(r.compatible).toBe(true);
  });

  test('si falta la altura maxima de la caja la comprobacion del disipador es un aviso (RNF-04)', () => {
    const r = analizarBuild(buildOk({ caja: { ...CAJA, altura_max_disip_mm: undefined } }));
    expect(tiene(r.avisos, 'No se puede verificar que el disipador quepa')).toBe(true);
    expect(r.compatible).toBe(true);
  });
});

// ---------- 6. fuente de alimentacion (RF-13) ----------
describe('Calculo de la fuente recomendada (RF-13)', () => {
  test('una fuente por debajo de los vatios recomendados de la GPU genera error', () => {
    const r = analizarBuild(buildOk({ fuente: { ...FUENTE, watts: 500 } }));
    expect(tiene(r.errores, 'puede quedarse corta')).toBe(true);
  });

  test('con uso de juegos el minimo de seguridad es 650W aunque la GPU pida menos', () => {
    const gpuPeq = { ...GPU, watts_recomendados: 450, tdp_watts: 120 };
    const r = analizarBuild(buildOk({ uso: 'juegos', gpu: gpuPeq, fuente: { ...FUENTE, watts: 600 } }));
    expect(tiene(r.errores, 'recomendado ~650W')).toBe(true);
  });

  test('sin GPU dedicada el minimo es 550W', () => {
    const r = analizarBuild(buildOk({ gpu: undefined, fuente: { ...FUENTE, watts: 500 } }));
    expect(tiene(r.errores, 'recomendado ~550W')).toBe(true);
    const r2 = analizarBuild(buildOk({ gpu: undefined, fuente: { ...FUENTE, watts: 550 } }));
    expect(tiene(r2.ok, 'es suficiente')).toBe(true);
  });

  test('el objetivo se calcula tambien por consumo (TDP CPU + GPU) x 1.4 redondeado a 50W', () => {
    // 200 + 300 = 500 W x 1.4 = 700 -> objetivo 700 (mayor que los 650 recomendados por la GPU)
    const r = analizarBuild(buildOk({
      cpu: { ...CPU, tdp_watts: 200 }, gpu: { ...GPU, tdp_watts: 300 }, fuente: { ...FUENTE, watts: 650 },
    }));
    expect(tiene(r.errores, 'recomendado ~700W')).toBe(true);
  });
});

// ---------- 7. avisos de idoneidad y presupuesto (RF-14) ----------
describe('Avisos de idoneidad (RF-14)', () => {
  test('una GPU de gama alta en ofimatica genera aviso no bloqueante', () => {
    const r = analizarBuild(buildOk({ uso: 'ofimatica', cpu: { ...CPU, nucleos: 6, precio: 200 } }));
    expect(tiene(r.avisos, 'innecesaria para ofimatica')).toBe(true);
    expect(r.compatible).toBe(true);
  });

  test('una GPU profesional en juegos genera aviso', () => {
    const r = analizarBuild(buildOk({ uso: 'juegos', gpu: { ...GPU, nombre: 'NVIDIA RTX PRO 4000' } }));
    expect(tiene(r.avisos, 'GPU profesionales')).toBe(true);
  });

  test('CPU con menos de 6 nucleos para juegos genera aviso', () => {
    const r = analizarBuild(buildOk({ uso: 'juegos', cpu: { ...CPU, nucleos: 4 } }));
    expect(tiene(r.avisos, 'se recomiendan CPU de 6 nucleos')).toBe(true);
  });

  test('CPU con menos de 8 nucleos para diseno genera aviso', () => {
    const r = analizarBuild(buildOk({ uso: 'diseno', cpu: { ...CPU, nucleos: 6 } }));
    expect(tiene(r.avisos, 'conviene una CPU de 8 nucleos')).toBe(true);
  });

  test('superar el presupuesto es un aviso y no bloquea la build', () => {
    const r = analizarBuild(buildOk({ presupuesto: 1000 }));
    expect(tiene(r.avisos, 'supera tu presupuesto')).toBe(true);
    expect(r.compatible).toBe(true);
  });

  test('dentro del presupuesto se informa del total', () => {
    const r = analizarBuild(buildOk({ presupuesto: 3000 }));
    expect(tiene(r.ok, 'Dentro de presupuesto')).toBe(true);
  });
});

// ---------- 8. clasificacion de GPU por gama ----------
describe('gamaGpu', () => {
  test.each([
    [{ nombre: 'NVIDIA RTX PRO 4000', precio: 1200 }, 'profesional'],
    [{ nombre: 'GeForce RTX 5090', precio: 2300 }, 'entusiasta'],
    [{ nombre: 'GeForce RTX 5070', precio: 620 }, 'alta'],
    [{ nombre: 'GeForce RTX 5060', precio: 320 }, 'media'],
    [{ nombre: 'Radeon RX 6400', precio: 150 }, 'entrada'],
    [{ nombre: 'Modelo desconocido', precio: 1600 }, 'entusiasta'],
  ])('clasifica %o como %s', (gpu, esperado) => {
    expect(gamaGpu(gpu)).toBe(esperado);
  });
});