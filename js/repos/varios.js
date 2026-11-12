// Repositorios sencillos de las tablas que no necesitan lógica propia.

import * as db from '../sync/db.js';
import { crearRepo } from './base.js';

export const faltas = crearRepo('faltas');
export const feRegistros = crearRepo('fe_registros');
export const flashcards = crearRepo('flashcards');
export const pomodoro = crearRepo('pomodoro_sesiones');
export const chuletas = crearRepo('chuletas');

/** Todos los vínculos evaluación ↔ RA. */
export const enlacesRA = () => db.todos('evaluacion_ra');
