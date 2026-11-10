// Pantalla "Estudiar": examen de práctica de preguntas cortas (sección 4.6).
//  1. Eliges módulo, apuntes, nº de preguntas y dificultad.
//  2. La IA (Gemini, a través de la Edge Function) crea las preguntas.
//  3. Respondes escribiendo y la IA corrige cada respuesta del 0 al 10.
//  4. El intento se guarda en el historial del módulo.
// Plan B sin IA: importar las preguntas en JSON y corregirte tú mismo.

import { h, poner, campo, opciones, abrirHoja } from '../utils/dom.js';
import { fechaCorta } from '../utils/fechas.js';
import { textoDePDF, MINIMO_TEXTO_UTIL } from '../utils/pdf.js';
import { leerExamenJSON, notaMedia, temasFlojos, FORMATO_JSON, PROMPT_PARA_CHAT } from '../utils/examen.js';
import * as ia from '../ia.js';
import * as db from '../sync/db.js';
import * as repoModulos from '../repos/modulos.js';
import * as repoArchivos from '../repos/archivos.js';
import * as repoExamenes from '../repos/examenes.js';
import { tamanoLegible } from '../repos/archivos.js';
import { icono } from './iconos.js';

const MAX_TEXTO = 120_000; // caracteres de temario que se envían
const MAX_ARCHIVOS_IA = 3; // apuntes que la IA lee directamente (escaneados o fotos)

// Estado de la pantalla (vive mientras la app esté abierta)
const estado = {
  paso: 'inicio', // 'inicio' | 'examen' | 'resultado'
  moduloId: null,
  elegidos: new Set(), // ids de los apuntes marcados
  textoPegado: '',
  num: 10,
  dificultad: 'media',
  ocupado: '', // texto de "trabajando…"
  error: '',
  uso: null, // { usadas, limite } de la última llamada
  examen: null, // { preguntas, respuestas: string[] }
  resultado: null, // { preguntas, respuestas:[{respuesta,nota,comentario}], nota, id?, auto? }
};

