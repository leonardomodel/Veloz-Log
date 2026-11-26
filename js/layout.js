(async function () {
  const espacos = document.querySelectorAll("[data-include]");

  await Promise.all(
    [...espacos].map(async (espaco) => {
      const nome = espaco.dataset.include;
      try {
        const resposta = await fetch(`/partials/${nome}.html`);
        if (!resposta.ok) throw new Error(resposta.status);
        espaco.outerHTML = await resposta.text(); // troca o espaço pelo conteúdo
      } catch (erro) {
        console.error(`Não carregou /partials/${nome}.html`, erro);
      }
    }),
  );

  // marca como ativo o link da página atual (só links sem #)
  const atual = location.pathname;
  document.querySelectorAll(".menu a").forEach((link) => {
    const url = new URL(link.href, location.origin);
    if (url.pathname === atual && !url.hash) {
      link.classList.add("ativo");
      link.setAttribute("aria-current", "page");
    }
  });

  document.dispatchEvent(new Event("layout:pronto"));
})();

/* Carrega nav e footer de /partials em qualquer página.
   Uso no HTML:  <div data-include="nav"></div>  e  <div data-include="footer"></div> */
(async function () {
  const espacos = document.querySelectorAll("[data-include]");

  await Promise.all(
    [...espacos].map(async (espaco) => {
      const nome = espaco.dataset.include;
      try {
        const resposta = await fetch(`/partials/${nome}.html`);
        if (!resposta.ok) throw new Error("HTTP " + resposta.status);
        espaco.outerHTML = await resposta.text();
      } catch (erro) {
        console.error(`Não carregou /partials/${nome}.html`, erro);
      }
    }),
  );

  // marca como ativo o link da página atual (só links sem #)
  const atual = location.pathname;
  document.querySelectorAll(".menu a").forEach((link) => {
    const url = new URL(link.href, location.origin);
    if (url.pathname === atual && !url.hash) {
      link.classList.add("ativo");
      link.setAttribute("aria-current", "page");
    }
  });

  document.dispatchEvent(new Event("layout:pronto"));
})();
