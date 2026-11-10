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

export const VERSION_APP = '0.5.0';
export const SUPABASE_URL = null; // p. ej. 'https://abcdefghijklmnop.supabase.co'
export const SUPABASE_ANON_KEY = null; // p. ej. 'eyJhbGciOi...' o 'sb_publishable_...'
