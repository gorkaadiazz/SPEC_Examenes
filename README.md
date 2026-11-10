# Exámenes 2º SMR

PWA para organizar exámenes, prácticas, notas por RA y faltas de 2º de SMR.
La especificación completa está en [SPEC.md](SPEC.md).

**Estado:** fases 1, 2 y 3 hechas: base local con IndexedDB, PWA instalable,
login con Google y sincronización con Supabase.

Para conectar Supabase y Google sigue **[docs/FASE3-SUPABASE.md](docs/FASE3-SUPABASE.md)**.
Mientras `js/config.js` no tenga la URL y la clave pública de Supabase, la app
funciona en «modo local» (sin cuenta y con los datos solo en ese dispositivo).

## Probar en local

```bash
python3 -m http.server 8080
```

Abre <http://localhost:8080>. No hay que instalar ni compilar nada.

Tests de las utilidades y de las reglas de sincronización (Node 20 o superior):

```bash
npm test
```

Migraciones y test de RLS en un Postgres temporal (sin Docker):

```bash
bash tests/probar-sql.sh
```

En el proyecto real de Supabase, el test de RLS se ejecuta pegando
`tests/rls.sql` en el SQL Editor.

## Publicar en GitHub Pages

1. Fusiona esta rama en `main`.
2. En GitHub: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
3. Abre `https://<usuario>.github.io/<repo>/` en Chrome en el Android y pulsa
   **⋮ → Instalar app**.

Al publicar cambios, sube el número `VERSION` de `service-worker.js` para que
los dispositivos renueven la caché (el cambio se ve al abrir la app por
segunda vez).

## Estructura

- `js/sync/`: copia local en IndexedDB, cola de cambios y sincronización con Supabase.
- `js/repos/`: acceso a los datos (lo único que tocan las vistas).
- `js/ui/`: pantallas. `js/utils/`: fechas, DOM, tema.
- `js/supabase.js`, `js/auth.js`: cliente de Supabase y login con Google.
- `lib/`: supabase-js servido en local.
- `supabase/migrations/`: tablas, RLS, Storage y lista de emails permitidos.
- `data/`: módulos precargados.

Nunca se guardan claves secretas en este repositorio: en `js/config.js` solo van
la URL y la clave pública (anon/publishable) de Supabase.
