// =========================================================
// RASTREIO (rastreio.html)
// A barra e o histórico já animam só com CSS.
// Aqui fica só o "extra": código vindo da URL e porcentagem contando.
// =========================================================
// 0) Nav carregada pelo layout.js: deixa "Rastreamento" ativo nesta página
//    (o layout.js só marca links sem #, e o de Rastreamento tem #rastreamento)
document.addEventListener("layout:pronto", () => {
  document.querySelectorAll(".menu a").forEach((link) => {
    if (link.getAttribute("href").includes("#rastreamento")) {
      link.classList.add("ativo");
      link.setAttribute("aria-current", "page");
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  // 1) Código vindo da URL: rastreio.html?codigo=VLZ-849102-SP
  const params = new URLSearchParams(window.location.search);
  const codigo = (params.get("codigo") || "").trim().toUpperCase();

  if (codigo) {
    document.querySelectorAll('[data-rt="codigo"]').forEach((el) => {
      el.textContent = codigo;
    });
  }

  // 2) Porcentagem contando junto com a barra (mesmo tempo do CSS: 2.2s)
  const numero = document.querySelector('[data-rt="porcentagem"]');
  const barra = document.querySelector(".rt-barra-preenchida");
  if (!numero || !barra) return;

  const alvo = Number(barra.dataset.progresso) || 75;
  const duracao = 2200;
  let inicio = null;
  numero.textContent = 0;

  const contar = (agora) => {
    if (!inicio) inicio = agora;
    const t = Math.min((agora - inicio) / duracao, 1);
    numero.textContent = Math.round(alvo * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(contar);
  };

  setTimeout(() => requestAnimationFrame(contar), 150);
});
