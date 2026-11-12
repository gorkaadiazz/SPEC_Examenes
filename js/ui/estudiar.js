// Pantalla "Estudiar" (sección 5.3 y plan B de la 4.6, sin IA):
//  · Examen de práctica: importas las preguntas en JSON (las puedes pedir en
//    cualquier chat con tus apuntes), respondes y te corriges tú comparando
//    con la respuesta modelo. Los fallos se pueden pasar a flashcards.
//  · Flashcards con repetición espaciada sencilla.
//  · Pomodoro asociado a un módulo, con el tiempo estudiado por semana.

import { h, poner, campo, opciones, abrirHoja } from '../utils/dom.js';
import { fechaCorta } from '../utils/fechas.js';
import { leerExamenJSON, notaMedia, temasFlojos, FORMATO_JSON, PROMPT_PARA_CHAT } from '../utils/examen.js';
import { repasar, pendientes as tarjetasDeHoy, hoy } from '../tools/repaso.js';
import * as repoModulos from '../repos/modulos.js';
import * as repoExamenes from '../repos/examenes.js';
import * as repoPerfil from '../repos/perfil.js';
import { flashcards as repoTarjetas, pomodoro as repoPomodoro } from '../repos/varios.js';
import { escribir, preparar } from '../repos/base.js';
import { avisar } from '../utils/avisos.js';
import { icono } from './iconos.js';

const estado = {
  pestana: 'examen', // 'examen' | 'flashcards' | 'pomodoro'
  moduloId: null,
  error: '',
  examen: null, // { preguntas, respuestas: string[] }
  resultado: null, // { preguntas, respuestas:[{respuesta,nota}], nota, id?, auto? }
  repaso: null, // { cola: tarjeta[], vista: boolean }
};

// El temporizador vive fuera de la pantalla para que siga al cambiar de pestaña
const reloj = { fase: 'trabajo', fin: null, restante: null, inicio: null, intervalo: null };

