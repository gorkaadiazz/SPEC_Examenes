// Cliente de Supabase (supabase-js servido en local desde lib/supabase.js,
// que se carga en index.html y deja disponible `window.supabase`).

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/** ¿Está la app conectada a un proyecto de Supabase? */
export const configurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase?.createClient);

export const cliente = configurado
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce', // login con Google con el flujo seguro para apps en el navegador
        persistSession: true, // la sesión se recuerda al cerrar la app
        autoRefreshToken: true, // y se renueva sola
        detectSessionInUrl: true, // recoge el ?code= al volver de Google
      },
    })
  : null;