function repintar(arriba = false) {
  if (arriba) window.scrollTo(0, 0);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export async function render(cont) {
  if (estado.paso === 'examen') return renderExamen(cont);
  if (estado.paso === 'resultado') return renderResultado(cont);
  return renderInicio(cont);
}

// ---------------------------------------------------------------------------
// 1. Preparar el examen
// ---------------------------------------------------------------------------

async function renderInicio(cont) {
  const modulos = await repoModulos.listar();
  if (!modulos.some((m) => m.id === estado.moduloId)) estado.moduloId = modulos[0]?.id ?? null;
  const modulo = modulos.find((m) => m.id === estado.moduloId);
  const [apuntes, intentos, usoLocal] = modulo ? await Promise.all([repoArchivos.deModulo(modulo.id), repoExamenes.deModulo(modulo.id), db.todos('uso_ia')]) : [[], [], []];
  for (const id of [...estado.elegidos]) if (!apuntes.some((a) => a.id === id)) estado.elegidos.delete(id);

  const sinIA = ia.motivoSinIA();
  const hoy = new Date().toISOString().slice(0, 10);
  const uso = estado.uso ?? (usoLocal.find((u) => u.fecha === hoy) ? { usadas: usoLocal.find((u) => u.fecha === hoy).llamadas, limite: null } : null);

  const selModulo = opciones('Módulo', 'modulo', modulos.map((m) => ({ valor: m.id, texto: m.abreviatura, color: m.color })), estado.moduloId);
  selModulo.addEventListener('change', (e) => {
    estado.moduloId = e.target.value;
    estado.elegidos.clear();
    estado.error = '';
    repintar();
  });
  const selNum = opciones('Preguntas', 'num', [['5', '5'], ['10', '10'], ['20', '20']], String(estado.num), 'segmentos');
  selNum.addEventListener('change', (e) => (estado.num = Number(e.target.value)));
  const selDif = opciones('Dificultad', 'dificultad', [['facil', 'Fácil'], ['media', 'Media'], ['dificil', 'Difícil']], estado.dificultad, 'segmentos');
  selDif.addEventListener('change', (e) => (estado.dificultad = e.target.value));

  const listaApuntes = apuntes.length
    ? h(
        'div',
        { class: 'lista-edit' },
        apuntes.map((a) =>
          h(
            'label',
            { class: 'renglon elegir' },
            h('input', { type: 'checkbox', class: 'casilla', checked: estado.elegidos.has(a.id), onchange: (e) => (e.target.checked ? estado.elegidos.add(a.id) : estado.elegidos.delete(a.id)) }),
            h('span', { class: 'apunte-texto' }, h('span', { class: 'apunte-nombre' }, a.nombre), h('span', { class: 'apunte-meta' }, `${a.tipo === 'application/pdf' ? 'PDF' : 'Foto'} · ${tamanoLegible(a.tamano)}`)),
          ),
        ),
      )
    : h('p', { class: 'ayuda' }, 'Este módulo aún no tiene apuntes. Súbelos desde el módulo o desde un examen, o pega el temario aquí abajo.');

  const pegado = h('textarea', { placeholder: 'O pega aquí el texto del temario', 'aria-label': 'Texto del temario', maxlength: MAX_TEXTO, oninput: (e) => (estado.textoPegado = e.target.value) }, estado.textoPegado);

  poner(
    cont,
    h('header', { class: 'barra-superior' }, h('h1', { class: 'titulo-pantalla' }, 'Estudiar')),
    modulos.length
      ? h(
          'section',
          { class: 'formulario plano' },
          h('h2', {}, 'Examen de práctica'),
          selModulo,
          h('fieldset', {}, h('legend', {}, '¿Qué entra?'), listaApuntes, pegado),
          h('div', { class: 'dos' }, selNum, selDif),
          estado.error ? h('p', { class: 'error', role: 'alert' }, estado.error) : null,
          estado.ocupado
            ? h('p', { class: 'trabajando', role: 'status' }, estado.ocupado)
            : h('button', { type: 'button', class: 'boton primario ancho', disabled: !!sinIA, onclick: () => crearExamen(apuntes) }, 'Crear examen con IA'),
          h('p', { class: 'ayuda' }, sinIA ?? (uso ? `Hoy llevas ${uso.usadas}${uso.limite ? ` de ${uso.limite}` : ''} usos de la IA.` : 'Crear un examen gasta 1 uso de la IA y corregirlo, otro.')),
          h('div', {}, h('button', { type: 'button', class: 'enlace', onclick: abrirImportar }, 'Importar un examen sin IA')),
        )
      : h('div', { class: 'vacio' }, h('span', { class: 'vacio-icono' }, icono('estudiar')), h('h2', {}, 'Primero crea un módulo'), h('p', {}, 'Los exámenes de práctica se guardan por módulo.')),

    modulo && intentos.length ? historial(modulo, intentos) : null,
  );
}

/** Historial del módulo: evolución de las notas, temas flojos e intentos. */
function historial(modulo, intentos) {
  const ultimos = intentos.slice(-8);
  const flojos = temasFlojos(intentos).slice(0, 6);
  return h(
    'section',
    { class: 'seccion', style: `--c:${modulo.color}` },
    h('h2', {}, `Historial de ${modulo.abreviatura}`),
    h(
      'div',
      { class: 'evolucion', role: 'img', 'aria-label': `Notas de los últimos ${ultimos.length} intentos: ${ultimos.map((i) => i.nota).join(', ')}` },
      ultimos.map((i) => h('div', { class: 'evolucion-barra' }, h('b', { class: 'num' }, String(i.nota)), h('span', { style: `height:${Math.max(4, i.nota * 10)}%` }))),
    ),
    flojos.length ? h('div', {}, h('p', { class: 'ayuda' }, 'Temas flojos (media por debajo de 5):'), h('div', { class: 'chips' }, flojos.map((t) => h('span', { class: 'pastilla pasada' }, `${t.tema} · ${t.media}`)))) : null,
    h(
      'div',
      { class: 'grupo' },
      [...intentos].reverse().map((i) =>
        h(
          'button',
          { type: 'button', class: 'publicacion', onclick: () => verIntento(i) },
          h('span', { class: 'cuerpo' }, h('span', { class: 'titulo' }, (i.temas ?? []).slice(0, 3).join(', ') || 'Examen de práctica'), h('span', { class: 'meta' }, `${fechaCorta(i.fecha)} · ${i.preguntas.length} preguntas`)),
          h('span', { class: `pastilla ${i.nota >= 5 ? 'aprobado' : 'suspendido'}` }, String(i.nota)),
        ),
      ),
    ),
  );
}

/** Reúne el temario (texto de los PDF + lo pegado) y pide las preguntas. */
async function crearExamen(apuntes) {
  const elegidos = apuntes.filter((a) => estado.elegidos.has(a.id));
  if (!elegidos.length && !estado.textoPegado.trim()) {
    estado.error = 'Marca al menos un apunte o pega el texto del temario.';
    return repintar();
  }
  estado.error = '';
  estado.ocupado = 'Leyendo tus apuntes…';
  repintar();
  try {
    let texto = estado.textoPegado.trim();
    const rutas = [];
    for (const a of elegidos) {
      const blob = await repoArchivos.contenido(a.id);
      let extraido = '';
      if (blob && a.tipo === 'application/pdf') extraido = await textoDePDF(blob).catch(() => '');
      if (extraido.length >= MINIMO_TEXTO_UTIL) {
        texto += `\n\n# ${a.nombre}\n${extraido}`;
      } else {
        // PDF escaneado, foto o apunte que no está en este dispositivo: lo lee la IA desde la nube
        if (!a.ruta) throw new Error(`«${a.nombre}» aún no se ha subido a la nube. Espera a que ponga «Sincronizado» e inténtalo otra vez.`);
        rutas.push(a.ruta);
      }
    }
    if (rutas.length > MAX_ARCHIVOS_IA) throw new Error(`Como mucho ${MAX_ARCHIVOS_IA} apuntes escaneados o fotos a la vez.`);
    estado.ocupado = 'La IA está preparando las preguntas…';
    repintar();
    const { preguntas, uso } = await ia.generar({ texto: texto.slice(0, MAX_TEXTO), rutas, num: estado.num, dificultad: estado.dificultad });
    estado.uso = uso;
    empezarExamen(preguntas);
  } catch (e) {
    estado.error = e.message;
    estado.ocupado = '';
    repintar();
  }
}

function empezarExamen(preguntas) {
  estado.examen = { preguntas, respuestas: preguntas.map(() => '') };
  estado.paso = 'examen';
  estado.ocupado = '';
  estado.error = '';
  repintar(true);
}

/** Plan B: pegar un examen en JSON generado en cualquier chat. */
function abrirImportar() {
  const area = h('textarea', { rows: 8, placeholder: 'Pega aquí el JSON', 'aria-label': 'Examen en JSON' });
  const error = h('p', { class: 'error', role: 'alert' });
  const copiar = h('button', { type: 'button', class: 'boton', onclick: async () => { await navigator.clipboard?.writeText(PROMPT_PARA_CHAT).catch(() => {}); copiar.textContent = 'Copiado'; } }, 'Copiar la petición');
  const form = h(
    'form',
    { class: 'formulario', onsubmit: importar },
    h('p', { class: 'suave' }, 'Si la IA no está disponible, pide el examen en cualquier chat (pásale tus apuntes) y pega aquí el resultado. Tiene que tener este formato:'),
    h('pre', { class: 'codigo' }, FORMATO_JSON),
    h('div', {}, copiar),
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
      empezarExamen(preguntas);
    } catch (err) {
      error.textContent = err.message;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Responder
// ---------------------------------------------------------------------------

function renderExamen(cont) {
  const { preguntas, respuestas } = estado.examen;
  const sinIA = ia.motivoSinIA();
  poner(
    cont,
    h(
      'header',
      { class: 'barra-superior' },
      h('button', { type: 'button', class: 'boton-icono atras', 'aria-label': 'Salir del examen', onclick: salirDelExamen }, icono('atras')),
      h('h1', { class: 'titulo-pantalla crece' }, `Examen · ${preguntas.length} preguntas`),
    ),
    h(
      'ol',
      { class: 'preguntas' },
      preguntas.map((p, i) =>
        h(
          'li',
          {},
          h('label', { class: 'campo' }, h('span', { class: 'enunciado' }, h('b', { class: 'num' }, `${i + 1}. `), p.pregunta), h('textarea', { rows: 3, maxlength: 1500, placeholder: 'Tu respuesta', oninput: (e) => (respuestas[i] = e.target.value) }, respuestas[i])),
        ),
      ),
    ),
    estado.error ? h('p', { class: 'error', role: 'alert' }, estado.error) : null,
    estado.ocupado
      ? h('p', { class: 'trabajando', role: 'status' }, estado.ocupado)
      : h(
          'div',
          { class: 'seccion' },
          h('button', { type: 'button', class: 'boton primario ancho', disabled: !!sinIA, onclick: corregirConIA }, 'Corregir con IA'),
          h('button', { type: 'button', class: 'boton ancho', onclick: corregirYoMismo }, 'Ver las respuestas y corregirme yo'),
          sinIA ? h('p', { class: 'ayuda' }, sinIA) : null,
        ),
  );
}

function salirDelExamen() {
  if (estado.examen.respuestas.some((r) => r.trim()) && !confirm('¿Salir del examen? Se perderán tus respuestas.')) return;
  estado.examen = null;
  estado.paso = 'inicio';
  estado.error = '';
  repintar(true);
}

async function corregirConIA() {
  const { preguntas, respuestas } = estado.examen;
  estado.error = '';
  estado.ocupado = 'La IA está corrigiendo…';
  repintar();
  try {
    const { correcciones, uso } = await ia.corregir(preguntas.map((p, i) => ({ pregunta: p.pregunta, respuesta_modelo: p.respuesta_modelo, respuesta_usuario: respuestas[i] })));
    estado.uso = uso;
    const corregidas = respuestas.map((r, i) => ({ respuesta: r, nota: correcciones[i].nota, comentario: correcciones[i].comentario }));
    await guardarIntento(preguntas, corregidas);
  } catch (e) {
    estado.error = `${e.message} Puedes corregirte tú con el botón de abajo.`;
    estado.ocupado = '';
    repintar();
  }
}

/** Sin IA: se enseñan las respuestas modelo y el alumno se puntúa. */
function corregirYoMismo() {
  const { preguntas, respuestas } = estado.examen;
  estado.resultado = { preguntas, respuestas: respuestas.map((r) => ({ respuesta: r, nota: null, comentario: '' })), nota: null, auto: true };
  estado.paso = 'resultado';
  estado.error = '';
  repintar(true);
}

async function guardarIntento(preguntas, respuestas) {
  const nota = notaMedia(respuestas.map((r) => r.nota));
  const fila = await repoExamenes.guardar({
    modulo_id: estado.moduloId,
    temas: [...new Set(preguntas.map((p) => p.tema))],
    preguntas,
    respuestas,
    nota,
    fecha: new Date().toISOString(),
  });
  estado.examen = null;
  estado.ocupado = '';
  estado.resultado = { preguntas, respuestas, nota, id: fila.id };
  estado.paso = 'resultado';
  repintar(true);
}

// ---------------------------------------------------------------------------
// 3. Resultado
// ---------------------------------------------------------------------------

function verIntento(intento) {
  estado.resultado = { preguntas: intento.preguntas, respuestas: intento.respuestas, nota: intento.nota, id: intento.id };
  estado.paso = 'resultado';
  repintar(true);
}

function renderResultado(cont) {
  const r = estado.resultado;
  const volver = () => {
    estado.resultado = null;
    estado.paso = estado.examen ? 'examen' : 'inicio';
    repintar(true);
  };
  const clase = (nota) => (nota == null ? '' : nota >= 5 ? 'aprobado' : 'suspendido');

  poner(
    cont,
    h(
      'header',
      { class: 'barra-superior' },
      h('button', { type: 'button', class: 'boton-icono atras', 'aria-label': 'Volver', onclick: volver }, icono('atras')),
      h('h1', { class: 'titulo-pantalla crece' }, r.auto ? 'Corrígete' : 'Resultado'),
      r.id ? h('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Borrar este intento', title: 'Borrar este intento', onclick: borrarIntento }, icono('papelera')) : null,
    ),
    r.auto
      ? h('p', { class: 'suave' }, 'Compara cada respuesta con la respuesta modelo y ponte nota.')
      : h('div', { class: 'nota-final' }, h('b', { class: `num ${clase(r.nota)}` }, String(r.nota)), h('span', {}, `de 10 · ${r.preguntas.length} preguntas`)),
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
          resp.comentario ? h('p', { class: 'comentario' }, resp.comentario) : null,
          auto,
        );
      }),
    ),
    estado.error ? h('p', { class: 'error', role: 'alert' }, estado.error) : null,
    r.auto ? h('button', { type: 'button', class: 'boton primario ancho', onclick: guardarAuto }, 'Guardar mi nota') : h('button', { type: 'button', class: 'boton ancho', onclick: () => { estado.resultado = null; estado.paso = 'inicio'; repintar(true); } }, 'Hacer otro examen'),
  );

  async function guardarAuto() {
    if (r.respuestas.some((x) => x.nota == null)) {
      estado.error = 'Ponte nota en todas las preguntas.';
      return repintar();
    }
    estado.error = '';
    await guardarIntento(r.preguntas, r.respuestas);
  }

  async function borrarIntento() {
    if (!confirm('¿Borrar este intento del historial?')) return;
    await repoExamenes.borrar(r.id);
    estado.resultado = null;
    estado.paso = 'inicio';
    repintar(true);
  }
}
