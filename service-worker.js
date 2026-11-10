// Service worker: guarda la app en el dispositivo para que abra sin conexión.
// Solo cachea archivos de la propia app (mismo origen); los datos del usuario
// están en IndexedDB y, desde la fase 3, las llamadas a Supabase no pasan por aquí.

// Sube este número cada vez que publiques cambios para renovar la caché.
const VERSION = 'v0.7.1';
const CACHE = `examenes-2smr-${VERSION}`;

// "Esqueleto" de la app: lo mínimo para arrancar sin red.
const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/supabase.js',
  './js/auth.js',
  './js/sync/sincronizar.js',
  './js/sync/reglas.js',
  './js/ui/login.js',
  './lib/supabase.js',
  './js/sync/db.js',
  './js/sync/cola.js',
  './js/repos/base.js',
  './js/repos/modulos.js',
  './js/repos/evaluaciones.js',
  './js/repos/archivos.js',
  './js/ui/inicio.js',
  './js/ui/evaluaciones.js',
  './js/ui/modulos.js',
  './js/ui/ajustes.js',
  './js/ui/iconos.js',
  './js/ui/ilustraciones.js',
  './js/ui/apuntes.js',
  './js/ui/pendiente.js',
  './js/utils/dom.js',
  './js/utils/eventos.js',
  './js/utils/fechas.js',
  './js/utils/imagen.js',
  './js/utils/progreso.js',
  './js/utils/tema.js',
  './data/modulos-2smr.json',
  './fonts/bricolage-grotesque.woff2',
  './icons/icono.svg',
  './icons/icono-192.png',
  './icons/icono-512.png',
];

// Instalación: se descarga el esqueleto completo.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting()),
  );
});

// Activación: se borran las cachés de versiones anteriores.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('examenes-2smr-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Peticiones: primero la red (así siempre se ve la versión más nueva al
// publicar cambios) y, si no hay conexión o tarda más de 3 s, la copia
// guardada. Cada respuesta buena de la red renueva la copia.
const ESPERA_RED = 3000;

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const copia = () => cache.match(request, { ignoreSearch: request.mode === 'navigate' });
      const deRed = fetch(request, { cache: 'no-cache' }).then((resp) => {
        if (resp.ok) e.waitUntil(cache.put(request, resp.clone()));
        return resp;
      });
      try {
        // Si la red tarda, se sirve la copia (si la hay) sin dejar de esperar a la red
        const lenta = new Promise((ok) => setTimeout(ok, ESPERA_RED)).then(async () => (await copia()) ?? deRed);
        return await Promise.race([deRed, lenta]);
      } catch {
        // Sin conexión: la copia guardada o, para una página, la portada
        return (await copia()) ?? (request.mode === 'navigate' ? cache.match('./index.html') : Response.error());
      }
    }),
  );
});
