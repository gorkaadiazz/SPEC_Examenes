// Recordatorios con notificaciones del navegador (sección 5.4).
// Solo son fiables con la app abierta: para avisos garantizados está la
// exportación .ics del calendario.

const CLAVE = 'avisos-enviados';

/** ¿El navegador permite notificaciones? */
export const disponibles = () => 'Notification' in window;

/** Pide permiso (hay que llamarlo desde un clic del usuario). */
export async function pedirPermiso() {
  if (!disponibles()) return false;
  return (Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()) === 'granted';
}

/** Muestra una notificación (en Android tiene que pasar por el service worker). */
export async function avisar(titulo, cuerpo, etiqueta = 'aviso') {
  if (!disponibles() || Notification.permission !== 'granted') return;
  const opciones = { body: cuerpo, tag: etiqueta, icon: './icons/icono-192.png', badge: './icons/icono-192.png' };
  try {
    const registro = await navigator.serviceWorker?.getRegistration();
    if (registro) await registro.showNotification(titulo, opciones);
    else new Notification(titulo, opciones);
  } catch (e) {
    console.warn('No se ha podido mostrar el aviso', e);
  }
}

/**
 * Al abrir la app: avisa de las evaluaciones pendientes que caen dentro de
 * los próximos `dias` días. Cada una, como mucho una vez al día.
 * @param {Array<{id,titulo,fecha,estado}>} evaluaciones
 * @param {(e:object)=>string} describir  texto de la notificación
 */
export function avisarProximas(evaluaciones, dias, describir, ahora = new Date()) {
  if (!disponibles() || Notification.permission !== 'granted') return 0;
  const hoy = ahora.toDateString();
  let enviados = {};
  try {
    enviados = JSON.parse(localStorage.getItem(CLAVE) ?? '{}');
  } catch { /* se empieza de cero */ }
  if (enviados.dia !== hoy) enviados = { dia: hoy, ids: [] };
  const limite = ahora.getTime() + dias * 86_400_000;
  const tocan = evaluaciones.filter((e) => e.estado === 'pendiente' && new Date(e.fecha) >= ahora && new Date(e.fecha).getTime() <= limite && !enviados.ids.includes(e.id));
  for (const e of tocan) {
    avisar(e.titulo, describir(e), `evaluacion-${e.id}`);
    enviados.ids.push(e.id);
  }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(enviados));
  } catch { /* sin almacenamiento: puede repetirse el aviso */ }
  return tocan.length;
}
