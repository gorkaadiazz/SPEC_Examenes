# Fase 6: activar el examen con IA (Gemini)

La app ya tiene la pantalla **Estudiar**, pero la IA no funciona hasta que hagas estos pasos en tus cuentas (unos 15 minutos). Mientras tanto puedes usar **«Importar un examen sin IA»**.

La clave de Gemini **nunca va en el código ni en la app**: se guarda como secreto en Supabase y solo la usa la función `gemini`.

## 1. Añadir la función del límite diario a la base de datos

En Supabase → **SQL Editor** → **New query**, pega el contenido de `supabase/migrations/20261110000500_uso_ia.sql` y pulsa **Run**.

## 2. Conseguir la clave de Gemini (gratis)

1. Entra en <https://aistudio.google.com/apikey> con tu cuenta de Google.
2. Pulsa **Create API key** y copia la clave.
3. No la pegues en ningún chat ni en el código: solo en el paso 3.

## 3. Guardar los secretos en Supabase

En Supabase → **Edge Functions** → **Secrets** (o **Project Settings → Edge Functions**), añade:

| Nombre | Valor |
|---|---|
| `GEMINI_API_KEY` | la clave del paso 2 |
| `GEMINI_MODEL` | `gemini-3.6-flash` (opcional; es el valor por defecto) |
| `LIMITE_IA_DIARIO` | `20` (opcional; llamadas por día) |

Si algún día Google retira ese modelo, cambia `GEMINI_MODEL` por el Flash gratuito más reciente de <https://ai.google.dev/gemini-api/docs/models>. No hace falta tocar el código.

## 4. Desplegar la función `gemini`

**Opción A: desde el panel**

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre: `gemini` (exactamente así).
3. Borra el código de ejemplo y pega el contenido de `supabase/functions/gemini/index.ts`.
4. Deja activado **Verify JWT** (o «Enforce JWT verification»).
5. Pulsa **Deploy**.

**Opción B: con la terminal**

```bash
npx supabase login
```

```bash
npx supabase link --project-ref pmcacougksqimitapiqr
```

```bash
npx supabase functions deploy gemini
```

## 5. Probarlo

1. Abre la app, sube un PDF de apuntes a un módulo (Perfil → el módulo → Apuntes) y espera a que ponga **Sincronizado**.
2. Ve a **Estudiar** (icono del libro, arriba en Inicio), elige el módulo, marca el PDF, 5 preguntas, y pulsa **Crear examen con IA**.
3. Responde y pulsa **Corregir con IA**.

**Si algo falla**, el mensaje dice el motivo:

- *«La IA aún no está activada en el servidor»*: la función no está desplegada o no se llama `gemini`.
- *«Falta configurar la clave de Gemini»*: falta el secreto `GEMINI_API_KEY`.
- *«El modelo … no existe»*: cambia el secreto `GEMINI_MODEL`.
- *«La IA ha rechazado la petición»*: clave mal copiada, o la capa gratuita no está disponible para tu cuenta o región.
- *«Has llegado al límite gratis de la IA»*: es el límite de Google; espera un rato.
- *«Has usado las 20 llamadas de hoy»*: es el límite de la app; mañana se reinicia.

Para ver los errores con detalle: Supabase → **Edge Functions** → `gemini` → **Logs**.

## Cómo funciona

- Con un PDF normal, la app saca el texto en tu dispositivo (pdf.js) y solo envía el texto.
- Con un PDF escaneado o una foto, la función lo descarga de tu carpeta de Storage y se lo pasa a Gemini.
- Crear un examen gasta 1 uso y corregirlo, otro. Corregirte tú mismo no gasta ninguno.
- La función solo acepta llamadas de la app (GitHub Pages y localhost), con tu sesión iniciada, y solo lee archivos de tu carpeta.

## Privacidad

En la capa gratuita, Google puede usar lo que le envíes para mejorar sus modelos. Para apuntes de clase no importa, pero no subas nada personal.