function repintar(arriba = false) {
  if (arriba) window.scrollTo(0, 0);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Chips para elegir módulo (compartido por las tres pestañas). */
function selectorModulo(modulos) {
  const sel = opciones('Módulo', 'modulo', modulos.map((m) => ({ valor: m.id, texto: m.abreviatura, color: m.color })), estado.moduloId);
  sel.addEventListener('change', (e) => { if (e.target.name === 'modulo') { estado.moduloId = e.target.value; estado.error = ''; repintar(); } });
  return sel;
}

export async function render(cont) {
  const modulos = await repoModulos.listar();
  if (!modulos.some((m) => m.id === estado.moduloId)) estado.moduloId = modulos[0]?.id ?? null;
  const modulo = modulos.find((m) => m.id === estado.moduloId);

  if (estado.examen && !estado.resultado) return renderExamen(cont);
  if (estado.resultado) return renderResultado(cont);
  if (estado.repaso) return renderRepaso(cont);

  const pestanas = opciones('Sección', 'pestana', [['examen', 'Examen'], ['flashcards', 'Flashcards'], ['pomodoro', 'Pomodoro']], estado.pestana, 'segmentos');
  pestanas.querySelector('legend').classList.add('oculto');
  pestanas.addEventListener('change', (e) => { if (e.target.name === 'pestana') { estado.pestana = e.target.value; repintar(); } });

  poner(cont, h('header', { class: 'barra-superior' }, h('h1', { class: 'titulo-pantalla' }, 'Estudiar')), pestanas);
  if (!modulo) return poner(cont, h('div', { class: 'vacio' }, h('span', { class: 'vacio-icono' }, icono('estudiar')), h('h2', {}, 'Primero crea un módulo'), h('p', {}, 'Lo que estudies se guarda por módulo.')));
  poner(cont, selectorModulo(modulos));
  if (estado.pestana === 'flashcards') return renderTarjetas(cont, modulo);
  if (estado.pestana === 'pomodoro') return renderPomodoro(cont, modulo, modulos);
  return renderInicioExamen(cont, modulo);
}

// ---------------------------------------------------------------------------
// Examen de práctica
// ---------------------------------------------------------------------------

async function renderInicioExamen(cont, modulo) {
  const intentos = await repoExamenes.deModulo(modulo.id);
  const ultimos = intentos.slice(-8);
  const flojos = temasFlojos(intentos).slice(0, 6);
  poner(
    cont,
    h(
      'section',
      { class: 'seccion' },
      h('p', { class: 'suave' }, 'Pide un examen de preguntas cortas en cualquier chat (pásale tus apuntes), pégalo aquí y hazlo. Al terminar ves las respuestas y te pones nota.'),
      h('button', { type: 'button', class: 'boton primario ancho', onclick: abrirImportar }, 'Importar un examen'),
    ),
    intentos.length
      ? h(
          'section',
          { class: 'seccion', style: `--c:${modulo.color}` },
          h('h2', {}, `Historial de ${modulo.abreviatura}`),
          h('div', { class: 'evolucion', role: 'img', 'aria-label': `Notas de los últimos ${ultimos.length} intentos: ${ultimos.map((i) => i.nota).join(', ')}` }, ultimos.map((i) => h('div', { class: 'evolucion-barra' }, h('b', { class: 'num' }, String(i.nota)), h('span', { style: `height:${Math.max(4, i.nota * 10)}%` })))),
          flojos.length ? h('div', {}, h('p', { class: 'ayuda' }, 'Temas flojos (media por debajo de 5):'), h('div', { class: 'chips' }, flojos.map((t) => h('span', { class: 'pastilla pasada' }, `${t.tema} · ${t.media}`)))) : null,
          h(
            'div',
            { class: 'grupo' },
            [...intentos].reverse().map((i) =>
              h(
                'button',
                { type: 'button', class: 'publicacion', onclick: () => { estado.resultado = { preguntas: i.preguntas, respuestas: i.respuestas, nota: i.nota, id: i.id }; repintar(true); } },
                h('span', { class: 'cuerpo' }, h('span', { class: 'titulo' }, (i.temas ?? []).slice(0, 3).join(', ') || 'Examen de práctica'), h('span', { class: 'meta' }, `${fechaCorta(i.fecha)} · ${i.preguntas.length} preguntas`)),
                h('span', { class: `pastilla ${i.nota >= 5 ? 'aprobado' : 'suspendido'}` }, String(i.nota)),
              ),
            ),
          ),
        )
      : null,
  );
}

function abrirImportar() {
  const area = h('textarea', { rows: 8, placeholder: 'Pega aquí el JSON', 'aria-label': 'Examen en JSON' });
  const error = h('p', { class: 'error', role: 'alert' });
  const copiar = h('button', { type: 'button', class: 'boton', onclick: async () => { await navigator.clipboard?.writeText(PROMPT_PARA_CHAT).catch(() => {}); copiar.textContent = 'Copiada'; } }, 'Copiar la petición para el chat');
  const pegar = h('button', { type: 'button', class: 'boton', onclick: async () => { area.value = (await navigator.clipboard?.readText().catch(() => '')) || area.value; } }, 'Pegar');
  const form = h(
    'form',
    { class: 'formulario', onsubmit: importar },
    h('p', { class: 'suave' }, '1. Copia la petición y pégala en un chat junto con tus apuntes. 2. Copia lo que te devuelva y pégalo aquí. Tiene que tener este formato:'),
    h('pre', { class: 'codigo' }, FORMATO_JSON),
    h('div', { class: 'fila' }, copiar, pegar),
    area,
    error,
    h('div', { class: 'hoja-pie' }, h('button', { type: 'submit', class: 'boton primario' }, 'Empezar examen')),
  );
  const hoja = abrirHoja('Importar examen', form);
  function importar(e) {
    e.preventDefault();
    try {
      const preguntas = leerExamenJSON(area.value);
      hoja.close();
      estado.examen = { preguntas, respuestas: preguntas.map(() => '') };
      estado.error = '';
      repintar(true);
    } catch (err) {
      error.textContent = err.message;
    }
  }
}

function renderExamen(cont) {
  const { preguntas, respuestas } = estado.examen;
  const salir = () => {
    if (respuestas.some((r) => r.trim()) && !confirm('¿Salir del examen? Se perderán tus respuestas.')) return;
    estado.examen = null;
    repintar(true);
  };
  poner(
    cont,
    h('header', { class: 'barra-superior' }, h('button', { type: 'button', class: 'boton-icono atras', 'aria-label': 'Salir del examen', onclick: salir }, icono('atras')), h('h1', { class: 'titulo-pantalla crece' }, `Examen · ${preguntas.length} preguntas`)),
    h('ol', { class: 'preguntas' }, preguntas.map((p, i) => h('li', {}, h('label', { class: 'campo' }, h('span', { class: 'enunciado' }, h('b', { class: 'num' }, `${i + 1}. `), p.pregunta), h('textarea', { rows: 3, maxlength: 1500, placeholder: 'Tu respuesta', oninput: (e) => (respuestas[i] = e.target.value) }, respuestas[i]))))),
    h('button', { type: 'button', class: 'boton primario ancho', onclick: () => { estado.resultado = { preguntas, respuestas: respuestas.map((r) => ({ respuesta: r, nota: null })), nota: null, auto: true }; estado.error = ''; repintar(true); } }, 'Ver las respuestas y corregirme'),
  );
}

function renderResultado(cont) {
  const r = estado.resultado;
  const clase = (nota) => (nota == null ? '' : nota >= 5 ? 'aprobado' : 'suspendido');
  const volver = () => { estado.resultado = null; repintar(true); };
  const fallos = r.auto ? [] : r.preguntas.filter((_, i) => (r.respuestas[i]?.nota ?? 0) < 5);

  poner(
    cont,
    h(
      'header',
      { class: 'barra-superior' },
      h('button', { type: 'button', class: 'boton-icono atras', 'aria-label': 'Volver', onclick: volver }, icono('atras')),
      h('h1', { class: 'titulo-pantalla crece' }, r.auto ? 'Corrígete' : 'Resultado'),
      r.id ? h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Borrar este intento', title: 'Borrar este intento', onclick: borrarIntento }, icono('papelera')) : null,
    ),
    r.auto ? h('p', { class: 'suave' }, 'Compara cada respuesta con la respuesta modelo y ponte nota.') : h('div', { class: 'nota-final' }, h('b', { class: `num ${clase(r.nota)}` }, String(r.nota)), h('span', {}, `de 10 · ${r.preguntas.length} preguntas`)),
    h(
      'ol',
      { class: 'preguntas' },
      r.preguntas.map((p, i) => {
        const resp = r.respuestas[i];
        const auto = r.auto ? opciones('¿Cómo la tenías?', `auto-${i}`, [['0', 'No la sabía'], ['5', 'A medias'], ['10', 'La sabía']], resp.nota == null ? '' : String(resp.nota), 'segmentos') : null;
        auto?.addEventListener('change', (e) => (resp.nota = Number(e.target.value)));
        return h(
          'li',
          {},
          h('p', { class: 'enunciado' }, h('b', { class: 'num' }, `${i + 1}. `), p.pregunta, r.auto ? null : h('span', { class: `pastilla ${clase(resp.nota)}` }, String(resp.nota))),
          h('p', { class: 'respuesta' }, h('span', { class: 'ayuda' }, 'Tu respuesta'), resp.respuesta?.trim() || '(en blanco)'),
          h('p', { class: 'respuesta modelo' }, h('span', { class: 'ayuda' }, 'Respuesta modelo'), p.respuesta_modelo),
          auto,
        );
      }),
    ),
    estado.error ? h('p', { class: 'error', role: 'alert' }, estado.error) : null,
    r.auto ? h('button', { type: 'button', class: 'boton primario ancho', onclick: guardarAuto }, 'Guardar mi nota') : null,
    fallos.length ? h('button', { type: 'button', class: 'boton ancho', onclick: aTarjetas }, `Convertir ${fallos.length === 1 ? 'el fallo' : `los ${fallos.length} fallos`} en flashcards`) : null,
  );

  async function guardarAuto() {
    if (r.respuestas.some((x) => x.nota == null)) {
      estado.error = 'Ponte nota en todas las preguntas.';
      return repintar();
    }
    const nota = notaMedia(r.respuestas.map((x) => x.nota));
    const fila = await repoExamenes.guardar({ modulo_id: estado.moduloId, temas: [...new Set(r.preguntas.map((p) => p.tema))], preguntas: r.preguntas, respuestas: r.respuestas, nota, fecha: new Date().toISOString() });
    estado.examen = null;
    estado.error = '';
    estado.resultado = { preguntas: r.preguntas, respuestas: r.respuestas, nota, id: fila.id };
    repintar(true);
  }

  async function aTarjetas() {
    const existentes = new Set((await repoTarjetas.porIndice('modulo_id', estado.moduloId)).map((t) => t.pregunta));
    const nuevas = fallos.filter((p) => !existentes.has(p.pregunta));
    await escribir(nuevas.map((p) => ({ tabla: 'flashcards', op: 'upsert', fila: preparar({ modulo_id: estado.moduloId, pregunta: p.pregunta, respuesta: p.respuesta_modelo, nivel: 0, proxima_revision: hoy() }) })));
    alert(nuevas.length ? `${nuevas.length} ${nuevas.length === 1 ? 'flashcard creada' : 'flashcards creadas'}. Están en la pestaña Flashcards.` : 'Esas preguntas ya estaban en tus flashcards.');
  }

  async function borrarIntento() {
    if (!confirm('¿Borrar este intento del historial?')) return;
    await repoExamenes.borrar(r.id);
    estado.resultado = null;
    repintar(true);
  }
}

// ---------------------------------------------------------------------------
// Flashcards
// ---------------------------------------------------------------------------

async function renderTarjetas(cont, modulo) {
  const tarjetas = await repoTarjetas.porIndice('modulo_id', modulo.id);
  const tocan = tarjetasDeHoy(tarjetas);
  poner(
    cont,
    h(
      'section',
      { class: 'seccion' },
      h('div', { class: 'nota-final' }, h('b', { class: 'num' }, String(tocan.length)), h('span', {}, tocan.length === 1 ? 'tarjeta para repasar hoy' : 'tarjetas para repasar hoy')),
      h('button', { type: 'button', class: 'boton primario ancho', disabled: !tocan.length, onclick: () => { estado.repaso = { cola: tocan, vista: false }; repintar(true); } }, tocan.length ? 'Repasar ahora' : 'Nada que repasar hoy'),
      h('button', { type: 'button', class: 'boton ancho', onclick: () => abrirTarjeta(modulo) }, 'Nueva flashcard'),
    ),
    tarjetas.length
      ? h(
          'section',
          { class: 'seccion' },
          h('h2', {}, `Todas (${tarjetas.length})`),
          h('div', { class: 'grupo' }, tarjetas.sort((a, b) => a.pregunta.localeCompare(b.pregunta, 'es')).map((t) => h('button', { type: 'button', class: 'publicacion', onclick: () => abrirTarjeta(modulo, t) }, h('span', { class: 'cuerpo' }, h('span', { class: 'titulo' }, t.pregunta), h('span', { class: 'meta' }, t.proxima_revision <= hoy() ? 'Toca hoy' : `Vuelve el ${fechaCorta(`${t.proxima_revision}T12:00`)}`)), h('span', { class: 'pastilla' }, `Nivel ${t.nivel}`)))),
        )
      : h('p', { class: 'ayuda' }, 'Aún no hay flashcards en este módulo. Créalas a mano o desde los fallos de un examen de práctica.'),
  );
}

function abrirTarjeta(modulo, tarjeta = null) {
  const error = h('p', { class: 'error', role: 'alert' });
  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar },
    campo('Pregunta', h('textarea', { name: 'pregunta', rows: 3, maxlength: 600 }, tarjeta?.pregunta ?? '')),
    campo('Respuesta', h('textarea', { name: 'respuesta', rows: 4, maxlength: 1200 }, tarjeta?.respuesta ?? '')),
    error,
    h('div', { class: 'hoja-pie' }, tarjeta ? h('button', { type: 'button', class: 'boton peligro redondo', 'aria-label': 'Borrar flashcard', onclick: borrar }, icono('papelera')) : null, h('button', { type: 'submit', class: 'boton primario' }, 'Guardar')),
  );
  const hoja = abrirHoja(tarjeta ? 'Editar flashcard' : `Nueva flashcard de ${modulo.abreviatura}`, form);
  async function guardar(e) {
    e.preventDefault();
    const d = new FormData(form);
    const pregunta = d.get('pregunta').trim();
    const respuesta = d.get('respuesta').trim();
    if (!pregunta || !respuesta) return (error.textContent = 'Escribe la pregunta y la respuesta.');
    await repoTarjetas.guardar({ nivel: 0, proxima_revision: hoy(), ...(tarjeta ?? {}), modulo_id: modulo.id, pregunta, respuesta });
    hoja.close();
  }
  async function borrar() {
    if (!confirm('¿Borrar esta flashcard?')) return;
    await repoTarjetas.borrar(tarjeta.id);
    hoja.close();
  }
}

