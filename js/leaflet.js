/* VelozLog — carrega o Leaflet (mapa OpenStreetMap, grátis e sem chave) só quando precisa.
   Usado pela cotação de frete (mapa.js) e pela Gestão de Cargas (gestao.js).
   Uso:  window.VelozLeaflet.carregar().then(() => { const L = window.L; … })  */
(() => {
  "use strict";

  const CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  const JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  let carregando = null;

  function carregar() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (!carregando) {
      carregando = new Promise((ok, erro) => {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = CSS;
        document.head.appendChild(css);
        const js = document.createElement("script");
        js.src = JS;
        js.onload = () => ok(window.L);
        js.onerror = () => {
          carregando = null; // deixa tentar de novo depois
          erro(new Error("não foi possível carregar o Leaflet"));
        };
        document.head.appendChild(js);
      });
    }
    return carregando;
  }

  // mesmo endereço de mapa (tiles) e crédito em todas as telas
  const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const CREDITO =
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  window.VelozLeaflet = Object.freeze({ carregar, TILES, CREDITO });
})();
