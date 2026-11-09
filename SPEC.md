# App de exámenes y tareas: 2º SMR

> Especificación para construir con Claude Code. Copia este archivo a la carpeta del proyecto como `SPEC.md` y usa el prompt de la sección 10.

## 0. Contexto del usuario
- Estudiante de **2º de SMR** en el **IES Ribera del Tajo** (Talavera de la Reina, Toledo, Castilla-La Mancha).
- Usa un **móvil Android** y el PC. La app debe instalarse en ambos y los **datos tienen que estar sincronizados** entre los dos dispositivos.
- Se pierde la evaluación continua con un **25 % de faltas** en un módulo.
- Se le evalúa por **Resultados de Aprendizaje (RA)**: cada módulo tiene varios RA con un peso y hay que aprobarlos todos.

## 1. Qué es
Una **PWA** (Progressive Web App): una web que se instala como una app en Android y en el PC (Chrome/Edge). Se entra con **Google**, los datos se guardan en **Supabase** y la app **sigue funcionando sin internet** con una copia local que se sincroniza al volver la conexión.

- **Frontend:** HTML + CSS + JavaScript sin frameworks.
- **Backend:** **Supabase** (Auth con Google, Postgres con RLS, Storage para los PDF y Edge Functions para Gemini y para borrar la cuenta). Detalle en la sección 6.
- **Copia local / offline:** IndexedDB como caché y cola de cambios pendientes.
- **Instalable:** `manifest.webmanifest` + `service-worker.js`.
- **Publicación gratis:** GitHub Pages (HTTPS).
- **Librerías externas permitidas:** **supabase-js** y **pdf.js**, las dos servidas en local desde `/lib`, no desde una CDN.

## 2. Estilo visual
Mezcla de **limpio y minimalista** con **cada módulo en su color**, con un aire **informático** pero discreto:
- Modo oscuro por defecto (por ejemplo `#0f1419` de fondo y tarjetas `#161b22`) y modo claro. Se elige automáticamente según el sistema y también a mano.
- Colores de módulo **apagados, nada chillones** (tonos pastel o desaturados: azul acero, verde salvia, ámbar suave, violeta grisáceo, terracota, turquesa apagado…). Se usan en bordes, etiquetas y puntos, no en fondos enteros.
- Tipografía: sans-serif del sistema para el texto y **monoespaciada** (`JetBrains Mono`, `Fira Code` o `ui-monospace`) para números, fechas, cuentas atrás y la sección de herramientas.
- Detalles informáticos sutiles: etiquetas tipo `[SOR]`, cuentas atrás estilo `T-3d 04h`, cursor parpadeante en el título, iconos de línea finos.
- Esquinas redondeadas pequeñas (6-8 px), sombras mínimas y mucho espacio en blanco.
- **Pantalla de login:** sencilla, con el nombre de la app, un único botón "Continuar con Google" y un aviso breve de privacidad.

## 3. Módulos (precargados y editables)

| Abrev. | Módulo |
|---|---|
| SOR | Sistemas Operativos en Red |
| SI | Seguridad Informática |
| SR | Servicios en Red |
| AO | Aplicaciones Ofimáticas |
| CNV | Computación en la Nube y Virtualización (optativa) |
| IPE2 | Itinerario Personal para la Empleabilidad II |
| PI | Proyecto Intermodular |
| FE | Formación en Empresa |

Cada módulo tiene: nombre, abreviatura, color, profesor/a, **horas semanales** (para calcular las faltas) y su **lista de RA** con su peso. Se crean automáticamente en el **primer inicio de sesión** del usuario.

## 4. Funciones principales

### 4.1 Evaluaciones (exámenes, prácticas, trabajos…)
- **Tipo:** examen teórico, examen práctico, práctica de laboratorio, trabajo, exposición, entrega en el aula virtual, recuperación.
- Módulo, título, **fecha y hora** y evaluación (1ª, 2ª, final).
- **RA que evalúa** (uno o varios) y su **peso dentro de ese RA**.
- **Temas que entran** (lista de casillas para marcar lo estudiado, que muestra el % preparado).
- **PDF adjuntos** con el temario, guardados en **Supabase Storage** (bucket privado) y usados por el examen con IA.
- Nota obtenida, estado (pendiente, entregado, aprobado o suspendido), notas libres y enlace.

### 4.2 Pantalla de inicio
- **"Lo próximo":** lo de los próximos 7 días con **cuenta atrás**.
- Avisos de lo que vence hoy o mañana.
- **Alertas de riesgo:** un RA suspendido o faltas cerca del límite.
- Resumen de cada módulo: nota actual y % de faltas.
- Indicador discreto de sincronización: `● sincronizado`, `○ sin conexión (3 cambios pendientes)`.

