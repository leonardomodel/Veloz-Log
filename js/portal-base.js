/* VelozLog — base comum das telas do Portal B2B (portal.html, portal-manifestos.html…)
   Menu lateral e topo vêm de /partials (portal-lateral, portal-topo) pelo layout.js.
   Aqui ficam os comportamentos dessas partes, todos por "delegação" no document:
   funcionam mesmo que o menu chegue um instante depois do resto da página.
   • menu da conta (Ir para o site / Sair) · aviso rápido (toast) · módulos "em breve"
   Uso nas telas:  window.VelozPortal.avisar("Título", "Texto") */
(() => {
  "use strict";

  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------- aviso rápido (toast) ---------- */
  const toast = document.createElement("div");
  toast.className = "pt-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.hidden = true;
  document.body.appendChild(toast);
  let timerToast = null;

  function avisar(titulo, texto) {
    toast.innerHTML = `<strong>${esc(titulo)}</strong>${esc(texto)}`;
    toast.hidden = false;
    toast.style.animation = "none";
    void toast.offsetWidth; // reinicia a animação de entrada
    toast.style.animation = "";
    clearTimeout(timerToast);
    timerToast = setTimeout(() => (toast.hidden = true), 3800);
  }

  /* ---------- menu da conta ---------- */
  function abrirMenuConta(abrir) {
    const botao = document.getElementById("pt-conta-botao");
    const menu = document.getElementById("pt-conta-menu");
    if (!botao || !menu) return;
    menu.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
  }

  document.addEventListener("click", (e) => {
    const menu = document.getElementById("pt-conta-menu");

    // abre/fecha pelo botão da conta
    if (e.target.closest("#pt-conta-botao")) {
      abrirMenuConta(menu && menu.hidden);
      return;
    }
    // clique fora fecha
    if (menu && !menu.hidden && !menu.contains(e.target)) abrirMenuConta(false);

    // sair do portal
    if (e.target.closest("#pt-sair")) {
      try {
        sessionStorage.removeItem("velozlog:sessao");
      } catch {
        /* ignora */
      }
      location.href = "/login.html";
      return;
    }

    // módulos ainda em implantação
    const emBreve = e.target.closest("[data-em-breve]");
    if (emBreve) {
      e.preventDefault();
      avisar(
        emBreve.dataset.emBreve,
        "Módulo em implantação. Por enquanto, fale com a Torre Dedicada ABC pelo WhatsApp ou Ramal 9099.",
      );
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") abrirMenuConta(false);
  });

  window.VelozPortal = { avisar, esc };
})();
