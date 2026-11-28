/* VelozLog — Sobre Nós (sobre.html)
   Contadores dos números do topo: sobem de 0 até o valor quando o card aparece na tela.
   Uso:  <strong class="sb-contador" data-valor="3.5" data-casas="1" data-prefixo="+" data-sufixo="M">+3.5M</strong>
   O texto já escrito no HTML é o valor final (aparece igual se o JS não rodar). */
(() => {
  "use strict";

  const DURACAO = 3000; // mesma duração dos contadores do index
  const contadores = document.querySelectorAll(".sb-contador");
  if (!contadores.length) return;

  function formatar(el, valor) {
    const casas = Number(el.dataset.casas || 0);
    // inteiros com ponto de milhar (1.200); decimais com ponto (99.4 / 3.5), como no layout
    const numero =
      casas > 0
        ? valor.toFixed(casas).replace(".", ",")
        : Math.round(valor).toLocaleString("pt-BR");
    return (el.dataset.prefixo || "") + numero + (el.dataset.sufixo || "");
  }

  function animar(el) {
    const final = parseFloat(el.dataset.valor);
    const inicio = performance.now();

    function passo(agora) {
      const progresso = Math.min((agora - inicio) / DURACAO, 1);
      const suavizado = 1 - Math.pow(1 - progresso, 3); // desacelera no fim
      el.textContent = formatar(el, final * suavizado);
      if (progresso < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  // quem prefere menos movimento vê os números finais direto
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // zera antes de aparecer, para não "piscar" o valor final
  contadores.forEach((el) => (el.textContent = formatar(el, 0)));

  if (!("IntersectionObserver" in window)) {
    contadores.forEach(animar);
    return;
  }

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        animar(entrada.target);
        observador.unobserve(entrada.target); // anima só uma vez
      });
    },
    { threshold: 0.4 },
  );
  contadores.forEach((el) => observador.observe(el));
})();