### 4.3 Calendario
- Vista de mes y de semana con los eventos coloreados por módulo. Pulsar un día crea un evento.
- **Exportar a .ics** para pasarlo a Google Calendar (así los avisos saltan en el Android aunque la app esté cerrada).

### 4.4 Notas por RA y "¿qué nota necesito?"
- Cada módulo se divide en RA con su **peso (%)**. Cada RA se calcula con la media ponderada de sus evaluaciones.
- La **nota del módulo** es la suma ponderada de sus RA. El módulo solo se aprueba si **todos los RA están en ≥ 5** (lo marca en rojo si no se cumple, aunque la media dé aprobado).
- **"¿Qué necesito sacar?":** eliges la nota objetivo (5, 7…) y te calcula cuánto necesitas en lo que queda, **tanto por RA como para el módulo**.
- **Simulador:** "si saco X en este examen, ¿cómo quedan el RA y el módulo?".
- El sistema de notas se puede configurar por módulo por si algún profesor usa porcentajes simples (exámenes y prácticas) en lugar de RA.

### 4.5 Control de faltas
- Límite del **25 %** de las horas del módulo (configurable).
- Botón rápido "falta hoy" en cada módulo (justificada o no, y nº de horas).
- Barra de progreso: verde, naranja al 70 % del límite y rojo al 90 %. Indica también **cuántas horas te quedan** antes de perder la evaluación continua.

### 4.6 Examen de preguntas cortas con IA (Gemini vía Edge Function)
1. En una evaluación o módulo, **subes los PDF** con lo que entra (a Supabase Storage).
2. La app extrae el texto con **pdf.js** en el navegador y lo envía a la Edge Function. Si el PDF es escaneado y no tiene texto, envía la **ruta del PDF en Storage** y la Edge Function lo descarga y se lo pasa a Gemini, que acepta PDF.
3. Eliges el **nº de preguntas** (5, 10 o 20) y la dificultad.
4. La Edge Function `gemini` pide a Gemini **preguntas cortas** en **JSON** (`pregunta`, `respuesta_modelo`, `tema`) y las devuelve.
5. Respondes escribiendo. Al terminar, la misma función (acción `corregir`) puntúa cada respuesta del 0 al 10 y da un comentario breve de qué faltó.
6. Se guarda el **historial de intentos** por módulo y tema, con una gráfica de evolución y los "temas flojos".
7. Botón para **convertir los fallos en flashcards** (ver 5.3).

**Reglas:**
- La **clave de Gemini nunca llega al navegador**: vive como secreto de Supabase (`GEMINI_API_KEY`) y solo la usa la Edge Function.
- El modelo se configura con otro secreto (`GEMINI_MODEL`). Por defecto, el **Flash** gratuito más reciente (comprobar en la documentación de Google el nombre exacto en el momento de programarlo).
- **Límite por usuario** (por ejemplo, 20 llamadas al día) para no agotar la cuota gratis, controlado con la tabla `uso_ia`.
- Gestionar los errores 429 de Gemini con un mensaje claro: "has llegado al límite gratis, prueba en un rato".
- **Plan B sin IA:** importar un examen en JSON (por si Gemini falla o la capa gratuita no está disponible en España). Hay que mostrar el formato del JSON para generarlo desde Claude o desde cualquier chat.
- Aviso en Ajustes: en la capa gratuita Google puede usar el contenido enviado para mejorar sus modelos. Para apuntes de clase no importa, pero no hay que subir nada personal.

## 5. Funciones extra

### 5.1 Formación en Empresa (FE)
- Horas totales exigidas (configurable) y fechas de inicio y fin.
- Registro diario: fecha, horas y tareas realizadas (sirve para el diario o la memoria de prácticas).
- Progreso en % y fecha estimada de fin. Exportar el registro a texto o CSV.

### 5.2 Herramientas de redes y sistemas (offline)
- **Calculadora de subredes IPv4:** IP + máscara o CIDR, que da red, broadcast, rango de hosts, nº de hosts y wildcard. También divide una red en N subredes (VLSM).
- **Conversor** decimal, binario y hexadecimal (con la IP en binario por octetos).
- **Chuleta de puertos** con buscador.
- **Chuletas de comandos** con buscador: Linux, Windows/PowerShell, Active Directory, Cisco básico y **virtualización/nube** (VirtualBox `VBoxManage`, Proxmox `qm`, Docker y `virsh`, por el módulo de CNV). Las que vienen por defecto están en `data/comandos.json` y las que añade el usuario se guardan en la tabla `chuletas`.

