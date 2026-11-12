// Ajustes: apariencia, faltas, avisos, copia de seguridad, instalación y cuenta.

import { h, poner, campo, opciones, abrirHoja } from '../utils/dom.js';
import { VERSION_APP } from '../config.js';
import { confirmarCierreDeSesion, borrarCuenta, limpiarDispositivo } from '../auth.js';
import { sincronizar } from '../sync/sincronizar.js';
import * as repoPerfil from '../repos/perfil.js';
import * as avisos from '../utils/avisos.js';
import { exportar, importar } from '../utils/backup.js';
import { descargar } from './calendario.js';
import { hoy } from '../tools/repaso.js';
import { icono } from './iconos.js';

export async function render(cont) {
  const usuario = window.usuario; // lo pone app.js tras iniciar sesión
  const aviso = window.avisoInstalacion; // lo guarda app.js si Chrome ofrece instalar
  const instalada = window.matchMedia('(display-mode: standalone)').matches;
  const perfil = await repoPerfil.obtener();
  const prefs = perfil.preferencias;

  const tema = opciones('Tema', 'tema', [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['auto', 'Automático']], window.Tema.leer(), 'segmentos');
  tema.addEventListener('change', (e) => window.Tema.guardar(e.target.value));

  // Campo numérico que guarda al cambiar
  const numero = (valor, min, max, guardar) => h('input', { type: 'number', min, max, step: 1, inputmode: 'numeric', value: valor, onchange: (e) => guardar(Math.min(max, Math.max(min, Math.round(Number(e.target.value)) || valor))) });
  const interruptor = (texto, marcado, alCambiar) => h('label', { class: 'renglon elegir suelto' }, h('input', { type: 'checkbox', class: 'casilla', checked: marcado, onchange: (e) => alCambiar(e.target.checked, e.target) }), h('span', {}, texto));

  const permiso = avisos.disponibles() ? Notification.permission : 'no';
  const errorCopia = h('p', { class: 'error', role: 'alert' });
  const selectorCopia = h('input', { type: 'file', accept: 'application/json,.json', class: 'oculto', tabindex: -1, 'aria-hidden': 'true', onchange: restaurar });

  poner(
    cont,
    h('header', { class: 'barra-superior' }, h('h1', { class: 'titulo-pantalla' }, 'Ajustes')),

    h('section', { class: 'seccion' }, h('h2', {}, 'Apariencia'), tema, h('p', { class: 'ayuda' }, 'Automático sigue al modo claro u oscuro del móvil.')),

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Faltas'),
      h('div', { class: 'dos' }, campo('Límite de faltas (%)', numero(perfil.limite_faltas, 1, 100, (v) => repoPerfil.guardar({ limite_faltas: v }))), campo('Semanas de clase', numero(prefs.semanas_curso, 1, 52, (v) => repoPerfil.guardar({}, { semanas_curso: v })))),
      interruptor('Las faltas justificadas también cuentan', prefs.contar_justificadas, (v) => repoPerfil.guardar({}, { contar_justificadas: v })),
      h('p', { class: 'ayuda' }, 'Las horas de cada módulo son sus horas semanales por las semanas de clase. Pregunta a tu tutor cuántas semanas cuentan y si las justificadas suman.'),
    ),

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Avisos'),
      permiso === 'no'
        ? h('p', { class: 'suave' }, 'Este navegador no admite notificaciones.')
        : [
            interruptor('Avisarme antes de cada evaluación', prefs.avisos && permiso === 'granted', async (v, casilla) => {
              if (v && !(await avisos.pedirPermiso())) {
                casilla.checked = false;
                return alert('El navegador ha bloqueado las notificaciones. Actívalas en los ajustes del sitio.');
              }
              await repoPerfil.guardar({}, { avisos: v });
              if (v) avisos.avisar('Avisos activados', 'Te avisaremos al abrir la app.');
            }),
            campo('Días de antelación', numero(prefs.dias_aviso, 1, 14, (v) => repoPerfil.guardar({}, { dias_aviso: v }))),
          ],
      h('p', { class: 'ayuda' }, 'Los avisos saltan al abrir la app. Para que te avise aunque esté cerrada, exporta el calendario (.ics) a Google Calendar desde la pantalla Calendario.'),
    ),

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Copia de seguridad'),
      h('div', { class: 'fila' }, h('button', { type: 'button', class: 'boton', onclick: () => copiar(false) }, 'Exportar datos'), h('button', { type: 'button', class: 'boton', onclick: () => copiar(true) }, 'Exportar con apuntes'), h('button', { type: 'button', class: 'boton', onclick: () => selectorCopia.click() }, 'Importar'), selectorCopia),
      errorCopia,
      h('p', { class: 'ayuda' }, '«Exportar datos» guarda todo en un archivo JSON, con los apuntes solo como enlace. «Con apuntes» mete también los PDF y fotos que estén en este dispositivo (pesa más). Importar añade lo de la copia sin borrar lo que ya tienes.'),
    ),

    h(
      'section',
      { class: 'seccion' },
      h('h2', {}, 'Instalar la app'),
      instalada
        ? h('p', { class: 'suave' }, 'Ya está instalada en este dispositivo.')
        : aviso
          ? h('div', {}, h('button', { type: 'button', class: 'boton primario', onclick: instalar }, icono('instalar'), 'Instalar app'))
          : h('p', { class: 'suave' }, 'En Chrome: menú ⋮ → «Instalar app» o «Añadir a pantalla de inicio».'),
    ),

    usuario
      ? h(
          'section',
          { class: 'seccion' },
          h('h2', {}, 'Tu cuenta'),
          h('p', { class: 'suave' }, 'Has entrado como ', h('b', {}, usuario.email), '. Tus datos se sincronizan entre el móvil y el PC.'),
          h('p', {}, h('span', { class: 'estado-datos', 'data-estado-sync': '' })),
          h('div', { class: 'fila' }, h('button', { type: 'button', class: 'boton', onclick: () => sincronizar() }, icono('sincronizar'), 'Sincronizar ahora'), h('button', { type: 'button', class: 'boton peligro', onclick: confirmarCierreDeSesion }, icono('salir'), 'Cerrar sesión')),
        )
      : null,

    h(
      'section',
      { class: 'seccion zona-peligrosa' },
      h('h2', {}, 'Zona peligrosa'),
      usuario
        ? [h('p', { class: 'suave' }, 'Borrar la cuenta elimina tu usuario, todos tus datos y todos tus apuntes, aquí y en la nube. No se puede deshacer.'), h('div', {}, h('button', { type: 'button', class: 'boton peligro', onclick: abrirBorrarCuenta }, icono('papelera'), 'Borrar mi cuenta'))]
        : [h('p', { class: 'suave' }, 'Sin cuenta, tus datos están solo en este dispositivo.'), h('div', {}, h('button', { type: 'button', class: 'boton peligro', onclick: vaciar }, icono('papelera'), 'Borrar los datos de este dispositivo'))],
    ),

    h('p', { class: 'ayuda num' }, `Versión ${VERSION_APP}`),
  );

  async function copiar(conArchivos) {
    errorCopia.textContent = '';
    try {
      descargar(`examenes-2smr-${hoy()}.json`, JSON.stringify(await exportar({ conArchivos })), 'application/json');
    } catch (e) {
      errorCopia.textContent = `No se ha podido exportar: ${e.message}`;
    }
  }

  async function restaurar() {
    const archivo = selectorCopia.files[0];
    selectorCopia.value = '';
    if (!archivo) return;
    errorCopia.textContent = '';
    try {
      if (archivo.size > 200 * 1024 * 1024) throw new Error('El archivo es demasiado grande.');
      let copia;
      try {
        copia = JSON.parse(await archivo.text());
      } catch {
        throw new Error('El archivo no es un JSON válido.');
      }
      const { filas, archivos } = await importar(copia);
      alert(`Copia importada: ${filas} datos${archivos ? ` y ${archivos} apuntes` : ''}.`);
    } catch (e) {
      errorCopia.textContent = e.message;
    }
  }

  async function instalar() {
    aviso.prompt();
    await aviso.userChoice;
    window.avisoInstalacion = null;
    location.reload();
  }

  async function vaciar() {
    if (!confirm('Se borrarán todos los datos de este dispositivo. ¿Seguir?')) return;
    await limpiarDispositivo();
    location.replace(location.pathname);
  }

  /** Borrar cuenta: se ofrece exportar y hay que escribir BORRAR (sección 6.6). */
  function abrirBorrarCuenta() {
    const error = h('p', { class: 'error', role: 'alert' });
    const boton = h('button', { type: 'submit', class: 'boton peligro', disabled: true }, 'Borrar mi cuenta para siempre');
    const form = h(
      'form',
      { class: 'formulario', onsubmit: borrar },
      h('p', {}, 'Se borrarán tu usuario, todos tus módulos, evaluaciones, notas y apuntes, en este dispositivo y en la nube. ', h('b', {}, 'No se puede deshacer.')),
      h('div', {}, h('button', { type: 'button', class: 'boton', onclick: () => copiar(true) }, 'Antes, exportar mis datos')),
      campo('Escribe BORRAR para confirmar', h('input', { name: 'confirmar', type: 'text', autocomplete: 'off', autocapitalize: 'characters', oninput: (e) => (boton.disabled = e.target.value.trim() !== 'BORRAR') })),
      error,
      h('div', { class: 'hoja-pie' }, boton),
    );
    abrirHoja('Borrar mi cuenta', form);
    async function borrar(e) {
      e.preventDefault();
      if (form.confirmar.value.trim() !== 'BORRAR') return;
      boton.disabled = true;
      boton.textContent = 'Borrando…';
      try {
        await borrarCuenta(); // si va bien, limpia el dispositivo y vuelve al login
      } catch (err) {
        error.textContent = err.message;
        boton.disabled = false;
        boton.textContent = 'Borrar mi cuenta para siempre';
      }
    }
  }
}
