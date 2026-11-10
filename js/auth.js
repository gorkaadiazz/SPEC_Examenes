// Inicio de sesión con Google (Supabase Auth) y cierre de sesión.

import { cliente } from './supabase.js';
import { borrarTodo } from './sync/db.js';
import { GOOGLE_CLIENT_ID } from './config.js';

const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client';

/**
 * Usuario con sesión iniciada, o null. La sesión se guarda en el navegador
 * (localStorage) y se renueva sola, así que sobrevive a recargar y a cerrar la app.
 */
export async function usuarioActual() {
  const { data, error } = await cliente.auth.getSession();
  if (error) console.warn('Sesión no válida', error);
  return data?.session?.user ?? null;
}

/**
 * Al volver de Google por el plan B, Supabase deja en la URL ?code=… (o
 * ?error=… si algo ha fallado). Hay que llamar a esto DESPUÉS de
 * usuarioActual(), cuando supabase-js ya ha recogido la sesión: aquí se lee
 * el posible error y se limpia la URL. Devuelve el mensaje de error o null.
 */
export function recogerVueltaDeLogin() {
  const params = new URLSearchParams(location.search);
  const enHash = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
  const descripcion = params.get('error_description') ?? enHash.get('error_description');
  const hayError = params.has('error') || enHash.has('error');
  if (params.has('code') || hayError) history.replaceState(null, '', location.pathname + (hayError ? '' : location.hash));
  if (!hayError) return null;
  // El texto de la URL lo puede escribir cualquiera en un enlace: solo se usa
  // para reconocer el caso del email no autorizado, nunca se muestra tal cual.
  if (/database error saving new user|no tiene acceso/i.test(descripcion ?? '')) return mensajeDeError({ message: descripcion });
  return 'No se ha podido iniciar sesión. Inténtalo de nuevo.';
}

/** Traduce los errores de Supabase Auth a un mensaje claro. */
export function mensajeDeError(error) {
  const texto = `${error?.message ?? ''} ${error?.code ?? ''}`;
  // El trigger de emails_permitidos hace que Supabase devuelva este error genérico
  if (/database error saving new user|no tiene acceso/i.test(texto)) return 'Este email no tiene acceso a la app. Entra con la cuenta autorizada.';
  return `No se ha podido iniciar sesión: ${error?.message ?? 'error desconocido'}`;
}

// ---------------------------------------------------------------------------
// Botón oficial de Google (Google Identity Services)
//
// El login ocurre en esta misma página: Google entrega un "ID token" firmado y
// Supabase lo comprueba con signInWithIdToken. Como no hay redirección a
// <proyecto>.supabase.co, Google no enseña ese dominio.
// El script de Google se carga solo en la pantalla de login (necesita
// conexión, igual que iniciar sesión).
// ---------------------------------------------------------------------------

function cargarScriptGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((ok, ko) => {
    const s = document.createElement('script');
    s.src = SCRIPT_GOOGLE;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => ko(new Error('No se ha podido cargar el botón de Google'));
    setTimeout(() => ko(new Error('El botón de Google tarda demasiado')), 8000);
    document.head.append(s);
  });
}

/** SHA-256 en hexadecimal (Google recibe el nonce cifrado y Supabase el original). */
async function sha256(texto) {
  const datos = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(datos)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Pinta el botón de Google dentro de `contenedor`.
 * @returns {Promise<boolean>} false si no se puede usar (falta el Client ID,
 *   sin conexión o el script no carga): entonces se usa entrarConGoogle().
 */
export async function botonGoogle(contenedor, { alEntrar, alError }) {
  if (!GOOGLE_CLIENT_ID || !navigator.onLine || !crypto.subtle) {
    console.warn('Botón de Google desactivado:', !GOOGLE_CLIENT_ID ? 'falta GOOGLE_CLIENT_ID' : !navigator.onLine ? 'sin conexión' : 'el navegador no permite crypto.subtle (¿sin HTTPS?)');
    return false;
  }
  try {
    await cargarScriptGoogle();
  } catch (e) {
    console.warn('Botón de Google desactivado:', e.message, '(¿bloqueador de anuncios o de rastreadores?)');
    return false;
  }
  // Número de un solo uso que liga el token de Google a este intento de login
  const nonce = crypto.getRandomValues(new Uint8Array(16)).reduce((t, b) => t + b.toString(16).padStart(2, '0'), '');
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: await sha256(nonce),
    context: 'signin',
    ux_mode: 'popup',
    use_fedcm_for_prompt: true,
    use_fedcm_for_button: true,
    itp_support: true,
    callback: async ({ credential }) => {
      const { error } = await cliente.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
      if (error) alError(mensajeDeError(error));
      else alEntrar();
    },
  });
  const oscuro = getComputedStyle(document.documentElement).colorScheme === 'dark';
  window.google.accounts.id.renderButton(contenedor, {
    type: 'standard',
    theme: oscuro ? 'filled_black' : 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    logo_alignment: 'center',
    locale: 'es',
    width: Math.min(340, contenedor.clientWidth || 340),
  });
  // En Android sale además la ventanita de "Continuar como…" (One Tap)
  window.google.accounts.id.prompt();
  return true;
}

/** Plan B: va a la pantalla de Google pasando por Supabase y vuelve aquí. */
export async function entrarConGoogle() {
  const { error } = await cliente.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
}

/** Cierra la sesión y borra la copia local de este dispositivo (sección 5.5). */
export async function cerrarSesion() {
  await cliente.auth.signOut({ scope: 'local' }).catch(() => {});
  await borrarTodo();
  location.replace(location.pathname);
}

/** Pide confirmación (avisando si hay cambios sin subir) y cierra la sesión. */
export async function confirmarCierreDeSesion() {
  const { pendientes } = await import('./sync/cola.js');
  const n = await pendientes();
  const aviso = n ? `Hay ${n} ${n === 1 ? 'cambio que aún no se ha subido y se perderá' : 'cambios que aún no se han subido y se perderán'}. ` : '';
  if (!confirm(`${aviso}¿Cerrar sesión?`)) return;
  await cerrarSesion();
}

/** Avisa cuando la sesión se cierra (p. ej. desde otra pestaña o al caducar). */
export function alCerrarSesion(fn) {
  cliente.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') fn();
  });
}
