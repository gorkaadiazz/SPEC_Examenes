# Fase 3: poner en marcha Supabase y el login con Google

Esta guía te lleva desde cero hasta tener la app con cuenta de Google y los datos sincronizados entre el móvil y el PC. Se tarda unos 30 minutos. Necesitas:

- La cuenta de **GitHub** (ya la tienes).
- Una cuenta en **Supabase** (gratis): <https://supabase.com>.
- Una cuenta de **Google** para Google Cloud Console (gratis): <https://console.cloud.google.com>.

Mientras no termines, la app sigue funcionando en «modo local», como hasta ahora. Cuando inicies sesión por primera vez, lo que tengas apuntado en ese dispositivo se sube a tu cuenta.

> Los menús de Supabase y Google cambian de nombre de vez en cuando. Si algo no aparece exactamente así, busca la opción con un nombre parecido.

---

## 1. Crear el proyecto de Supabase

1. Entra en <https://supabase.com/dashboard> y pulsa **New project**.
2. Rellena:
   - **Name:** `examenes-2smr`.
   - **Database password:** pulsa *Generate a password* y **guárdala** en un gestor de contraseñas. No la pongas en el código.
   - **Region:** una de Europa, por ejemplo *West EU (Paris)* o *Central EU (Frankfurt)*.
3. Pulsa **Create new project** y espera un par de minutos.
4. Apunta el **Project ID**: son las letras de la dirección del panel, `https://supabase.com/dashboard/project/<project-id>`. Lo usarás en el paso 3.

## 2. Crear las tablas, la seguridad (RLS) y el almacén de apuntes

Las migraciones están en `supabase/migrations/`. Hay que ejecutarlas **en orden**.

**Opción A: desde el panel (la más sencilla)**

1. En Supabase, abre **SQL Editor** → **New query**.
2. Copia el contenido de cada archivo, pégalo y pulsa **Run**, uno detrás de otro:
   1. `20261110000100_tablas.sql`
   2. `20261110000200_rls.sql`
   3. `20261110000300_storage.sql`
   4. `20261110000400_emails_permitidos.sql`
3. Cada uno debe terminar con *Success. No rows returned*.

**Opción B: con la terminal** (si tienes Node instalado)

```bash
npx supabase login
```

```bash
npx supabase link --project-ref TU_PROJECT_ID
```

```bash
npx supabase db push
```

## 3. Autorizar tu email

La app es personal: **solo pueden entrar los emails de la lista**. En **SQL Editor** ejecuta esto con tu Gmail, en minúsculas:

```sql
insert into public.emails_permitidos (email) values ('tu.email@gmail.com');
```

Si algún día quieres dar acceso a otro email, repite la misma orden con ese email.

## 4. Crear el acceso de Google (Google Cloud Console)

1. Entra en <https://console.cloud.google.com> → selector de proyectos (arriba) → **New project** → nombre `examenes-2smr` → **Create**.
2. Menú ☰ → **APIs & Services** → **OAuth consent screen** (o **Google Auth Platform**) → **Get started**:
   - **App name:** `Exámenes 2º SMR`.
   - **User support email:** tu Gmail.
   - **Audience:** *External*.
   - **Contact information:** tu Gmail.
   - Acepta y pulsa **Create**.
3. En **Audience**, en *Test users*, pulsa **Add users** y añade tu Gmail. Mientras la app esté «en pruebas», solo los usuarios de prueba pueden entrar, y es justo lo que queremos.
4. En **Clients** (o **Credentials** → **Create credentials** → **OAuth client ID**):
   - **Application type:** *Web application*.
   - **Name:** `examenes-2smr-web`.
   - **Authorized JavaScript origins:**
     - `https://gorkaadiazz.github.io`
     - `http://localhost:8080`
   - **Authorized redirect URIs:**
     - `https://TU_PROJECT_ID.supabase.co/auth/v1/callback`
   - Pulsa **Create**.
5. Copia el **Client ID** y el **Client secret**. El *secret* no se pone en el código ni en el repo: solo en Supabase (paso 5).

## 5. Activar Google en Supabase

1. En Supabase: **Authentication** → **Sign In / Providers** (o **Providers**) → **Google**.
2. Activa **Enable Sign in with Google**.
3. Pega el **Client ID** y el **Client Secret** del paso 4 y pulsa **Save**.
4. Ahí mismo verás la **Callback URL**. Comprueba que es igual a la que pusiste en Google en el paso 4.

## 6. Decirle a Supabase a qué direcciones puede volver

En **Authentication** → **URL Configuration**:

- **Site URL:** `https://gorkaadiazz.github.io/SPEC_Examenes/`
- **Redirect URLs** → **Add URL**, una a una:
  - `https://gorkaadiazz.github.io/SPEC_Examenes/`
  - `http://localhost:8080/`