function renderRepaso(cont) {
  const { cola, vista } = estado.repaso;
  const tarjeta = cola[0];
  const salir = () => { estado.repaso = null; repintar(true); };
  if (!tarjeta) {
    return poner(cont, h('header', { class: 'barra-superior' }, h('button', { type: 'button', class: 'boton-icono atras', 'aria-label': 'Volver', onclick: salir }, icono('atras')), h('h1', { class: 'titulo-pantalla crece' }, 'Repaso')), h('div', { class: 'vacio' }, h('span', { class: 'vacio-icono' }, icono('temas')), h('h2', {}, 'Repaso terminado'), h('p', {}, 'Las que no te sabías volverán antes.'), h('button', { type: 'button', class: 'boton primario', onclick: salir }, 'Volver')));
  }
  const responder = async (respuesta) => {
    const nueva = repasar(tarjeta, respuesta);
    estado.repaso = { cola: respuesta === 'no' ? [...cola.slice(1), nueva] : cola.slice(1), vista: false };
    await repoTarjetas.guardar(nueva); // repinta al guardar
  };
  poner(
    cont,
    h('header', { class: 'barra-superior' }, h('button', { type: 'button', class: 'boton-icono atras', 'aria-label': 'Dejar el repaso', onclick: salir }, icono('atras')), h('h1', { class: 'titulo-pantalla crece' }, `Repaso · quedan ${cola.length}`)),
    h('div', { class: 'tarjeta-repaso' }, h('p', { class: 'ayuda' }, 'Pregunta'), h('p', { class: 'tarjeta-texto' }, tarjeta.pregunta), vista ? [h('p', { class: 'ayuda' }, 'Respuesta'), h('p', { class: 'tarjeta-texto respuesta modelo' }, tarjeta.respuesta)] : null),
    vista
      ? h('div', { class: 'tres' }, h('button', { type: 'button', class: 'boton peligro', onclick: () => responder('no') }, 'No me la sé'), h('button', { type: 'button', class: 'boton', onclick: () => responder('dudosa') }, 'Dudosa'), h('button', { type: 'button', class: 'boton primario', onclick: () => responder('se') }, 'Me la sé'))
      : h('button', { type: 'button', class: 'boton primario ancho', onclick: () => { estado.repaso.vista = true; repintar(); } }, 'Ver la respuesta'),
  );
}