### 5.3 Estudio
- **Pomodoro** (25/5 configurable) asociado a un módulo, que lleva la cuenta del tiempo estudiado por módulo y semana.
- **Flashcards** por módulo con repetición espaciada sencilla ("me la sé / dudosa / no me la sé").

### 5.4 Recordatorios
- Notificaciones del navegador (pidiendo permiso) X días antes de cada evaluación. En Android funcionan bien con la PWA instalada, pero solo son fiables con la app abierta. Por eso:
  - Al abrir la app se muestra siempre un banner con lo urgente.
  - Para avisos garantizados se usa la exportación **.ics** a Google Calendar.

### 5.5 Datos y cuenta
- **Exportar todos mis datos en JSON** (incluidos los enlaces a los PDF o los PDF en base64, a elegir).
- **Importar JSON**, por ejemplo para restaurar una copia.
- **Cerrar sesión** (borra también la caché local del dispositivo).
- **Borrar cuenta** (ver 6.6).

## 6. Backend: Supabase

### 6.1 Autenticación: login con Google
- Supabase Auth con el **proveedor Google** (OAuth). Hay que crear el cliente OAuth en Google Cloud Console y pegar el Client ID y el Secret en Supabase → Authentication → Providers → Google.
- **URLs de redirección** permitidas: `http://localhost:XXXX` (para el desarrollo) y la URL de GitHub Pages (`https://<usuario>.github.io/<repo>/`).
- Flujo **PKCE** de supabase-js (`signInWithOAuth({ provider: 'google' })`), con la sesión persistente y el refresco automático del token.
- Si no hay sesión, se muestra solo la pantalla de login. Ninguna vista de datos se renderiza sin usuario.
- **Restringir quién puede entrar:** la app es personal, así que hay que limitar el acceso a una **lista de emails permitidos** (tabla `emails_permitidos` comprobada con un trigger o un Auth Hook al registrarse, o desactivando los registros nuevos en Supabase una vez creada tu cuenta). Así nadie más gasta tu cuota de Gemini ni de Supabase.

### 6.2 Tablas (todas con `user_id`)
Todas las tablas llevan:
```sql
user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()   -- con trigger que lo actualiza
```
y un `id uuid primary key default gen_random_uuid()` generado **en el cliente** (para poder crear registros offline).

| Tabla | Contenido principal |
|---|---|
| `perfiles` | nombre, curso, centro, límite de faltas (%), tema visual, preferencias (`id` = `auth.uid()`) |
| `modulos` | nombre, abreviatura, color, profesor, horas_semanales, sistema_notas (`ra` / `porcentajes`) |
| `resultados_aprendizaje` | modulo_id, código (RA1…), descripción, peso |
| `evaluaciones` | modulo_id, tipo, título, fecha, evaluación, estado, nota, notas, enlace |
| `evaluacion_ra` | evaluacion_id, ra_id, peso dentro del RA |
| `temas` | evaluacion_id, texto, estudiado (bool), orden |
| `archivos` | evaluacion_id / modulo_id, ruta en Storage, nombre, tamaño |
| `faltas` | modulo_id, fecha, horas, justificada |
| `fe_registros` | fecha, horas, tareas |
| `examenes_ia` | modulo_id, temas, preguntas (jsonb), respuestas (jsonb), nota, fecha |
| `flashcards` | modulo_id, pregunta, respuesta, nivel, próxima_revisión |
| `pomodoro_sesiones` | modulo_id, inicio, minutos |
| `chuletas` | categoría, comando, descripción |
| `uso_ia` | fecha, nº de llamadas (para el límite diario) |

- Las claves foráneas entre tablas usan `on delete cascade` (por ejemplo, al borrar un módulo se borran sus evaluaciones).
- **Índices** en `user_id` y en las columnas de fecha más consultadas.
- Todo se define en **migraciones SQL** dentro de `supabase/migrations/`, nada creado a mano en el panel.

