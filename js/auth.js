// Inicio de sesión con Google (Supabase Auth) y cierre de sesión.

import { cliente } from './supabase.js';
import { borrarTodo } from './sync/db.js';

/** Usuario con sesión iniciada, o null. */
export async function usuarioActual() {
  const { data, error } = await cliente.auth.getSession();
  if (error) console.warn('Sesión no válida', error);
  return data?.session?.user ?? null;
}

/**
 * Al volver de Google, Supabase deja en la URL ?code=… (o ?error=… si algo
 * ha fallado). La sesión ya la ha recogido supabase-js; aquí se lee el
 * posible error y se limpia la URL. Devuelve el mensaje de error o null.
 */
export function recogerVueltaDeLogin() {
  const params = new URLSearchParams(location.search);
  const enHash = new URLSearchParams(location.hash.replace(/^#\/?/, ''));
  const descripcion = params.get('error_description') ?? enHash.get('error_description');
  const hayError = params.has('error') || enHash.has('error');
  if (params.has('code') || hayError) history.replaceState(null, '', location.pathname + (hayError ? '' : location.hash));
  if (!hayError) return null;
  // El trigger de emails_permitidos hace que Supabase devuelva este error genérico
  if (/database error saving new user|no tiene acceso/i.test(descripcion ?? '')) return 'Este email no tiene acceso a la app. Entra con la cuenta autorizada.';
  return `No se ha podido iniciar sesión${descripcion ? `: ${descripcion}` : '.'}`;
}

/** Va a la pantalla de Google y vuelve a esta misma dirección. */
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

/** Avisa cuando la sesión se cierra (p. ej. desde otra pestaña o al caducar). */
export function alCerrarSesion(fn) {
  cliente.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') fn();
  });
}
