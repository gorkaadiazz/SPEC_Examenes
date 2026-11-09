// Tema visual: 'auto' (según el sistema), 'oscuro' o 'claro'.
// De momento se guarda en este dispositivo; en la fase 3 se sincronizará
// también en la tabla `perfiles`.
// Este archivo se carga como script normal en el <head> para aplicar el tema
// antes de pintar nada (sin parpadeo) y expone `window.Tema` para Ajustes.

(function () {
  var CLAVE = 'tema';

  function leer() {
    try {
      return localStorage.getItem(CLAVE) || 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function aplicar(tema) {
    if (tema === 'oscuro' || tema === 'claro') document.documentElement.setAttribute('data-tema', tema);
    else document.documentElement.removeAttribute('data-tema');
  }

  function guardar(tema) {
    try {
      localStorage.setItem(CLAVE, tema);
    } catch (e) {
      /* sin almacenamiento: el tema solo dura esta sesión */
    }
    aplicar(tema);
  }

  aplicar(leer());
  window.Tema = { leer: leer, guardar: guardar };
})();
