# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Un único estudiante de 2º de SMR (Sistemas Microinformáticos y Redes) en el IES Ribera del Tajo, Talavera de la Reina. La usa sobre todo **de día, en clase o en el bus**, desde un móvil Android con la PWA instalada, y también en el PC. Su trabajo: saber qué examen o entrega viene, cuánto lleva estudiado, cómo van sus notas por RA y cuántas faltas puede permitirse.

## Product Purpose
Organizar exámenes, prácticas, trabajos y entregas de 2º SMR, con notas por Resultados de Aprendizaje (RA), control de faltas (se pierde la evaluación continua con un 25 %), examen de práctica (sin IA: preguntas importadas y autocorrección), herramientas de redes y Formación en Empresa. Éxito: nunca le pilla por sorpresa un examen y sabe en todo momento qué nota necesita.

## Positioning
Hecha a medida del ciclo: módulos de 2º SMR precargados, evaluación por RA donde hay que aprobar todos, límite de faltas por horas del módulo. Una agenda genérica no sabe nada de eso.

## Operating Context
Consultas rápidas varias veces al día con el móvil en una mano y con luz de día; altas de exámenes en el momento en que el profesor los anuncia. En el PC, repaso y planificación más larga. Tiene que funcionar sin conexión.

## Capabilities and Constraints
- HTML + CSS + JS sin frameworks; solo supabase-js y pdf.js servidos en local. Publicada en GitHub Pages. Instalable (PWA), mobile-first.
- Interfaz en español; código comentado en español.
- Especificación completa en `SPEC.md` (fases 1-9). Todas hechas (v1.0). La IA de la fase 6 se retiró a petición del usuario porque no le funcionaba; queda el plan B sin IA.
- Navegación: barra inferior en móvil (Inicio · Calendario · Notas · Estudiar · Más), lateral en PC.
- Cada módulo tiene su propio color (apagado, no chillón); tema claro y oscuro, elegible a mano.

## Brand Commitments
- Nombre visible actual: «Exámenes 2º SMR».
- El usuario **rechazó** el estilo «informático/terminal» (monoespaciada como disfraz, prompt `~$`, etiquetas `[SOR]`, cuentas atrás `T-3d`), y también lo encontró soso, apretado y con formularios toscos en el móvil.
- Tema por defecto: **claro** (uso de día); el oscuro sigue disponible.
- Dirección pedida por el usuario: **como una red social tipo Instagram, pero realista y profesional, que no parezca hecha por IA**. Interfaz neutra (blanco/negro, líneas finas, letra del sistema) y el color lo ponen los módulos (historias, publicaciones, cuadrícula del perfil). Sin degradados decorativos ni paletas violeta/rosa.

## Evidence on Hand
Lista real de módulos en `data/modulos-2smr.json`. No hay logo, fotos ni datos reales de notas todavía.

## Product Principles
1. Lo urgente se ve sin buscarlo: qué viene y cuándo, a primera vista.
2. Una mano, un vistazo: legible y pulsable en el móvil con luz de día.
3. Los datos del alumno nunca se pierden: offline primero, sincronización después.
4. Cada módulo se reconoce por su color en toda la app.
