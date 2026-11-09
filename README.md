# Exámenes 2º SMR

PWA para organizar exámenes, prácticas, notas por RA y faltas de 2º de SMR.
La especificación completa está en [SPEC.md](SPEC.md).

**Estado:** fases 1 y 2 hechas (base local con IndexedDB + PWA instalable).
Aún no hay cuenta ni sincronización: los datos viven solo en cada dispositivo
hasta la fase 3 (Supabase).

## Probar en local

```bash
python3 -m http.server 8080
```

Abre <http://localhost:8080>. No hay que instalar ni compilar nada.

Tests de las utilidades (necesita Node 20 o superior):

```bash
npm test
```

## Publicar en GitHub Pages

1. Fusiona esta rama en `main`.
2. En GitHub: **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
3. Abre `https://<usuario>.github.io/<repo>/` en Chrome en el Android y pulsa
   **⋮ → Instalar app**.

Al publicar cambios, sube el número `VERSION` de `service-worker.js` para que
los dispositivos renueven la caché (el cambio se ve al abrir la app por
segunda vez).

## Estructura

- `js/sync/`: copia local en IndexedDB y cola de cambios pendientes.
- `js/repos/`: acceso a los datos (lo único que tocan las vistas).
- `js/ui/`: pantallas. `js/utils/`: fechas, DOM, tema.
- `data/`: módulos precargados. `supabase/`: vacío hasta la fase 3.

Nunca se guardan claves secretas en este repositorio.
