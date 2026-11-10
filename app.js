/* app.js — interfaz: canvas, animación y controles.
 * Toda la lógica de ordenación vive en sorting.js (objeto global `Ordenacion`);
 * aquí solo se reproducen los pasos que devuelve y se dibujan.
 */
(function () {
  'use strict';

  const O = window.Ordenacion;
  const $ = (selector, raiz = document) => raiz.querySelector(selector);

  // Pasos por segundo para cada posición del control de velocidad
  const VELOCIDADES = [2, 5, 10, 25, 60, 150, 400, 1000];
  // Pasos que cambian algo en pantalla; el resto (pivote, fijar, fin) se aplican "gratis"
  const VISIBLES = new Set(['comparar', 'intercambiar', 'escribir']);
  const MAX_PASOS_POR_FOTOGRAMA = 300;

  const el = {
    algA: $('#alg-a'),
    algB: $('#alg-b'),
    campoB: $('#campo-b'),
    comparar: $('#comparar'),
    tipo: $('#tipo'),
    tam: $('#tam'),
    tamOut: $('#tam-out'),
    nueva: $('#nueva'),
    semilla: $('#semilla'),
    reiniciar: $('#reiniciar'),
    atras: $('#atras'),
    play: $('#play'),
    adelante: $('#adelante'),
    vel: $('#vel'),
    velOut: $('#vel-out'),
    paneles: $('#paneles'),
    resumen: $('#resumen'),
    anuncio: $('#anuncio'),
    plantilla: $('#tpl-panel'),
  };

  const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');

  const estado = {
    algoritmos: ['burbuja', 'quicksort'], // [A, B]
    tipo: 'aleatoria',
    tam: 40,
    semilla: 1,
    base: [],
    max: 1,
    jugadores: [],
    observadores: [],
    reproduciendo: false,
    velocidad: 3,
  };

  /* ---------- Colores (se leen de style.css para no duplicarlos) ---------- */

  const colores = {};
  function leerColores() {
    const css = getComputedStyle(document.documentElement);
    for (const nombre of ['base', 'comparar', 'intercambiar', 'escribir', 'pivote', 'fijo', 'ink', 'muted']) {
      colores[nombre] = css.getPropertyValue('--' + nombre).trim() || '#888';
    }
  }

  /* ---------- Jugador: un algoritmo reproduciendo sus pasos ---------- */

  function crearJugador(id, panel) {
    const alg = O.ALGORITMOS[id];
    const res = alg.ordenar(estado.base);
    const jugador = {
      id,
      alg,
      pasos: res.pasos,
      total: res.comparaciones + res.intercambios + res.escrituras,
      panel,
      canvas: $('canvas', panel),
      ctx: null,
      barra: $('.barra', panel),
      estadoTexto: $('.estado', panel),
    };
    jugador.ctx = jugador.canvas.getContext('2d');
    reiniciarJugador(jugador);
    return jugador;
  }

  function reiniciarJugador(j) {
    j.idx = 0;
    j.datos = estado.base.slice();
    j.fijos = new Uint8Array(estado.base.length);
    j.marca = null; // último paso visible: { tipo, i, j }
    j.pivote = -1;
    j.hechas = 0; // pasos visibles ya ejecutados
    j.c = { comparaciones: 0, intercambios: 0, escrituras: 0 };
    j.terminado = false;
  }

  function aplicar(j, p) {
    switch (p.tipo) {
      case 'comparar':
        j.c.comparaciones++;
        j.hechas++;
        j.marca = p;
        break;
      case 'intercambiar':
        O.aplicarPaso(j.datos, p);
        j.c.intercambios++;
        j.hechas++;
        j.marca = p;
        break;
      case 'escribir':
        O.aplicarPaso(j.datos, p);
        j.c.escrituras++;
        j.hechas++;
        j.marca = p;
        break;
      case 'pivote':
        j.pivote = p.i;
        break;
      case 'fijar':
        j.fijos[p.i] = 1;
        if (j.pivote === p.i) j.pivote = -1;
        break;
      case 'fin':
        j.fijos.fill(1);
        j.pivote = -1;
        j.marca = null;
        j.terminado = true;
        break;
    }
  }

  // Avanza hasta ejecutar UN paso visible (más los invisibles que lo rodean).
  function avanzar(j) {
    let visto = false;
    while (j.idx < j.pasos.length) {
      const p = j.pasos[j.idx];
      const visible = VISIBLES.has(p.tipo);
      if (visible && visto) break;
      aplicar(j, p);
      j.idx++;
      if (visible) visto = true;
    }
  }

  // Paso atrás: no se deshace nada, se vuelve a reproducir desde el principio
  // hasta un paso visible antes (rápido: como mucho unas decenas de miles de pasos).
  function retroceder(j) {
    if (j.hechas === 0) return;
    const objetivo = j.hechas - 1;
    reiniciarJugador(j);
    while (j.hechas < objetivo && j.idx < j.pasos.length) avanzar(j);
  }

  function alFinal(j) {
    while (!j.terminado && j.idx < j.pasos.length) avanzar(j);
  }

  /* ---------- Texto accesible ---------- */

  function describir(j) {
    const d = j.datos;
    const nombre = j.alg.nombre;
    if (j.terminado) {
      const c = j.c;
      return `${nombre} ha terminado: ${c.comparaciones} comparaciones, ${c.intercambios} intercambios y ${c.escrituras} escrituras.`;
    }
    const m = j.marca;
    if (!m) return `${nombre}: listo para empezar.`;
    let texto;
    if (m.tipo === 'comparar') {
      texto = `Compara la posición ${m.i + 1} (valor ${d[m.i]}) con la posición ${m.j + 1} (valor ${d[m.j]}).`;
    } else if (m.tipo === 'intercambiar') {
      texto = `Intercambia las posiciones ${m.i + 1} y ${m.j + 1}; ahora valen ${d[m.i]} y ${d[m.j]}.`;
    } else {
      texto = `Escribe ${m.valor} en la posición ${m.i + 1}.`;
    }
    if (j.pivote >= 0) texto += ` Pivote: ${d[j.pivote]} (posición ${j.pivote + 1}).`;
    return texto;
  }

  function etiquetaCanvas(j) {
    const n = j.datos.length;
    let t = `${j.alg.nombre}. Gráfico de barras con ${n} valores. `;
    t += j.terminado ? 'Ordenado. ' : `Operación ${j.hechas} de ${j.total}. `;
    if (n <= 30) t += 'Valores: ' + j.datos.join(', ') + '.';
    return t;
  }

  let ultimoAnuncio = '';
  function anunciar(texto) {
    // Si el texto se repite se añade un espacio de no separación para que se vuelva a leer
    ultimoAnuncio = texto === ultimoAnuncio ? texto + ' ' : texto;
    el.anuncio.textContent = ultimoAnuncio;
  }

  function anunciarJugadores() {
    anunciar(
      estado.jugadores.map((j) => (estado.jugadores.length > 1 ? `${j.alg.nombre}: ` : '') + describir(j)).join(' ')
    );
  }

  /* ---------- Dibujo ---------- */

  function ajustarCanvas(j) {
    const dpr = window.devicePixelRatio || 1;
    const w = j.canvas.clientWidth;
    const h = j.canvas.clientHeight;
    if (!w || !h) return;
    j.canvas.width = Math.round(w * dpr);
    j.canvas.height = Math.round(h * dpr);
    j.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dibujar(j);
  }

  function colorBarra(j, i) {
    const m = j.marca;
    if (m && (i === m.i || i === m.j)) return colores[m.tipo];
    if (i === j.pivote) return colores.pivote;
    if (j.fijos[i]) return colores.fijo;
    return colores.base;
  }

  function dibujar(j) {
    const { ctx, canvas } = j;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    const n = j.datos.length;
    const ancho = w / n;
    const hueco = ancho > 8 ? Math.min(3, ancho * 0.15) : 0;
    const margenSup = 18;
    const etiquetas = ancho >= 24;
    ctx.font = '12px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let i = 0; i < n; i++) {
      const v = j.datos[i];
      const alto = Math.max(2, (v / estado.max) * (h - margenSup - 2));
      const x = i * ancho + hueco / 2;
      ctx.fillStyle = colorBarra(j, i);
      ctx.fillRect(x, h - alto, ancho - hueco, alto);
      if (etiquetas) {
        ctx.fillStyle = colores.muted;
        ctx.fillText(String(v), x + (ancho - hueco) / 2, h - alto - 2);
      }
    }
  }

  function pintarPanel(j) {
    dibujar(j);
    for (const k of ['comparaciones', 'intercambios', 'escrituras']) {
      $(`[data-c="${k}"]`, j.panel).textContent = j.c[k].toLocaleString('es-ES');
    }
    $('[data-c="progreso"]', j.panel).textContent = `${j.hechas.toLocaleString('es-ES')} / ${j.total.toLocaleString('es-ES')}`;
    j.barra.style.width = (j.total ? (100 * j.hechas) / j.total : 100) + '%';
    j.panel.classList.toggle('terminado', j.terminado);
    j.estadoTexto.textContent = describir(j);
  }

  function refrescar() {
    for (const j of estado.jugadores) pintarPanel(j);
    actualizarResumen();
    actualizarBotones();
  }

  function actualizarEtiquetas() {
    for (const j of estado.jugadores) j.canvas.setAttribute('aria-label', etiquetaCanvas(j));
  }

  function actualizarResumen() {
    const js = estado.jugadores;
    const listo = js.length > 1 && js.every((j) => j.terminado);
    el.resumen.hidden = !listo;
    if (!listo) return;
    const trozo = (j) =>
      `${j.alg.nombre}: ${j.c.comparaciones.toLocaleString('es-ES')} comparaciones y ${(j.c.intercambios + j.c.escrituras).toLocaleString('es-ES')} movimientos (intercambios + escrituras)`;
    const [a, b] = js;
    let veredicto;
    if (a.c.comparaciones === b.c.comparaciones) veredicto = 'Empatan en comparaciones.';
    else {
      const gana = a.c.comparaciones < b.c.comparaciones ? a : b;
      veredicto = `${gana.alg.nombre} necesita menos comparaciones.`;
    }
    el.resumen.textContent = `${trozo(a)}. ${trozo(b)}. ${veredicto}`;
  }

  /* ---------- Construcción ---------- */

  function construir() {
    pausar(false);
    const n = estado.tam;
    estado.base = O.generarEntrada(estado.tipo, n, estado.semilla);
    estado.max = Math.max(...estado.base);
    el.semilla.textContent = String(estado.semilla);

    const ids = el.comparar.checked ? estado.algoritmos : [estado.algoritmos[0]];
    for (const o of estado.observadores) o.disconnect();
    estado.observadores = [];
    el.paneles.replaceChildren();
    el.paneles.classList.toggle('doble', ids.length > 1);
    estado.jugadores = ids.map((id) => {
      const panel = el.plantilla.content.firstElementChild.cloneNode(true);
      $('.panel-titulo', panel).textContent = O.ALGORITMOS[id].nombre;
      $('.descripcion', panel).textContent = O.ALGORITMOS[id].descripcion;
      for (const dd of panel.querySelectorAll('[data-k]')) {
        const k = dd.dataset.k;
        const v = O.ALGORITMOS[id][k];
        dd.textContent = k === 'estable' ? (v ? 'Sí' : 'No') : v;
      }
      el.paneles.appendChild(panel);
      return crearJugador(id, panel);
    });

    for (const j of estado.jugadores) {
      const obs = new ResizeObserver(() => ajustarCanvas(j));
      obs.observe(j.canvas);
      estado.observadores.push(obs);
      ajustarCanvas(j);
    }
    refrescar();
    actualizarEtiquetas();
  }

  function reiniciar() {
    pausar(false);
    for (const j of estado.jugadores) reiniciarJugador(j);
    refrescar();
    actualizarEtiquetas();
    anunciar('Animación reiniciada.');
  }

  /* ---------- Animación ---------- */

  let ultimoT = 0;
  let acumulado = 0;

  function fotograma(t) {
    if (!estado.reproduciendo) return;
    if (!ultimoT) ultimoT = t;
    acumulado += ((t - ultimoT) / 1000) * VELOCIDADES[estado.velocidad];
    ultimoT = t;
    let n = Math.min(Math.floor(acumulado), MAX_PASOS_POR_FOTOGRAMA);
    acumulado = n >= MAX_PASOS_POR_FOTOGRAMA ? 0 : acumulado - n;
    while (n-- > 0 && !todosTerminados()) {
      for (const j of estado.jugadores) if (!j.terminado) avanzar(j);
    }
    refrescar();
    if (todosTerminados()) {
      pausar(true);
      return;
    }
    requestAnimationFrame(fotograma);
  }

  function todosTerminados() {
    return estado.jugadores.every((j) => j.terminado);
  }

  function reproducir() {
    if (todosTerminados()) for (const j of estado.jugadores) reiniciarJugador(j);
    estado.reproduciendo = true;
    ultimoT = 0;
    acumulado = 0;
    refrescar();
    requestAnimationFrame(fotograma);
  }

  function pausar(avisar) {
    const estabaReproduciendo = estado.reproduciendo;
    estado.reproduciendo = false;
    if (avisar && (estabaReproduciendo || todosTerminados())) {
      refrescar();
      actualizarEtiquetas();
      anunciarJugadores();
    } else {
      actualizarBotones();
    }
  }

  function alternar() {
    if (reducido.matches) {
      // Con "reducir movimiento" no hay animación continua: el botón salta al final
      for (const j of estado.jugadores) alFinal(j);
      refrescar();
      actualizarEtiquetas();
      anunciarJugadores();
    } else if (estado.reproduciendo) {
      pausar(true);
    } else {
      reproducir();
    }
  }

  function paso(sentido) {
    pausar(false);
    for (const j of estado.jugadores) {
      if (sentido > 0) {
        if (!j.terminado) avanzar(j);
      } else {
        retroceder(j);
      }
    }
    refrescar();
    actualizarEtiquetas();
    anunciarJugadores();
  }

  function actualizarBotones() {
    const reducir = reducido.matches;
    let texto;
    if (reducir) texto = 'Ir al final';
    else if (estado.reproduciendo) texto = 'Pausa';
    else texto = todosTerminados() ? 'Repetir' : 'Reproducir';
    el.play.textContent = texto;
    el.play.setAttribute('aria-pressed', String(estado.reproduciendo));
    el.vel.disabled = reducir;
    el.atras.disabled = estado.jugadores.every((j) => j.hechas === 0);
    el.adelante.disabled = todosTerminados();
  }

  /* ---------- Controles ---------- */

  function cambiarVelocidad(v) {
    estado.velocidad = Math.max(0, Math.min(VELOCIDADES.length - 1, v));
    el.vel.value = String(estado.velocidad);
    el.velOut.textContent = `${VELOCIDADES[estado.velocidad]} pasos/s`;
  }

  function nuevaSemilla() {
    estado.semilla = 1 + Math.floor(Math.random() * 999999);
  }

  function activarComparacion(activa) {
    el.comparar.checked = activa;
    el.campoB.hidden = !activa;
    construir();
    anunciar(activa ? 'Modo comparación activado.' : 'Modo comparación desactivado.');
  }

  function rellenarSelects() {
    for (const id of O.ORDEN_ALGORITMOS) {
      for (const sel of [el.algA, el.algB]) sel.add(new Option(O.ALGORITMOS[id].nombre, id));
    }
    for (const t of O.TIPOS_ENTRADA) el.tipo.add(new Option(t.nombre, t.id));
    el.algA.value = estado.algoritmos[0];
    el.algB.value = estado.algoritmos[1];
    el.tipo.value = estado.tipo;
  }

  function rellenarTabla() {
    const cuerpo = $('#tabla-complejidad tbody');
    for (const id of O.ORDEN_ALGORITMOS) {
      const a = O.ALGORITMOS[id];
      const fila = cuerpo.insertRow();
      for (const v of [a.nombre, a.mejor, a.medio, a.peor, a.memoria, a.estable ? 'Sí' : 'No']) {
        fila.insertCell().textContent = v;
      }
    }
  }

  function enlazarControles() {
    el.algA.addEventListener('change', () => {
      estado.algoritmos[0] = el.algA.value;
      construir();
    });
    el.algB.addEventListener('change', () => {
      estado.algoritmos[1] = el.algB.value;
      construir();
    });
    el.comparar.addEventListener('change', () => activarComparacion(el.comparar.checked));
    el.tipo.addEventListener('change', () => {
      estado.tipo = el.tipo.value;
      construir();
    });
    el.tam.addEventListener('input', () => {
      estado.tam = Number(el.tam.value);
      el.tamOut.textContent = String(estado.tam);
      construir();
    });
    el.nueva.addEventListener('click', () => {
      nuevaSemilla();
      construir();
      anunciar('Nueva entrada generada.');
    });
    el.reiniciar.addEventListener('click', reiniciar);
    el.play.addEventListener('click', alternar);
    el.atras.addEventListener('click', () => paso(-1));
    el.adelante.addEventListener('click', () => paso(1));
    el.vel.addEventListener('input', () => cambiarVelocidad(Number(el.vel.value)));
    reducido.addEventListener('change', () => {
      pausar(false);
      actualizarBotones();
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const objetivo = e.target;
      // No pisar el teclado de los controles nativos (flechas del deslizador, del desplegable...)
      if (objetivo.closest('select, input, textarea')) return;
      const enBoton = objetivo.closest('button');
      switch (e.key) {
        case ' ':
          if (enBoton) return; // el botón ya reacciona al espacio
          e.preventDefault();
          alternar();
          break;
        case 'ArrowRight':
          e.preventDefault();
          paso(1);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          paso(-1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          cambiarVelocidad(estado.velocidad + 1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          cambiarVelocidad(estado.velocidad - 1);
          break;
        case 'n':
        case 'N':
          el.nueva.click();
          break;
        case 'r':
        case 'R':
          reiniciar();
          break;
        case 'c':
        case 'C':
          activarComparacion(!el.comparar.checked);
          break;
        default:
          if (/^[1-5]$/.test(e.key)) {
            const id = O.ORDEN_ALGORITMOS[Number(e.key) - 1];
            el.algA.value = id;
            estado.algoritmos[0] = id;
            construir();
            anunciar(`Algoritmo: ${O.ALGORITMOS[id].nombre}.`);
          }
      }
    });
  }

  /* ---------- Inicio ---------- */

  leerColores();
  rellenarSelects();
  rellenarTabla();
  nuevaSemilla();
  estado.tam = Number(el.tam.value);
  cambiarVelocidad(estado.velocidad);
  enlazarControles();
  construir();
})();
