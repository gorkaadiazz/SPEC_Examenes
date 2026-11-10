// Convierte una foto elegida por el usuario en una miniatura cuadrada pequeña
// (JPEG en base64), para usarla como imagen de un módulo sin ocupar casi nada.

const LADO = 192; // píxeles de la miniatura

/** @param {File} archivo  imagen elegida en un <input type="file"> */
export async function miniatura(archivo) {
  if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen (JPG, PNG…).');
  const img = await createImageBitmap(archivo);
  // Recorte cuadrado centrado
  const lado = Math.min(img.width, img.height);
  const sx = (img.width - lado) / 2;
  const sy = (img.height - lado) / 2;
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;
  lienzo.getContext('2d').drawImage(img, sx, sy, lado, lado, 0, 0, LADO, LADO);
  img.close?.();
  return lienzo.toDataURL('image/jpeg', 0.85);
}

/** Solo se aceptan miniaturas generadas por `miniatura()` (data URL JPEG). */
export function esMiniaturaValida(texto) {
  return typeof texto === 'string' && texto.startsWith('data:image/jpeg;base64,') && texto.length < 200_000;
}
