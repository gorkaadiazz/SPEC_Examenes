// Extrae el texto de un PDF en el navegador con pdf.js (servido desde lib/).
// La librería pesa, así que solo se carga cuando hace falta.

const MAX_PAGINAS = 80;

let pdfjs = null;
async function cargar() {
  if (!pdfjs) {
    pdfjs = await import('../../lib/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../lib/pdf.worker.min.mjs', import.meta.url).href;
  }
  return pdfjs;
}

/**
 * @param {Blob} blob  el PDF
 * @returns {Promise<string>} su texto ('' si es un PDF escaneado, sin texto)
 */
export async function textoDePDF(blob) {
  const { getDocument } = await cargar();
  const tarea = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false, useSystemFonts: true });
  const pdf = await tarea.promise;
  try {
    const paginas = [];
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGINAS); n++) {
      const contenido = await (await pdf.getPage(n)).getTextContent();
      paginas.push(contenido.items.map((i) => i.str + (i.hasEOL ? '\n' : ' ')).join(''));
    }
    return paginas.join('\n\n').replace(/[ \t]+/g, ' ').trim();
  } finally {
    await tarea.destroy();
  }
}

/** Con menos texto que esto, el PDF se trata como escaneado (lo leerá la IA directamente). */
export const MINIMO_TEXTO_UTIL = 200;
