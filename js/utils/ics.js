// Exportar evaluaciones a un archivo .ics (iCalendar) para Google Calendar,
// que así avisa aunque la app esté cerrada (sección 4.3). Puro.

const dos = (n) => String(n).padStart(2, '0');

/** Fecha en UTC con el formato de iCalendar: 20261112T083000Z */
function fechaICS(fecha) {
  const d = new Date(fecha);
  return `${d.getUTCFullYear()}${dos(d.getUTCMonth() + 1)}${dos(d.getUTCDate())}T${dos(d.getUTCHours())}${dos(d.getUTCMinutes())}${dos(d.getUTCSeconds())}Z`;
}

/** Escapa los caracteres especiales de un texto de iCalendar. */
const escapar = (t) => String(t ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Las líneas de más de 75 caracteres se parten y continúan con un espacio. */
function plegar(linea) {
  const trozos = [];
  for (let i = 0; i < linea.length; i += 73) trozos.push(linea.slice(i, i + 73));
  return trozos.join('\r\n ');
}

/**
 * @param {Array<{id,titulo,fecha,notas?,enlace?,tipoTexto?,modulo?:{abreviatura,nombre}}>} evaluaciones
 * @param {{diasAviso?:number, ahora?:Date}} opciones
 * @returns {string} contenido del archivo .ics
 */
export function generarICS(evaluaciones, { diasAviso = 1, ahora = new Date() } = {}) {
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Examenes 2 SMR//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Exámenes 2º SMR'];
  for (const e of evaluaciones) {
    const inicio = new Date(e.fecha);
    const descripcion = [e.modulo?.nombre, e.tipoTexto, e.notas, e.enlace].filter(Boolean).join('\n');
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@examenes-2smr`,
      `DTSTAMP:${fechaICS(ahora)}`,
      `DTSTART:${fechaICS(inicio)}`,
      `DTEND:${fechaICS(new Date(inicio.getTime() + 3_600_000))}`,
      `SUMMARY:${escapar(`${e.modulo?.abreviatura ? `[${e.modulo.abreviatura}] ` : ''}${e.titulo}`)}`,
    );
    if (descripcion) lineas.push(`DESCRIPTION:${escapar(descripcion)}`);
    if (diasAviso > 0) lineas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapar(e.titulo)}`, `TRIGGER:-P${diasAviso}D`, 'END:VALARM');
    lineas.push('END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.map(plegar).join('\r\n') + '\r\n';
}
