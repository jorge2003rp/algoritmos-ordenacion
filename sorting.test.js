// Tests de sorting.js. Se ejecutan con: node --test
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./sorting.js');

const numerico = (a, b) => a - b;
const esperado = (datos) => datos.slice().sort(numerico); // referencia: Array.prototype.sort
const ids = S.ORDEN_ALGORITMOS;

// Entradas de prueba con nombre. Las aleatorias usan semilla fija: reproducibles.
function casos() {
  const lista = [
    ['vacío', []],
    ['un elemento', [7]],
    ['dos ordenados', [1, 2]],
    ['dos invertidos', [2, 1]],
    ['todos iguales', [5, 5, 5, 5, 5, 5]],
    ['repetidos', [3, 1, 3, 2, 1, 2, 3, 1]],
    ['negativos y cero', [0, -3, 5, -1, 0, 2]],
    ['ya ordenado', S.generarEntrada('ordenada', 40)],
    ['inverso', S.generarEntrada('inversa', 40)],
    ['casi ordenado', S.generarEntrada('casi-ordenada', 60, 3)],
  ];
  for (let semilla = 1; semilla <= 40; semilla++) {
    const n = (semilla * 7) % 64;
    lista.push([`aleatorio n=${n} semilla=${semilla}`, S.generarEntrada('aleatoria', n, semilla)]);
    lista.push([`repetidos n=${n} semilla=${semilla}`, S.generarEntrada('repetidos', n, semilla)]);
  }
  return lista;
}

for (const id of ids) {
  const alg = S.ALGORITMOS[id];

  test(`${alg.nombre}: ordena igual que Array.prototype.sort`, () => {
    for (const [nombre, datos] of casos()) {
      const r = alg.ordenar(datos, numerico);
      assert.deepEqual(r.resultado, esperado(datos), nombre);
    }
  });

  test(`${alg.nombre}: no modifica el array de entrada`, () => {
    const datos = S.generarEntrada('aleatoria', 30, 9);
    const copia = datos.slice();
    alg.ordenar(datos, numerico);
    assert.deepEqual(datos, copia);
  });

  test(`${alg.nombre}: reproducir los pasos sobre una copia da el array ordenado`, () => {
    for (const [nombre, datos] of casos()) {
      const r = alg.ordenar(datos, numerico);
      assert.deepEqual(S.aplicarPasos(datos, r.pasos), esperado(datos), nombre);
    }
  });

  test(`${alg.nombre}: los contadores coinciden con los pasos y los índices son válidos`, () => {
    for (const [nombre, datos] of casos()) {
      const r = alg.ordenar(datos, numerico);
      const cuenta = { comparar: 0, intercambiar: 0, escribir: 0 };
      for (const p of r.pasos) {
        if (p.tipo in cuenta) cuenta[p.tipo]++;
        for (const k of [p.i, p.j]) {
          if (k !== undefined) assert.ok(k >= 0 && k < datos.length, `${nombre}: índice ${k} fuera de rango`);
        }
      }
      assert.equal(r.comparaciones, cuenta.comparar, nombre);
      assert.equal(r.intercambios, cuenta.intercambiar, nombre);
      assert.equal(r.escrituras, cuenta.escribir, nombre);
      assert.equal(r.pasos[r.pasos.length - 1].tipo, 'fin', nombre);
    }
  });

  test(`${alg.nombre}: "fijar" solo marca posiciones que ya tienen su valor final`, () => {
    for (const [nombre, datos] of casos()) {
      const r = alg.ordenar(datos, numerico);
      const final = esperado(datos);
      const a = datos.slice();
      for (const p of r.pasos) {
        S.aplicarPaso(a, p);
        // Con repetidos basta con que el valor coincida con el que irá en esa posición
        if (p.tipo === 'fijar') assert.equal(a[p.i], final[p.i], `${nombre}: posición ${p.i}`);
      }
    }
  });

  test(`${alg.nombre}: la estabilidad declarada es coherente`, () => {
    // Pares {k, id}: se ordena solo por k y se mira si los empates conservan el orden de id
    const mismoOrden = (x, y) => x.k - y.k;
    let todosEstables = true;
    for (let semilla = 1; semilla <= 60; semilla++) {
      const claves = S.generarEntrada('repetidos', 8 + (semilla % 40), semilla);
      const datos = claves.map((k, i) => ({ k, id: i }));
      const { resultado } = alg.ordenar(datos, mismoOrden);
      for (let i = 1; i < resultado.length; i++) {
        const a = resultado[i - 1];
        const b = resultado[i];
        assert.ok(a.k <= b.k, 'no está ordenado');
        if (a.k === b.k && a.id > b.id) todosEstables = false;
      }
    }
    if (alg.estable) assert.equal(todosEstables, true, `${alg.nombre} debería ser estable`);
    else assert.equal(todosEstables, false, `${alg.nombre} no es estable: debería haber algún contraejemplo`);
  });

  test(`${alg.nombre}: la metadata de complejidad está completa`, () => {
    for (const campo of ['nombre', 'mejor', 'medio', 'peor', 'memoria', 'descripcion']) {
      assert.equal(typeof alg[campo], 'string', campo);
      assert.ok(alg[campo].length > 0, campo);
    }
    assert.equal(typeof alg.estable, 'boolean');
  });
}

/* ---------- Comportamientos propios de cada variante ---------- */

test('Burbuja: con la entrada ya ordenada para tras una pasada (n − 1 comparaciones, 0 intercambios)', () => {
  const r = S.ALGORITMOS.burbuja.ordenar(S.generarEntrada('ordenada', 50));
  assert.equal(r.comparaciones, 49);
  assert.equal(r.intercambios, 0);
});