### 6.3 RLS en todas las tablas
- `alter table ... enable row level security;` en **todas** las tablas sin excepción (también en `uso_ia` y `perfiles`).
- Cuatro políticas por tabla (select, insert, update, delete) para el rol `authenticated`:
```sql
create policy "solo_mis_filas_select" on public.evaluaciones
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "solo_mis_filas_insert" on public.evaluaciones
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "solo_mis_filas_update" on public.evaluaciones
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "solo_mis_filas_delete" on public.evaluaciones
  for delete to authenticated using ((select auth.uid()) = user_id);
```
- En `uso_ia` el usuario solo puede **leer**. La escritura la hace la Edge Function con la service role.
- Ninguna política para el rol `anon`: sin sesión no se ve nada.
- En el frontend solo se usa la **anon/publishable key**. La **service role key nunca va al frontend ni al repositorio**.
- Hay que añadir un **test de RLS** (script SQL o en JS con dos usuarios de prueba) que compruebe que el usuario A no puede leer, editar ni borrar filas del usuario B.

### 6.4 Storage
- Bucket **privado** `temarios`. Los archivos se guardan en la ruta `{user_id}/{evaluacion_id}/{nombre}.pdf`.
- Políticas de `storage.objects` para que cada usuario solo acceda a su carpeta:
```sql
(storage.foldername(name))[1] = (select auth.uid())::text
```
- Límite de tamaño por archivo (por ejemplo 20 MB) y solo `application/pdf`.
- Para ver o descargar un PDF se usan **URLs firmadas** de corta duración.

### 6.5 Edge Function `gemini`
- Está en `supabase/functions/gemini/index.ts` (Deno) y **verifica el JWT** (sin `--no-verify-jwt`).
- Crea un cliente de Supabase con el JWT del usuario, para que todo lo que lea pase por RLS, y obtiene el `user.id` con `auth.getUser()`.
- Acciones: `generar` (texto o ruta de PDF, nº de preguntas, dificultad) y `corregir` (preguntas, respuestas modelo y respuestas del usuario).
- Si recibe una ruta de PDF, comprueba que empieza por `{user.id}/` antes de descargarla.
- Comprueba y suma el **límite diario** en `uso_ia` (con la service role, solo para esa tabla).
- Llama a Gemini con `GEMINI_API_KEY` y pide JSON (`responseMimeType: "application/json"` + esquema). Valida el JSON antes de devolverlo.
- CORS limitado a `localhost` y a la URL de GitHub Pages.
- Errores con mensajes claros en español: límite diario, 429 de Gemini, PDF demasiado grande o JSON inválido.

### 6.6 Borrar cuenta
- En Ajustes → "Zona peligrosa" → **Borrar mi cuenta**.
- Antes de borrar se ofrece **exportar los datos en JSON**, y para confirmar hay que **escribir `BORRAR`**.
- Lo hace una Edge Function `borrar-cuenta` (con verificación de JWT) que:
  1. Obtiene el `user.id` a partir del JWT (nunca de un parámetro que mande el cliente).
  2. Borra todos los archivos del bucket `temarios` bajo `{user_id}/`.
  3. Llama a `auth.admin.deleteUser(user.id)` con la service role. El `on delete cascade` elimina todas sus filas en todas las tablas.
  4. Devuelve OK. El cliente cierra la sesión, borra IndexedDB y la caché del service worker y vuelve al login.
- Si falla algún paso, no se da por borrada la cuenta y se muestra el error.

### 6.7 Offline y sincronización
- **Lectura:** se muestran primero los datos de IndexedDB y después se refrescan desde Supabase.
- **Escritura:** se guarda en IndexedDB y en una **cola de cambios pendientes**. Si hay conexión se envía en el momento y, si no, al volver la conexión (evento `online` y al abrir la app).
- **Conflictos:** gana el cambio con el `updated_at` más reciente. Los borrados también pasan por la cola.
- El examen con IA y la subida de PDF requieren conexión, y la app lo indica.
- Al **cerrar sesión** o **borrar la cuenta** se vacía todo lo local.

### 6.8 A tener en cuenta del plan gratis de Supabase
- Los proyectos gratuitos se **pausan tras un periodo sin actividad** (una semana, aproximadamente). Se reactivan desde el panel. Usándola a diario no debería pasar, pero en vacaciones sí.
- El almacenamiento de Storage es limitado, así que conviene no subir PDF enormes.
- Hay que comprobar los límites vigentes en la web de Supabase al crear el proyecto.

