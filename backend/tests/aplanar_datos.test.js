// Pruebas unitarias del aplanado de componentes (aplanar_datos.js).
const { aplanar, RELACION_TIPO, INCLUDE_COMPLETO } = require('../aplanar_datos');

const cpuBD = {
  id: 7n, nombre: 'AMD Ryzen 7 9800X3D', tipo: 'cpu', marca: 'AMD', imagen_url: 'img.jpg',
  cpus: { socket: 'AM5', tdp_watts: 120, nucleos: 8, grafica_integrada: true },
  ofertas: [
    { precio: '444.95', url: 'https://tienda/a', tiendas: { nombre: 'Coolmod' } },
    { precio: '459.00', url: 'https://tienda/b', tiendas: { nombre: 'Otra' } },
  ],
};

describe('aplanar', () => {
  test('devuelve null si no hay componente', () => {
    expect(aplanar(null)).toBeNull();
    expect(aplanar(undefined)).toBeNull();
  });

  test('combina los campos comunes con las especificaciones de su tipo', () => {
    const p = aplanar(cpuBD);
    expect(p.id).toBe(7n);
    expect(p.nombre).toBe('AMD Ryzen 7 9800X3D');
    expect(p.marca).toBe('AMD');
    expect(p.socket).toBe('AM5');
    expect(p.nucleos).toBe(8);
    expect(p.grafica_integrada).toBe(true);
  });

  test('toma como precio y url la primera oferta (la mas barata) y lo convierte a numero', () => {
    const p = aplanar(cpuBD);
    expect(p.precio).toBe(444.95);
    expect(typeof p.precio).toBe('number');
    expect(p.url).toBe('https://tienda/a');
  });

  test('sin ofertas el precio y la url quedan a null', () => {
    const p = aplanar({ ...cpuBD, ofertas: [] });
    expect(p.precio).toBeNull();
    expect(p.url).toBeNull();
  });

  test('el campo tipo final es siempre el del componente y la spec "tipo" pasa a tipo_spec', () => {
    const ramBD = {
      id: 3, nombre: 'Corsair Vengeance 32GB', tipo: 'ram', marca: 'Corsair',
      ram: { tipo: 'DDR5', capacidad_gb: 32, modulos: 2 },
      ofertas: [{ precio: '110.5', url: 'u' }],
    };
    const p = aplanar(ramBD);
    expect(p.tipo).toBe('ram');
    expect(p.tipo_spec).toBe('DDR5');
    expect(p.capacidad_gb).toBe(32);
  });

  test('un componente sin tabla de especificaciones se aplana solo con los campos comunes', () => {
    const p = aplanar({ id: 1, nombre: 'X', tipo: 'caja', marca: 'M', ofertas: [] });
    expect(p).toMatchObject({ id: 1, nombre: 'X', tipo: 'caja', marca: 'M', precio: null });
    expect(p.tipo_spec).toBeUndefined();
  });
});

describe('RELACION_TIPO e INCLUDE_COMPLETO', () => {
  test('cada tipo de componente tiene su relacion en Prisma', () => {
    expect(Object.keys(RELACION_TIPO).sort()).toEqual(
      ['almacenamiento', 'caja', 'cpu', 'fuente', 'gpu', 'placa', 'ram', 'refrigeracion'],
    );
  });

  test('el include trae todas las relaciones de tipo y las ofertas ordenadas por precio', () => {
    for (const rel of Object.values(RELACION_TIPO)) expect(INCLUDE_COMPLETO[rel]).toBe(true);
    expect(INCLUDE_COMPLETO.ofertas.orderBy).toEqual({ precio: 'asc' });
  });
});