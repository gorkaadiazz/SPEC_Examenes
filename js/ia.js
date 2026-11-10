// Llamadas a la Edge Function `gemini` (sección 4.6 de SPEC.md).
// La clave de Gemini nunca está en el navegador: vive en Supabase y solo la
// usa la función. Aquí solo se envía el temario y se recibe el resultado.

import { cliente, configurado } from './supabase.js';

/** ¿Se puede usar la IA ahora? Devuelve el motivo si no, o null. */
export function motivoSinIA() {
  if (!configurado) return 'La IA necesita iniciar sesión.';
  if (!navigator.onLine) return 'La IA necesita conexión a internet.';
  return null;
}

async function llamar(cuerpo) {
  const motivo = motivoSinIA();
  if (motivo) throw new Error(motivo);
  const { data, error } = await cliente.functions.invoke('gemini', { body: cuerpo });
  if (error) {
    // La función devuelve { mensaje } en español con el motivo
    let mensaje = null;
    try {
      mensaje = (await error.context?.json?.())?.mensaje;
    } catch {
      /* la respuesta no era JSON */
    }
    if (!mensaje && /not found|404/i.test(error.message ?? '')) mensaje = 'La IA aún no está activada en el servidor (falta desplegar la función «gemini»).';
    throw new Error(mensaje ?? 'No se ha podido conectar con la IA. Prueba en un rato.');
  }
  return data;
}

/**
 * Pide preguntas cortas sobre un temario.
 * @param {{texto?:string, rutas?:string[], num:number, dificultad:string}} opciones
 * @returns {Promise<{preguntas:Array<{pregunta:string,respuesta_modelo:string,tema:string}>, uso:{usadas:number,limite:number}}>}
 */
export function generar(opciones) {
  return llamar({ accion: 'generar', ...opciones });
}

/**
 * Corrige las respuestas (nota 0-10 y comentario por pregunta).
 * @param {Array<{pregunta:string,respuesta_modelo:string,respuesta_usuario:string}>} preguntas
 */
export function corregir(preguntas) {
  return llamar({ accion: 'corregir', preguntas });
}