## 7. Estructura del proyecto
```
/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── css/styles.css
├── js/
│   ├── app.js              # arranque, comprobación de sesión y navegación
│   ├── config.js           # SUPABASE_URL y anon key (públicas)
│   ├── supabase.js         # cliente supabase-js
│   ├── auth.js             # login con Google, logout, borrar cuenta
│   ├── sync/               # cache IndexedDB + cola de cambios + sincronización
│   ├── repos/              # acceso a cada tabla (modulos, evaluaciones, faltas…)
│   ├── notas.js            # cálculo por RA, "qué necesito", simulador
│   ├── ia.js               # llamadas a la Edge Function gemini
│   ├── ui/                 # login, inicio, calendario, modulos, notas, faltas, fe, examen-ia, herramientas, ajustes
│   ├── tools/              # subredes, conversor, pomodoro, flashcards
│   └── utils/              # fechas, ics, backup, pdf
├── lib/                    # supabase-js y pdf.js en local
├── data/modulos-2smr.json, puertos.json, comandos.json
├── icons/
├── supabase/
│   ├── migrations/         # tablas, triggers, RLS, storage policies
│   ├── functions/
│   │   ├── gemini/index.ts
│   │   └── borrar-cuenta/index.ts
│   └── seed.sql            # datos de prueba (solo local)
└── tests/                  # subredes, notas por RA y RLS
```
**Navegación:** barra inferior en Android (Inicio · Calendario · Notas · Estudiar · Más) y barra lateral en el PC.

**Secretos:** `GEMINI_API_KEY`, `GEMINI_MODEL` y `SUPABASE_SERVICE_ROLE_KEY` solo como secretos de Supabase (`supabase secrets set`). En el repo hay que añadir un `.gitignore` con `.env` y `supabase/.env`.

## 8. Plan por fases
1. **Base local:** estructura, estilo visual, módulos, CRUD de evaluaciones e inicio con "lo próximo", todavía solo con IndexedDB.
2. **PWA:** manifest, iconos y service worker. Subirla a GitHub Pages e instalarla en el Android.
3. **Supabase:** crear el proyecto, migraciones (tablas + RLS + Storage), login con Google, restricción de emails, sincronización offline y test de RLS.
4. **Notas por RA** + "qué necesito" + simulador, y **faltas**.
5. **Calendario** + exportación .ics.
6. **Examen con IA:** Edge Function `gemini` + subida de PDF + historial + límite diario + importación JSON como plan B.
7. **Herramientas SMR** (subredes, conversor, puertos, comandos).
8. **FE, Pomodoro, flashcards, notificaciones, exportar/importar y borrar cuenta.**
9. **Pulido:** accesibilidad, Lighthouse, pruebas en el móvil real y revisión de seguridad (secretos, RLS, CORS).

## 9. Criterios de "terminado"
- Se instala en Android desde Chrome ("Instalar app") y en el PC.
- Solo se puede entrar con Google y solo con los emails permitidos.
- **RLS activado en todas las tablas** y el test confirma que un usuario no ve los datos de otro.
- La clave de Gemini y la service role **no aparecen** en el frontend ni en el repo (comprobar con una búsqueda en el código y en el build).
- Los cambios hechos sin conexión se sincronizan al volver la conexión, y lo hecho en el PC aparece en el móvil.
- Borrar la cuenta elimina el usuario, todas sus filas y todos sus PDF, y deja el dispositivo limpio.
- Los cálculos de RA y de subredes pasan los tests.
- Lighthouse > 90 en Accesibilidad, Rendimiento y Buenas prácticas.

---

## 10. Prompt para pegar en Claude Code
```
Lee SPEC.md en esta carpeta: es la especificación de una PWA para
organizar mis exámenes, prácticas, notas por RA y faltas de 2º de SMR,
con backend en Supabase. Quiero construirla por fases, tal y como indica
la sección 8.

Empieza por las fases 1 y 2: estructura de carpetas, estilo visual de la
sección 2, IndexedDB, módulos precargados de la sección 3, CRUD de
evaluaciones, pantalla de inicio con "lo próximo" y la parte PWA
(manifest, iconos provisionales y service worker). Diseña la capa de
datos (js/repos y js/sync) pensando ya en que en la fase 3 se conectará
a Supabase, con ids uuid generados en el cliente y updated_at.

Requisitos: HTML, CSS y JS sin frameworks (solo supabase-js y pdf.js en
local), mobile-first pensando en Android, interfaz en español y código
comentado en español para que lo entienda. Nunca pongas claves secretas
en el frontend. Al acabar cada fase, dime cómo probarla en local y en el
móvil, y para antes de pasar a la siguiente. En la fase 3, guíame paso
a paso para crear el proyecto de Supabase y configurar Google OAuth.
```

**Para publicarla:** pídele a Claude Code "ayúdame a subir esto a GitHub y activar GitHub Pages". Después abre el enlace en Chrome en tu Android y pulsa "Instalar app".

**Cuentas que necesitas:** GitHub, Supabase (gratis), Google Cloud Console (para el login con Google, gratis) y Google AI Studio (clave de Gemini, gratis).