// ---------------------------------------------------------------------------
// Pomodoro
// ---------------------------------------------------------------------------

const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/** Actualiza el reloj en pantalla cada segundo y, al llegar a cero, cambia de fase. */
function tic(duraciones) {
  const queda = reloj.fin - Date.now();
  const el = document.querySelector('[data-reloj]');
  if (el) el.textContent = mmss(queda);
  if (queda > 0) return;
  clearInterval(reloj.intervalo);
  reloj.intervalo = null;
  reloj.fin = null;
  const eraTrabajo = reloj.fase === 'trabajo';
  if (eraTrabajo) repoPomodoro.guardar({ modulo_id: estado.moduloId, inicio: reloj.inicio, minutos: duraciones.trabajo });
  reloj.fase = eraTrabajo ? 'descanso' : 'trabajo';
  reloj.restante = null;
  avisar(eraTrabajo ? 'Pomodoro terminado' : 'Se acabó el descanso', eraTrabajo ? `Descansa ${duraciones.descanso} minutos.` : 'A por otro pomodoro.');
  repintar();
}

async function renderPomodoro(cont, modulo, modulos) {
  const [perfil, sesiones] = await Promise.all([repoPerfil.obtener(), repoPomodoro.todos()]);
  const duraciones = perfil.preferencias.pomodoro;
  const total = (reloj.fase === 'trabajo' ? duraciones.trabajo : duraciones.descanso) * 60_000;
  const queda = reloj.fin ? reloj.fin - Date.now() : reloj.restante ?? total;
  const enMarcha = !!reloj.fin;

  const empezar = () => {
    if (!reloj.inicio || reloj.restante == null) reloj.inicio = new Date().toISOString();
    reloj.fin = Date.now() + (reloj.restante ?? total);
    reloj.restante = null;
    clearInterval(reloj.intervalo);
    reloj.intervalo = setInterval(() => tic(duraciones), 500);
    repintar();
  };
  const pausar = () => { reloj.restante = reloj.fin - Date.now(); reloj.fin = null; clearInterval(reloj.intervalo); reloj.intervalo = null; repintar(); };
  const reiniciar = () => { clearInterval(reloj.intervalo); Object.assign(reloj, { fase: 'trabajo', fin: null, restante: null, inicio: null, intervalo: null }); repintar(); };

  // Tiempo estudiado esta semana (de lunes a domingo), por módulo
  const lunes = new Date();
  lunes.setHours(0, 0, 0, 0);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  const porModulo = new Map();
  for (const s of sesiones) if (new Date(s.inicio) >= lunes) porModulo.set(s.modulo_id, (porModulo.get(s.modulo_id) ?? 0) + s.minutos);
  const horas = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

  poner(
    cont,
    h(
      'section',
      { class: 'seccion pomodoro', style: `--c:${modulo.color}` },
      h('p', { class: 'ayuda' }, reloj.fase === 'trabajo' ? `Estudiando ${modulo.abreviatura}` : 'Descanso'),
      h('p', { class: 'reloj num', 'data-reloj': '', role: 'timer' }, mmss(queda)),
      h('div', { class: 'fila centro' }, enMarcha ? h('button', { type: 'button', class: 'boton primario', onclick: pausar }, 'Pausar') : h('button', { type: 'button', class: 'boton primario', onclick: empezar }, reloj.restante != null ? 'Seguir' : 'Empezar'), h('button', { type: 'button', class: 'boton', onclick: reiniciar }, 'Reiniciar')),
      h('button', { type: 'button', class: 'enlace', onclick: () => abrirDuraciones(duraciones) }, `${duraciones.trabajo} min de estudio · ${duraciones.descanso} de descanso`),
    ),
    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Esta semana'),
      porModulo.size
        ? h('div', { class: 'grupo' }, modulos.filter((m) => porModulo.has(m.id)).map((m) => h('div', { class: 'fila-ra', style: `--c:${m.color}` }, h('i', { class: 'punto-modulo' }), h('span', { class: 'cuerpo' }, h('b', {}, m.nombre)), h('span', { class: 'pastilla' }, horas(porModulo.get(m.id))))))
        : h('p', { class: 'ayuda' }, 'Cuando termines un pomodoro, el tiempo se suma aquí.'),
    ),
  );
  // Si el temporizador ya estaba en marcha (se cambió de pantalla), se retoma
  if (enMarcha && !reloj.intervalo) reloj.intervalo = setInterval(() => tic(duraciones), 500);
}

function abrirDuraciones(d) {
  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar },
    h('div', { class: 'dos' }, campo('Estudio (min)', h('input', { name: 'trabajo', type: 'number', min: 1, max: 120, value: d.trabajo, inputmode: 'numeric', required: true })), campo('Descanso (min)', h('input', { name: 'descanso', type: 'number', min: 1, max: 60, value: d.descanso, inputmode: 'numeric', required: true }))),
    h('div', { class: 'hoja-pie' }, h('button', { type: 'submit', class: 'boton primario' }, 'Guardar')),
  );
  const hoja = abrirHoja('Duración del Pomodoro', form);
  async function guardar(e) {
    e.preventDefault();
    const f = new FormData(form);
    const acotar = (v, max, def) => Math.min(max, Math.max(1, Math.round(Number(v)) || def));
    await repoPerfil.guardar({}, { pomodoro: { trabajo: acotar(f.get('trabajo'), 120, 25), descanso: acotar(f.get('descanso'), 60, 5) } });
    hoja.close();
  }
}