test('Burbuja: con la entrada inversa hace n(n − 1)/2 intercambios', () => {
  const n = 30;
  const r = S.ALGORITMOS.burbuja.ordenar(S.generarEntrada('inversa', n));
  assert.equal(r.intercambios, (n * (n - 1)) / 2);
});

test('Selección: siempre n(n − 1)/2 comparaciones y como mucho n − 1 intercambios', () => {
  const n = 40;
  for (const tipo of ['ordenada', 'inversa', 'aleatoria', 'repetidos']) {
    const r = S.ALGORITMOS.seleccion.ordenar(S.generarEntrada(tipo, n, 5));
    assert.equal(r.comparaciones, (n * (n - 1)) / 2, tipo);
    assert.ok(r.intercambios <= n - 1, tipo);
  }
});

test('Inserción: con la entrada ya ordenada hace n − 1 comparaciones y ningún intercambio', () => {
  const r = S.ALGORITMOS.insercion.ordenar(S.generarEntrada('ordenada', 50));
  assert.equal(r.comparaciones, 49);
  assert.equal(r.intercambios, 0);
});

test('MergeSort: no pasa de n·⌈log₂ n⌉ comparaciones y no usa intercambios', () => {
  for (const tipo of ['ordenada', 'inversa', 'aleatoria', 'repetidos']) {
    const n = 1000;
    const r = S.ALGORITMOS.mergesort.ordenar(S.generarEntrada(tipo, n, 2));
    assert.ok(r.comparaciones <= n * Math.ceil(Math.log2(n)), `${tipo}: ${r.comparaciones}`);
    assert.equal(r.intercambios, 0);
    assert.ok(r.escrituras > 0);
  }
});

test('QuickSort: la mediana de tres evita el peor caso con entradas ordenadas, inversas o iguales', () => {
  const n = 2000;
  const cota = 3 * n * Math.ceil(Math.log2(n)); // muy lejos de n²/2 = 2.000.000
  for (const tipo of ['ordenada', 'inversa', 'casi-ordenada', 'repetidos']) {
    const r = S.ALGORITMOS.quicksort.ordenar(S.generarEntrada(tipo, n, 4));
    assert.ok(r.comparaciones < cota, `${tipo}: ${r.comparaciones} comparaciones`);
  }
  const iguales = new Array(n).fill(3);
  assert.ok(S.ALGORITMOS.quicksort.ordenar(iguales).comparaciones < cota);
});

test('QuickSort: con un array grande no desborda la pila', () => {
  const r = S.ALGORITMOS.quicksort.ordenar(S.generarEntrada('aleatoria', 50000, 11));
  assert.deepEqual(r.resultado, esperado(r.resultado));
});

test('Selección: un ejemplo concreto que demuestra que no es estable', () => {
  const datos = [
    { k: 2, id: 0 },
    { k: 2, id: 1 },
    { k: 1, id: 2 },
  ];
  const { resultado } = S.ALGORITMOS.seleccion.ordenar(datos, (a, b) => a.k - b.k);
  assert.deepEqual(resultado.map((x) => x.id), [2, 1, 0]); // los dos 2 han invertido su orden
});

test('Ordena cadenas con un comparador propio', () => {
  const datos = ['pera', 'manzana', 'kiwi', 'banana', 'kiwi'];
  for (const id of ids) {
    const { resultado } = S.ALGORITMOS[id].ordenar(datos); // comparador por defecto
    assert.deepEqual(resultado, ['banana', 'kiwi', 'kiwi', 'manzana', 'pera'], id);
  }
});

/* ---------- Generador de entradas ---------- */

test('generarEntrada: misma semilla, misma entrada; distinta semilla, distinta entrada', () => {
  assert.deepEqual(S.generarEntrada('aleatoria', 30, 7), S.generarEntrada('aleatoria', 30, 7));
  assert.notDeepEqual(S.generarEntrada('aleatoria', 30, 7), S.generarEntrada('aleatoria', 30, 8));
});

test('generarEntrada: cada tipo tiene la forma que promete', () => {
  const n = 50;
  const aleatoria = S.generarEntrada('aleatoria', n, 1);
  assert.deepEqual(aleatoria.slice().sort(numerico), S.generarEntrada('ordenada', n)); // es una permutación de 1..n

  assert.deepEqual(S.generarEntrada('inversa', n), S.generarEntrada('ordenada', n).reverse());

  const casi = S.generarEntrada('casi-ordenada', n, 1);
  assert.deepEqual(casi.slice().sort(numerico), S.generarEntrada('ordenada', n)); // permutación
  assert.notDeepEqual(casi, S.generarEntrada('ordenada', n)); // pero no está ordenada
  const descolocados = casi.filter((v, i) => v !== i + 1).length;
  assert.ok(descolocados <= n / 2, `demasiado desordenada: ${descolocados}`);

  const rep = S.generarEntrada('repetidos', n, 1);
  assert.equal(rep.length, n);
  assert.ok(new Set(rep).size < n / 2, 'debería tener muchos valores repetidos');
});

test('generarEntrada: tamaños 0 y 1 y tipo desconocido', () => {
  for (const t of S.TIPOS_ENTRADA) {
    assert.deepEqual(S.generarEntrada(t.id, 0), []);
    assert.equal(S.generarEntrada(t.id, 1, 3).length, 1);
  }
  assert.throws(() => S.generarEntrada('inventada', 5), /desconocido/);
});
