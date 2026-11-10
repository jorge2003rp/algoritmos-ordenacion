/* sorting.js — lógica pura de los algoritmos de ordenación (sin DOM).
 *
 * Cada algoritmo recibe un array y un comparador, NO modifica el original y
 * devuelve un "registro" con el resultado y la lista de pasos que ha dado:
 *
 *   { resultado, pasos, comparaciones, intercambios, escrituras }
 *
 * Tipos de paso (los índices son posiciones del array):
 *   { tipo: 'comparar', i, j }      compara a[i] con a[j]
 *   { tipo: 'intercambiar', i, j }  intercambia a[i] y a[j]
 *   { tipo: 'escribir', i, valor }  escribe `valor` en a[i] (lo usa MergeSort)
 *   { tipo: 'pivote', i }           QuickSort: a[i] es el pivote de esta partición
 *   { tipo: 'fijar', i }            a[i] ya está en su posición definitiva
 *   { tipo: 'fin' }                 el array está completamente ordenado
 *
 * Reproduciendo los pasos sobre una copia del array original se obtiene el
 * array ordenado (ver aplicarPasos), que es lo que usa la animación de app.js.
 *
 * Se puede cargar en el navegador (<script>, expone `Ordenacion`) y en Node
 * (require), por eso el envoltorio de arriba.
 */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Ordenacion = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const porDefecto = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  /* ---------- Registro de pasos ---------- */

  // Envuelve una copia del array con operaciones que, además de ejecutarse,
  // dejan constancia del paso y actualizan los contadores.
  function crearRegistro(datos, comparar) {
    const r = {
      a: datos.slice(),
      pasos: [],
      comparaciones: 0,
      intercambios: 0,
      escrituras: 0,
    };
    r.cmp = (i, j) => {
      r.comparaciones++;
      r.pasos.push({ tipo: 'comparar', i, j });
      return comparar(r.a[i], r.a[j]);
    };
    r.swap = (i, j) => {
      if (i === j) return; // intercambiar un elemento consigo mismo no cuenta
      const t = r.a[i];
      r.a[i] = r.a[j];
      r.a[j] = t;
      r.intercambios++;
      r.pasos.push({ tipo: 'intercambiar', i, j });
    };
    r.escribir = (i, valor) => {
      r.a[i] = valor;
      r.escrituras++;
      r.pasos.push({ tipo: 'escribir', i, valor });
    };
    r.pivote = (i) => r.pasos.push({ tipo: 'pivote', i });
    r.fijar = (i) => r.pasos.push({ tipo: 'fijar', i });
    return r;
  }

  function envolver(algoritmo) {
    return function ordenar(datos, comparar = porDefecto) {
      const r = crearRegistro(datos, comparar);
      algoritmo(r);
      r.pasos.push({ tipo: 'fin' });
      return {
        resultado: r.a,
        pasos: r.pasos,
        comparaciones: r.comparaciones,
        intercambios: r.intercambios,
        escrituras: r.escrituras,
      };
    };
  }

  /* ---------- Burbuja (con parada anticipada) ---------- */

  // Cada pasada deja el mayor de la zona sin ordenar al final. Si una pasada
  // completa no intercambia nada, el resto ya está ordenado y se para.
  function burbuja(r) {
    const n = r.a.length;
    for (let fin = n - 1; fin > 0; fin--) {
      let hubo = false;
      for (let i = 0; i < fin; i++) {
        if (r.cmp(i, i + 1) > 0) {
          r.swap(i, i + 1);
          hubo = true;
        }
      }
      if (!hubo) {
        for (let k = 0; k <= fin; k++) r.fijar(k);
        return;
      }
      r.fijar(fin);
    }
    if (n > 0) r.fijar(0);
  }

  /* ---------- Selección ---------- */

  function seleccion(r) {
    const n = r.a.length;
    for (let i = 0; i < n - 1; i++) {
      let min = i;
      for (let j = i + 1; j < n; j++) {
        if (r.cmp(j, min) < 0) min = j;
      }
      r.swap(i, min);
      r.fijar(i);
    }
    if (n > 0) r.fijar(n - 1);
  }

  /* ---------- Inserción ---------- */

  // Cada elemento "retrocede" con intercambios adyacentes mientras sea menor
  // que el de su izquierda. El `> 0` estricto la hace estable.
  function insercion(r) {
    for (let i = 1; i < r.a.length; i++) {
      let j = i;
      while (j > 0 && r.cmp(j - 1, j) > 0) {
        r.swap(j - 1, j);
        j--;
      }
    }
  }

  /* ---------- MergeSort (estable, con buffer auxiliar) ---------- */

  // Mezcla [lo, mid) y [mid, hi). Las comparaciones se hacen sobre el array
  // sin tocar y el resultado se construye en `buf`; después se vuelca sobre
  // el array. Así las barras comparadas son siempre las que se ven en pantalla.
  function mezclar(r, buf, lo, mid, hi) {
    let i = lo;
    let j = mid;
    let k = lo;
    while (i < mid && j < hi) {
      // `<= 0`: ante un empate gana el de la izquierda, y eso da la estabilidad
      if (r.cmp(i, j) <= 0) buf[k++] = r.a[i++];
      else buf[k++] = r.a[j++];
    }
    while (i < mid) buf[k++] = r.a[i++];
    while (j < hi) buf[k++] = r.a[j++];
    for (k = lo; k < hi; k++) r.escribir(k, buf[k]);
  }

  function dividir(r, buf, lo, hi) {
    if (hi - lo < 2) return;
    const mid = lo + ((hi - lo) >> 1);
    dividir(r, buf, lo, mid);
    dividir(r, buf, mid, hi);
    mezclar(r, buf, lo, mid, hi);
  }

  function mergesort(r) {
    dividir(r, r.a.slice(), 0, r.a.length);
  }

  /* ---------- QuickSort (pivote mediana de tres) ---------- */

  // Ordena a[lo..hi] (ambos incluidos).
  //
  // Mediana de tres: se ordenan entre sí a[lo], a[mitad] y a[hi] (3 comparaciones),
  // de modo que la mediana queda en la mitad. Esa mediana es el pivote y se aparca
  // en hi-1; a[lo] y a[hi] quedan como centinelas que paran los dos índices sin
  // comprobar límites. Con entradas ordenadas o inversas el pivote cae en el centro.
  //
  // Recursión solo sobre la parte más pequeña y bucle sobre la grande: la pila no
  // pasa de O(log n).
  function quick(r, lo, hi) {
    while (lo < hi) {
      if (hi - lo === 1) {
        if (r.cmp(lo, hi) > 0) r.swap(lo, hi);
        r.fijar(lo);
        r.fijar(hi);
        return;
      }
      const m = lo + ((hi - lo) >> 1);
      if (r.cmp(m, lo) < 0) r.swap(m, lo);
      if (r.cmp(hi, lo) < 0) r.swap(hi, lo);
      if (r.cmp(hi, m) < 0) r.swap(hi, m);
      // Ahora a[lo] <= a[m] <= a[hi]
      if (hi - lo === 2) {
        r.fijar(lo);
        r.fijar(m);
        r.fijar(hi);
        return;
      }
      const p = hi - 1; // posición donde se aparca el pivote
      r.swap(m, p);
      r.pivote(p);
      let i = lo;
      let j = p;
      for (;;) {
        do i++; while (r.cmp(i, p) < 0); // para en un elemento >= pivote (como mucho en p)
        do j--; while (r.cmp(j, p) > 0); // para en un elemento <= pivote (como mucho en lo)
        if (i >= j) break;
        // Los iguales al pivote también se intercambian: reparte bien los repetidos
        r.swap(i, j);
      }
      r.swap(i, p); // el pivote cae en su sitio definitivo
      r.fijar(i);
      if (i - lo < hi - i) {
        quick(r, lo, i - 1);
        lo = i + 1;
      } else {
        quick(r, i + 1, hi);
        hi = i - 1;
      }
    }
    if (lo === hi) r.fijar(lo);
  }

  function quicksort(r) {
    quick(r, 0, r.a.length - 1);
  }

  /* ---------- Catálogo y complejidad ---------- */

  const ALGORITMOS = {
    burbuja: {
      id: 'burbuja',
      nombre: 'Burbuja',
      ordenar: envolver(burbuja),
      mejor: 'O(n)',
      medio: 'O(n²)',
      peor: 'O(n²)',
      memoria: 'O(1)',
      estable: true,
      descripcion:
        'Compara vecinos y los intercambia si están al revés. Esta versión se detiene en cuanto una pasada completa no intercambia nada.',
    },
    seleccion: {
      id: 'seleccion',
      nombre: 'Selección',
      ordenar: envolver(seleccion),
      mejor: 'O(n²)',
      medio: 'O(n²)',
      peor: 'O(n²)',
      memoria: 'O(1)',
      estable: false,
      descripcion:
        'Busca el mínimo de la parte sin ordenar y lo coloca al principio. Hace pocos intercambios (como mucho n − 1), pero siempre las mismas comparaciones.',
    },
    insercion: {
      id: 'insercion',
      nombre: 'Inserción',
      ordenar: envolver(insercion),
      mejor: 'O(n)',
      medio: 'O(n²)',
      peor: 'O(n²)',
      memoria: 'O(1)',
      estable: true,
      descripcion:
        'Va construyendo una parte ordenada por la izquierda e inserta en ella cada elemento nuevo. Muy rápida con entradas casi ordenadas.',
    },
    mergesort: {
      id: 'mergesort',
      nombre: 'MergeSort',
      ordenar: envolver(mergesort),
      mejor: 'O(n log n)',
      medio: 'O(n log n)',
      peor: 'O(n log n)',
      memoria: 'O(n)',
      estable: true,
      descripcion:
        'Divide el array por la mitad, ordena cada mitad y las mezcla con un buffer auxiliar. En los empates gana la izquierda, así que es estable.',
    },
    quicksort: {
      id: 'quicksort',
      nombre: 'QuickSort',
      ordenar: envolver(quicksort),
      mejor: 'O(n log n)',
      medio: 'O(n log n)',
      peor: 'O(n²)',
      memoria: 'O(log n)',
      estable: false,
      descripcion:
        'Elige un pivote (mediana de tres), reparte los menores a un lado y los mayores a otro, y repite en cada lado. La mediana de tres evita el peor caso con entradas ordenadas.',
    },
  };

  const ORDEN_ALGORITMOS = ['burbuja', 'seleccion', 'insercion', 'mergesort', 'quicksort'];

  /* ---------- Reproducción de pasos ---------- */

  function aplicarPaso(a, paso) {
    if (paso.tipo === 'intercambiar') {
      const t = a[paso.i];
      a[paso.i] = a[paso.j];
      a[paso.j] = t;
    } else if (paso.tipo === 'escribir') {
      a[paso.i] = paso.valor;
    }
  }

  // Devuelve una copia de `datos` con los primeros `hasta` pasos aplicados.
  function aplicarPasos(datos, pasos, hasta = pasos.length) {
    const a = datos.slice();
    for (let k = 0; k < hasta; k++) aplicarPaso(a, pasos[k]);
    return a;
  }

  /* ---------- Generador de entradas ---------- */

  // Generador pseudoaleatorio con semilla (mulberry32): misma semilla, misma entrada.
  function generador(semilla) {
    let s = semilla >>> 0;
    return function azar() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function barajar(a, azar) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  const TIPOS_ENTRADA = [
    { id: 'aleatoria', nombre: 'Aleatoria' },
    { id: 'casi-ordenada', nombre: 'Casi ordenada' },
    { id: 'inversa', nombre: 'Inversa' },
    { id: 'repetidos', nombre: 'Con repetidos' },
    { id: 'ordenada', nombre: 'Ya ordenada' },
  ];

  function generarEntrada(tipo, n, semilla = 1) {
    const azar = generador(semilla);
    const base = Array.from({ length: n }, (_, i) => i + 1);
    switch (tipo) {
      case 'aleatoria':
        return barajar(base, azar);
      case 'ordenada':
        return base;
      case 'inversa':
        return base.reverse();
      case 'casi-ordenada': {
        // Ordenada con ~10 % de desajustes pequeños (un elemento y otro cercano)
        const cambios = Math.max(1, Math.floor(n * 0.1));
        for (let k = 0; k < cambios && n > 1; k++) {
          const i = Math.floor(azar() * (n - 1));
          const j = Math.min(n - 1, i + 1 + Math.floor(azar() * 3));
          const t = base[i];
          base[i] = base[j];
          base[j] = t;
        }
        return base;
      }
      case 'repetidos': {
        const valores = Math.max(2, Math.round(Math.sqrt(n)));
        return Array.from({ length: n }, () => 1 + Math.floor(azar() * valores));
      }
      default:
        throw new Error('Tipo de entrada desconocido: ' + tipo);
    }
  }

  return {
    ALGORITMOS,
    ORDEN_ALGORITMOS,
    TIPOS_ENTRADA,
    generarEntrada,
    generador,
    aplicarPaso,
    aplicarPasos,
    porDefecto,
  };
});
