// Pantalla "Tú": tu perfil, tus módulos en rejilla y accesos al resto.
// Incluye el formulario de módulo (datos + sus RA con su peso).

import { h, poner, campo, opciones, abrirHoja } from '../utils/dom.js';
import * as repo from '../repos/modulos.js';
import * as repoEvaluaciones from '../repos/evaluaciones.js';
import { SISTEMAS_NOTAS, PALETA } from '../repos/modulos.js';
import { avatar } from './evaluaciones.js';
import { icono } from './iconos.js';
import { confirmarCierreDeSesion } from '../auth.js';
import { ilustracion, ILUSTRACIONES } from './ilustraciones.js';
import { seccionApuntes } from './apuntes.js';
import * as repoArchivos from '../repos/archivos.js';
import { miniatura, esMiniaturaValida } from '../utils/imagen.js';

/** Foto de Google del usuario (si la hay) o su inicial. */
function fotoDePerfil(usuario, clase = '') {
  const datos = usuario?.user_metadata ?? {};
  const url = datos.avatar_url ?? datos.picture;
  const nombre = datos.full_name ?? datos.name ?? '';
  if (url && /^https:\/\//.test(url)) return h('span', { class: `avatar foto-perfil ${clase}` }, h('img', { src: url, alt: '', referrerpolicy: 'no-referrer' }));
  // Iniciales del nombre y del primer apellido ("Ana Pérez" -> "AP")
  const palabras = nombre.trim().split(/\s+/).filter((p) => !/^(de|del|la|las|los|y)$/i.test(p));
  const iniciales = palabras.slice(0, 2).map((p) => p[0]).join('') || '2º';
  return h('span', { class: `avatar foto-perfil ${clase}`, 'aria-hidden': 'true' }, iniciales);
}
export { fotoDePerfil };

export async function render(cont) {
  const [modulos, evaluaciones] = await Promise.all([repo.listar(), repoEvaluaciones.listar()]);
  const pendientes = evaluaciones.filter((e) => e.estado === 'pendiente');
  const nApuntes = await repoArchivos.contarPorModulo();
  const totalApuntes = [...nApuntes.values()].reduce((a, b) => a + b, 0);
  const usuario = window.usuario;
  const nombre = usuario?.user_metadata?.full_name ?? usuario?.user_metadata?.name ?? '2º SMR';
  const cifra = (n, texto) => h('li', {}, h('b', { class: 'num' }, String(n)), texto);

  poner(
    cont,
    h('header', { class: 'barra-superior' }, h('h1', { class: 'titulo-pantalla' }, 'Tu perfil'), h('a', { class: 'boton-icono', href: '#/ajustes', 'aria-label': 'Ajustes', title: 'Ajustes' }, icono('ajustes'))),
    h(
      'section',
      { class: 'perfil' },
      h(
        'div',
        { class: 'perfil-fila' },
        fotoDePerfil(usuario, 'grande'),
        h('ul', { class: 'cifras' }, cifra(modulos.length, 'módulos'), cifra(pendientes.length, 'pendientes'), cifra(totalApuntes, totalApuntes === 1 ? 'apunte' : 'apuntes')),
      ),
      h('div', { class: 'perfil-bio' }, h('b', {}, nombre), h('span', {}, '2º SMR · IES Ribera del Tajo')),
      h('div', { class: 'perfil-botones' }, h('button', { type: 'button', class: 'boton', onclick: () => abrirFormulario() }, 'Nuevo módulo'), h('a', { class: 'boton', href: '#/evaluaciones' }, 'Evaluaciones')),
    ),
    h(
      'section',
      { class: 'seccion-rejilla', 'aria-label': 'Mis módulos' },
      h('div', { class: 'pestanas-perfil', role: 'presentation' }, h('span', { class: 'activa' }, icono('todos'), 'Módulos')),
      h(
        'div',
        { class: 'rejilla' },
        modulos.map((m) => {
          const n = pendientes.filter((e) => e.modulo_id === m.id).length;
          return h(
            'button',
            { type: 'button', class: 'tesela', style: `--c:${m.color}`, onclick: () => abrirFormulario(m), 'aria-label': `${m.nombre}${n ? `, ${n} pendientes` : ''}` },
            esMiniaturaValida(m.foto) ? h('img', { class: 'tesela-foto', src: m.foto, alt: '' }) : h('span', { class: 'tesela-ilu', 'aria-hidden': 'true' }, ilustracion(m.imagen)),
            h('span', { class: 'tesela-nombre' }, m.abreviatura),
            n ? h('span', { class: 'tesela-contador' }, String(n)) : null,
          );
        }),
      ),
    ),
    usuario
      ? h(
          'div',
          { class: 'menu' },
          h('button', { type: 'button', class: 'salir', onclick: confirmarCierreDeSesion }, icono('salir'), h('span', {}, 'Cerrar sesión', h('small', {}, usuario.email))),
        )
      : null,
  );
}

/** Fila editable de un RA: código · descripción · peso. */
function filaRA(ra = {}) {
  const fila = h(
    'div',
    { class: 'renglon', 'data-id': ra.id ?? null },
    h('input', { type: 'text', class: 'corto', value: ra.codigo ?? '', placeholder: 'RA1', 'aria-label': 'Código del RA', maxlength: 8 }),
    h('input', { type: 'text', value: ra.descripcion ?? '', placeholder: 'Qué evalúa', 'aria-label': 'Descripción del RA', maxlength: 300 }),
    h('input', { type: 'number', class: 'corto', value: ra.peso ?? '', placeholder: '%', 'aria-label': 'Peso del RA en %', min: 0, max: 100, step: 0.01, inputmode: 'decimal' }),
    h('button', { type: 'button', class: 'boton redondo', 'aria-label': 'Quitar RA', onclick: () => { fila.remove(); actualizar?.(); } }, icono('cerrar')),
  );
  let actualizar = null;
  fila.alQuitar = (fn) => (actualizar = fn);
  return fila;
}

async function abrirFormulario(modulo = null) {
  const [ras, archivos] = modulo ? await Promise.all([repo.listarRA(modulo.id), repoArchivos.deModulo(modulo.id)]) : [[], []];
  const v = { color: PALETA[0][0], sistema_notas: 'ra', imagen: 'libro', ...(modulo ?? {}) };
  let foto = esMiniaturaValida(v.foto) ? v.foto : null;
  const apuntes = seccionApuntes(archivos, 'Temario y apuntes del módulo (PDF o fotos, hasta 20 MB). También aparecen aquí los que subas en sus evaluaciones.');

  // Selector de imagen: ilustraciones + "tu foto"
  const opcionFoto = h('label', { class: 'chip imagen' }, h('input', { type: 'radio', name: 'imagen', value: '__foto', checked: !!foto, 'aria-label': 'Tu foto', onchange: () => !foto && selectorFoto.click() }), h('span', { class: 'avatar', style: `--c:${v.color}` }, foto ? h('img', { src: foto, alt: '' }) : icono('foto')));
  const selectorFoto = h('input', { type: 'file', accept: 'image/*', class: 'oculto', tabindex: -1, 'aria-hidden': 'true', onchange: elegirFoto });
  async function elegirFoto() {
    const f = selectorFoto.files[0];
    selectorFoto.value = '';
    if (!f) return;
    try {
      foto = await miniatura(f);
      opcionFoto.querySelector('.avatar').replaceChildren(h('img', { src: foto, alt: '' }));
      opcionFoto.querySelector('input').checked = true;
    } catch (err) {
      mostrarError(err.message);
    }
  }
  const imagenes = h(
    'fieldset',
    {},
    h('legend', {}, 'Imagen'),
    h(
      'div',
      { class: 'chips imagenes' },
      ILUSTRACIONES.map(([clave, nombre]) => h('label', { class: 'chip imagen', title: nombre }, h('input', { type: 'radio', name: 'imagen', value: clave, checked: !foto && clave === v.imagen, 'aria-label': nombre }), h('span', { class: 'avatar', style: `--c:${v.color}` }, ilustracion(clave)))),
      opcionFoto,
    ),
    h('div', {}, h('button', { type: 'button', class: 'boton', onclick: () => selectorFoto.click() }, icono('foto'), foto ? 'Cambiar tu foto' : 'Usar una foto tuya'), selectorFoto),
  );
  // Al cambiar de color, las vistas previas de imagen se recolorean
  function recolorear(color) {
    for (const a of imagenes.querySelectorAll('.avatar')) a.style.setProperty('--c', color);
  }
  const enPaleta = PALETA.some(([c]) => c === v.color);

  const suma = h('span', { class: 'ayuda num' });
  const listaRA = h('div', { class: 'lista-edit' });
  const error = h('p', { class: 'error', role: 'alert' });

  function leerRA() {
    return [...listaRA.children]
      .map((fila) => {
        const [codigo, descripcion, peso] = fila.querySelectorAll('input');
        return {
          ...(ras.find((r) => r.id === fila.dataset.id) ?? {}),
          codigo: codigo.value.trim().toUpperCase(),
          descripcion: descripcion.value.trim(),
          peso: Number(peso.value) || 0,
        };
      })
      .filter((r) => r.codigo);
  }
  function actualizarSuma() {
    const total = Math.round(leerRA().reduce((s, r) => s + r.peso, 0) * 100) / 100;
    suma.textContent = listaRA.children.length ? `Los pesos suman ${total} %${total === 100 ? ' ✓' : ' (deberían sumar 100 %)'}` : 'Añade los RA de la programación del módulo.';
  }
  function meterFila(fila) {
    fila.alQuitar(actualizarSuma);
    listaRA.append(fila);
  }
  ras.forEach((r) => meterFila(filaRA(r)));

  const colorLibre = h('input', { type: 'color', name: 'color_libre', value: v.color, 'aria-label': 'Otro color', oninput: () => { for (const r of form.querySelectorAll('input[name="color"]')) r.checked = false; recolorear(colorLibre.value); } });

  const form = h(
    'form',
    { class: 'formulario', onsubmit: guardar, novalidate: true },
    h('input', { name: 'nombre', type: 'text', class: 'grande', value: v.nombre ?? '', maxlength: 120, placeholder: 'Nombre del módulo', 'aria-label': 'Nombre del módulo' }),
    h(
      'div',
      { class: 'dos' },
      campo('Abreviatura', h('input', { name: 'abreviatura', type: 'text', value: v.abreviatura ?? '', maxlength: 5, placeholder: 'SOR' })),
      campo('Horas a la semana', h('input', { name: 'horas_semanales', type: 'number', min: 0, max: 40, step: 0.5, inputmode: 'decimal', value: v.horas_semanales ?? '', placeholder: 'Ej.: 6' })),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Color'),
      h(
        'div',
        { class: 'chips colores' },
        PALETA.map(([c, nombre]) => h('label', { class: 'chip', style: `--c:${c}` }, h('input', { type: 'radio', name: 'color', value: c, checked: c === v.color, 'aria-label': nombre, onchange: () => { colorLibre.value = c; recolorear(c); } }), h('span', {}))),
        h('label', { class: 'chip', title: 'Otro color' }, colorLibre),
      ),
      enPaleta ? null : h('p', { class: 'ayuda' }, 'Este módulo usa un color propio (el círculo de la derecha).'),
    ),
    imagenes,
    campo('Profesor/a', h('input', { name: 'profesor', type: 'text', value: v.profesor ?? '', maxlength: 80 })),
    opciones('Cómo se calcula la nota', 'sistema_notas', SISTEMAS_NOTAS, v.sistema_notas, 'segmentos'),
    h(
      'fieldset',
      { oninput: actualizarSuma },
      h('legend', {}, 'Resultados de Aprendizaje (RA)'),
      listaRA,
      h('div', { class: 'fila separa' }, h('button', { type: 'button', class: 'boton', onclick: anadirRA }, icono('mas'), 'Añadir RA'), suma),
    ),
    apuntes.el,
    error,
    h(
      'div',
      { class: 'hoja-pie' },
      modulo ? h('button', { type: 'button', class: 'boton peligro redondo', 'aria-label': 'Borrar módulo', onclick: borrar }, icono('papelera')) : null,
      h('button', { type: 'submit', class: 'boton primario' }, modulo ? 'Guardar cambios' : 'Crear módulo'),
    ),
  );
  const hoja = abrirHoja(modulo ? modulo.abreviatura || 'Módulo' : 'Nuevo módulo', form);
  actualizarSuma();

  function anadirRA() {
    const fila = filaRA({ codigo: `RA${listaRA.children.length + 1}` });
    meterFila(fila);
    fila.querySelectorAll('input')[1].focus();
    actualizarSuma();
  }

  async function guardar(e) {
    e.preventDefault();
    const d = new FormData(form);
    const nombre = d.get('nombre').trim();
    const abreviatura = d.get('abreviatura').trim().toUpperCase();
    if (!nombre) return mostrarError('Ponle nombre al módulo.', form.nombre);
    if (!abreviatura) return mostrarError('Ponle una abreviatura (máx. 5 letras).', form.abreviatura);
    const horas = d.get('horas_semanales');
    const imagen = d.get('imagen');
    try {
      const guardado = await repo.guardar(
        {
          ...(modulo ?? {}),
          nombre,
          abreviatura,
          color: d.get('color') ?? d.get('color_libre'),
          profesor: d.get('profesor').trim(),
          horas_semanales: horas === '' ? null : Number(horas),
          sistema_notas: d.get('sistema_notas'),
          imagen: imagen && imagen !== '__foto' ? imagen : (v.imagen ?? 'libro'),
          foto: imagen === '__foto' ? foto : null,
        },
        leerRA(),
      );
      await apuntes.aplicar({ modulo_id: guardado.id });
      hoja.close();
    } catch (err) {
      console.error(err);
      mostrarError(`No se ha podido guardar: ${err.message}`);
    }
  }

  function mostrarError(texto, campoConError) {
    error.textContent = texto;
    campoConError?.focus();
  }

  async function borrar() {
    if (!confirm(`¿Borrar el módulo «${modulo.nombre}» con todas sus evaluaciones y RA? No se puede deshacer.`)) return;
    await repo.borrar(modulo.id);
    hoja.close();
  }
}
