# Activar «Borrar mi cuenta»

El botón **Ajustes → Zona peligrosa → Borrar mi cuenta** necesita una función en Supabase. Sin ella, la app avisa de que la cuenta **no** se ha borrado y no toca nada.

## Desplegar la función `borrar-cuenta`

**Desde el panel**

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre: `borrar-cuenta` (exactamente así).
3. Borra el código de ejemplo y pega el contenido de `supabase/functions/borrar-cuenta/index.ts`.
4. Deja activado **Verify JWT**.
5. Pulsa **Deploy**.

**Con la terminal**

```bash
npx supabase functions deploy borrar-cuenta
```

No necesita ningún secreto: usa los que Supabase da a todas las funciones.

## Qué hace

1. Sabe quién eres por tu sesión (no acepta el usuario como parámetro) y exige la confirmación `BORRAR`.
2. Borra todos tus archivos del bucket `temarios`.
3. Borra tu usuario; con él se borran en cascada todas tus filas de todas las tablas.
4. La app cierra la sesión, borra los datos del dispositivo y la caché, y vuelve al login.

Si falla cualquier paso, devuelve un error y la cuenta no se da por borrada.

## Quitar lo de la IA (ya no se usa)

La app ya no usa Gemini. Si llegaste a configurarlo, puedes borrarlo en Supabase:

- **Edge Functions** → función `gemini` → **Delete**.
- **Edge Functions → Secrets** → borra `GEMINI_API_KEY` (y `GEMINI_MODEL`, `LIMITE_IA_DIARIO` si los creaste).
- En <https://aistudio.google.com/apikey> puedes borrar también la clave.

La tabla `uso_ia` y la función SQL `sumar_uso_ia` pueden quedarse: no molestan y nadie las usa.
