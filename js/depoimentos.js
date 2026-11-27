/* VelozLog — carrossel de depoimentos (index.html, seção "Confiança comprovada")
   • Gira sozinho e em loop infinito: os cards que saem pela esquerda voltam pelo fim da fila
   • Arraste com o mouse ou o dedo para passar para frente ou para trás
   • Pausa ao passar o mouse, ao arrastar, fora da tela e com a aba em segundo plano
     (ao voltar, continua de onde parou — não recomeça a contagem)
   • Setas ← → do teclado quando o carrossel está em foco
   • Quem prefere menos movimento: sem rotação automática (o arraste continua)
   Sem JavaScript, os cards ficam numa faixa com rolagem horizontal. */
(() => {
  "use strict";

  const INTERVALO = 6000; // ms que cada posição fica parada
  const DURACAO = 750; // ms do deslize entre cards
  const CURVA = "cubic-bezier(0.65, 0, 0.35, 1)";
  const ARRASTE_MINIMO = 60; // px de arraste para trocar de card

  const carrossel = document.querySelector(".depoimentos-carrossel");
  if (!carrossel) return;

  const janela = carrossel.querySelector(".depoimentos-janela");
  const trilho = carrossel.querySelector(".depoimentos-trilho");
  const cards = [...trilho.children];
  const total = cards.length;
  if (total < 2) return;

  const automatico = !window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;

  carrossel.classList.add("ativo"); // CSS troca a faixa com rolagem pelo carrossel
  carrossel.tabIndex = 0; // permite usar as setas do teclado
  cards.forEach((card, i) => {
    card.setAttribute("aria-roledescription", "depoimento");
    card.setAttribute("aria-label", `${i + 1} de ${total}`);
  });

  /* ---------- medidas ---------- */
  const gap = () => parseFloat(getComputedStyle(trilho).columnGap) || 0;
  const passo = () => trilho.firstElementChild.offsetWidth + gap();
  const visiveis = () =>
    Math.max(1, Math.round((janela.clientWidth + gap()) / passo()));

  function mover(x, animar) {
    trilho.style.transition = animar ? `transform ${DURACAO}ms ${CURVA}` : "none";
    trilho.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  // leitores de tela só "veem" os cards que estão à mostra
  function marcarVisiveis() {
    const n = visiveis();
    [...trilho.children].forEach((card, pos) =>
      card.setAttribute("aria-hidden", pos >= n ? "true" : "false"),
    );
  }

  /* ---------- movimento (loop infinito) ---------- */
  let ocupado = false; // durante o deslize, ignora novos comandos

  function concluir() {
    ocupado = false;
    marcarVisiveis();
    relogio.reiniciar();
  }

  function avancar(deslocamento = 0) {
    if (ocupado) return;
    ocupado = true;
    mover(deslocamento, false);
    void trilho.offsetWidth; // registra o ponto de partida
    mover(-passo(), true);
    setTimeout(() => {
      trilho.appendChild(trilho.firstElementChild); // o que saiu vai para o fim
      mover(0, false);
      concluir();
    }, DURACAO);
  }

  function voltar(deslocamento = 0) {
    if (ocupado) return;
    ocupado = true;
    // traz o último para o começo e parte "deslocado", sem animação
    trilho.insertBefore(trilho.lastElementChild, trilho.firstElementChild);
    mover(-passo() + deslocamento, false);
    void trilho.offsetWidth;
    mover(0, true);
    setTimeout(concluir, DURACAO);
  }

  carrossel.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") avancar();
    else if (e.key === "ArrowLeft") voltar();
  });

  /* ---------- relógio da rotação automática (pausa e continua) ---------- */
  const relogio = (() => {
    let timer = null;
    let restante = INTERVALO;
    let inicio = 0;
    const motivos = new Set();

    function parar() {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      restante -= performance.now() - inicio;
    }
    function rodar() {
      if (!automatico || timer || motivos.size) return;
      inicio = performance.now();
      timer = setTimeout(() => {
        timer = null;
        avancar();
      }, Math.max(0, restante));
    }
    return {
      reiniciar() {
        parar();
        restante = INTERVALO;
        rodar();
      },
      pausar(motivo, sim) {
        if (sim) motivos.add(motivo);
        else motivos.delete(motivo);
        if (motivos.size) parar();
        else rodar();
      },
    };
  })();

  carrossel.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") relogio.pausar("mouse", true);
  });
  carrossel.addEventListener("pointerleave", () =>
    relogio.pausar("mouse", false),
  );
  // só pausa com foco vindo do teclado (Tab); clique do mouse não conta
  carrossel.addEventListener("focusin", () => {
    if (carrossel.matches(":focus-visible")) relogio.pausar("foco", true);
  });
  carrossel.addEventListener("focusout", () => relogio.pausar("foco", false));
  document.addEventListener("visibilitychange", () =>
    relogio.pausar("aba", document.hidden),
  );
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entrada]) => relogio.pausar("fora-da-tela", !entrada.isIntersecting),
      { threshold: 0.3 },
    ).observe(carrossel);
  }

  /* ---------- arrastar (mouse ou dedo) ---------- */
  let inicioX = null;
  let dx = 0;

  janela.addEventListener("pointerdown", (e) => {
    if (ocupado || (e.pointerType === "mouse" && e.button !== 0)) return;
    inicioX = e.clientX;
    dx = 0;
    janela.setPointerCapture(e.pointerId);
    relogio.pausar("arraste", true);
  });

  janela.addEventListener("pointermove", (e) => {
    if (inicioX === null) return;
    dx = e.clientX - inicioX;
    mover(dx * 0.85, false); // leve "resistência": acompanha o gesto um pouco mais devagar
    if (Math.abs(dx) > 5) carrossel.classList.add("arrastando");
  });

  function soltar() {
    if (inicioX === null) return;
    const deslocamento = dx * 0.85;
    inicioX = null;
    carrossel.classList.remove("arrastando");
    relogio.pausar("arraste", false);
    if (dx <= -ARRASTE_MINIMO) avancar(deslocamento);
    else if (dx >= ARRASTE_MINIMO) voltar(deslocamento);
    else mover(0, true); // arraste curto: volta para o lugar
  }
  janela.addEventListener("pointerup", soltar);
  janela.addEventListener("pointercancel", soltar);

  /* ---------- início ---------- */
  marcarVisiveis();
  relogio.reiniciar();
})();