Pulsa **Save**.

## 7. Conectar la app a tu proyecto

1. En Supabase: **Project Settings** → **API Keys** (o **Data API**). Copia:
   - la **Project URL** (`https://TU_PROJECT_ID.supabase.co`);
   - la clave **anon public** (empieza por `eyJ…`) o la **publishable key** (empieza por `sb_publishable_…`).
2. Abre `js/config.js` y rellena:

   ```js
   export const SUPABASE_URL = 'https://TU_PROJECT_ID.supabase.co';
   export const SUPABASE_ANON_KEY = 'la-clave-anon-o-publishable';
   ```

   Estas dos son **públicas**: la seguridad la ponen las políticas RLS. Si lo prefieres, pásamelas y lo hago yo.

> ⚠️ **Nunca** copies la clave **service_role** ni la **secret key** en el código ni en un chat. Esas solo van como secretos de Supabase (lo veremos en la fase 6).

## 7 bis. Botón oficial de Google (para que no salga «supabase.co»)

Con el login normal, Google enseña «Iniciar sesión en `<proyecto>.supabase.co`». Con el botón oficial de Google el login ocurre en la propia app y ese dominio no aparece.

1. En `js/config.js` pon el **Client ID** de Google (el del paso 4; acaba en `.apps.googleusercontent.com`). Es público. El *Client secret* **no** va aquí.

   ```js
   export const GOOGLE_CLIENT_ID = '1234567890-abc123.apps.googleusercontent.com';
   ```

2. En Google Cloud → tu cliente OAuth → **Authorized JavaScript origins**, comprueba que están estos tres (para probar en local, Google pide `http://localhost` con y sin puerto):
   - `https://gorkaadiazz.github.io`
   - `http://localhost`
   - `http://localhost:8080`
3. En Supabase → **Authentication → Sign In / Providers → Google**, el campo **Client IDs** debe contener ese mismo Client ID (ya lo pusiste en el paso 5). Deja **Skip nonce checks** desactivado.

Si el botón de Google no carga (sin conexión, bloqueado…), la app enseña su propio botón «Continuar con Google», que entra por el método normal.

## 8. Probarlo

**En el PC (local):**

```bash
python3 -m http.server 8080
```

1. Abre <http://localhost:8080>. Verás la pantalla de **Continuar con Google**.
2. Entra con tu Gmail. La primera vez se crean tus 8 módulos (o se sube lo que tuvieras apuntado en modo local).
3. Abajo del todo en Inicio, y en Ajustes, el indicador debe decir **Sincronizado**.

**Comprobar que tu email es el único que entra:** prueba a entrar con otro Gmail. Debe salir *«Este email no tiene acceso a la app»*.

**Comprobar la seguridad (RLS):** en **SQL Editor**, pega el contenido de `tests/rls.sql` y pulsa **Run**. Debe terminar con:

```
NOTICE: RLS OK: 23 comprobaciones superadas
```

No deja nada guardado: todo se deshace al final.

**En el móvil:**

1. Sube los cambios y fusiona el PR para que GitHub Pages los publique.
2. Abre `https://gorkaadiazz.github.io/SPEC_Examenes/` en Chrome y entra con el mismo Gmail.
3. Crea un examen en el PC y, en el móvil, cierra y abre la app (o espera un minuto): debe aparecer.
4. Pon el móvil en modo avión, apunta algo y verás *«Sin conexión (1 cambio pendiente)»*. Quita el modo avión: se sube solo.

## Cómo funciona la sincronización (resumen)

- La app siempre enseña primero lo que hay en el dispositivo y después descarga lo nuevo.
- Cada cambio se guarda al momento en el dispositivo y se apunta en una **cola**. Se sube en cuanto hay conexión: al momento, al volver la conexión, al abrir la app y cada minuto.
- Si cambias lo mismo en dos dispositivos, **gana el cambio más reciente**.
- Los apuntes (PDF y fotos) se suben al bucket privado `temarios`. En el otro dispositivo se abren con un enlace temporal de 2 minutos.
- **Cerrar sesión** (en Ajustes) borra la copia de este dispositivo; en la nube no se borra nada.

## A tener en cuenta del plan gratis

- Los proyectos gratuitos se **pausan tras una semana sin uso** (por ejemplo, en vacaciones). Se reactivan desde el panel con **Restore project**. Mientras esté pausado, la app sigue funcionando sin conexión y sube los cambios cuando vuelva.
- El espacio de Storage es limitado: mejor no subir PDF enormes. La app no deja pasar de 20 MB por archivo.
- Comprueba los límites actuales en <https://supabase.com/pricing>.
