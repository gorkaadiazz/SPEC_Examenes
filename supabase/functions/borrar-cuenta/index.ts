// Edge Function `borrar-cuenta` (sección 6.6 de SPEC.md).
//
// Borra la cuenta del usuario que la llama: sus archivos del bucket
// `temarios` y su usuario de Auth (el `on delete cascade` de las tablas
// elimina todas sus filas). El usuario sale del JWT, nunca de un parámetro.
//
// Se despliega CON verificación de JWT (no usar --no-verify-jwt).
// SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGENES = ['https://gorkaadiazz.github.io'];
const esLocalhost = (origen: string) => /^http:\/\/localhost(:\d+)?$/.test(origen);

function cors(req: Request): Record<string, string> {
  const origen = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) || esLocalhost(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const cabeceras = { ...cors(req), 'content-type': 'application/json; charset=utf-8' };
  const responder = (estado: number, datos: unknown) => new Response(JSON.stringify(datos), { status: estado, headers: cabeceras });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return responder(405, { mensaje: 'Método no permitido.' });
  const origen = req.headers.get('origin');
  if (origen && !ORIGENES.includes(origen) && !esLocalhost(origen)) return responder(403, { mensaje: 'Origen no permitido.' });

  try {
    // 1. Quién llama: sale del JWT
    const autorizacion = req.headers.get('authorization') ?? '';
    const cliente = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await cliente.auth.getUser(autorizacion.replace(/^Bearer\s+/i, ''));
    const user = data?.user;
    if (error || !user) return responder(401, { mensaje: 'Tu sesión ha caducado. Vuelve a entrar.' });

    // Confirmación explícita, para que una llamada accidental no borre nada
    const cuerpo = await req.json().catch(() => null);
    if (cuerpo?.confirmar !== 'BORRAR') return responder(400, { mensaje: 'Falta la confirmación.' });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    // 2. Archivos de su carpeta {user_id}/… (dos niveles: carpeta/archivo)
    const bucket = admin.storage.from('temarios');
    for (let vuelta = 0; vuelta < 200; vuelta++) {
      const { data: carpetas, error: e1 } = await bucket.list(user.id, { limit: 100 });
      if (e1) throw new Error(`No se han podido listar los archivos: ${e1.message}`);
      if (!carpetas?.length) break;
      const rutas: string[] = [];
      for (const c of carpetas) {
        if (c.id) rutas.push(`${user.id}/${c.name}`); // archivo suelto
        else {
          const { data: dentro, error: e2 } = await bucket.list(`${user.id}/${c.name}`, { limit: 1000 });
          if (e2) throw new Error(`No se han podido listar los archivos: ${e2.message}`);
          for (const a of dentro ?? []) rutas.push(`${user.id}/${c.name}/${a.name}`);
        }
      }
      if (!rutas.length) break;
      const { error: e3 } = await bucket.remove(rutas);
      if (e3) throw new Error(`No se han podido borrar los archivos: ${e3.message}`);
    }

    // 3. El usuario (y, en cascada, todas sus filas)
    const { error: e4 } = await admin.auth.admin.deleteUser(user.id);
    if (e4) throw new Error(`No se ha podido borrar el usuario: ${e4.message}`);

    // 4. Hecho
    return responder(200, { ok: true });
  } catch (e) {
    console.error(e);
    return responder(500, { mensaje: `La cuenta NO se ha borrado. ${e instanceof Error ? e.message : 'Error del servidor.'}` });
  }
});
