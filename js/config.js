// Configuración pública de la app.
//
// SUPABASE_URL y SUPABASE_ANON_KEY están en Supabase → Project Settings → API
// ("Project URL" y la clave "anon public" / "publishable"). Son PÚBLICAS: la
// seguridad la ponen las políticas RLS de supabase/migrations, no esta clave.
//
// NUNCA pongas aquí la service role key ni la clave de Gemini: esas solo van
// como secretos de Supabase (`supabase secrets set`).
//
// Mientras estén a null la app funciona en "modo local": sin cuenta y con los
// datos solo en este dispositivo.
//
// GOOGLE_CLIENT_ID es el "Client ID" del cliente OAuth de Google Cloud (acaba
// en .apps.googleusercontent.com). También es público. Con él, el login usa el
// botón oficial de Google en esta misma página; sin él, se usa la redirección
// de Supabase (Google enseña entonces el dominio <proyecto>.supabase.co).
// El "Client secret" NO va aquí: solo en Supabase.

export const VERSION_APP = '0.6.0';
export const SUPABASE_URL = 'https://pmcacougksqimitapiqr.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_DDZcsNkJeYLuvk6iRSBa5Q_6bBJX0Nw'; // clave pública
export const GOOGLE_CLIENT_ID = null; // p. ej. '1234567890-abc123.apps.googleusercontent.com'
