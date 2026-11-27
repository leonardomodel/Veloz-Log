/* VelozLog — script comum a TODAS as páginas. Carregue no fim do <body>.
   1. Carrega nav e footer de /partials:  <div data-include="nav"></div>  e  <div data-include="footer"></div>
      Os partials usam a extensão .tpl (e não .html) de propósito: servidores de teste
      como o Live Server injetam um script nos .html e cortam o fim do arquivo —
      era isso que fazia sumir itens do menu do portal.
   2. Rolagem suave para âncoras da própria página (#servicos, #cotacao…)
   3. Transição suave entre páginas (a nova surge por cima da antiga — CSS)
   4. Link para âncora de OUTRA página (ex.: /index.html#servicos vindo do Sobre):
      a nova página abre no topo e rola suavemente até a seção. */
(function () {
  "use strict";

  const html = document.documentElement;
  const reduzMovimento = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // "/" e "/index.html" são a mesma página
  const caminho = (p) => p.replace(/\/index\.html$/, "/");
  const mesmaPagina = (url) =>
    url.origin === location.origin &&
    caminho(url.pathname) === caminho(location.pathname);

  /* =========================================================
     1. PARTIALS (nav e footer)
     Na 1ª página da visita, busca os arquivos. Depois, guarda o HTML na
     sessão e insere NA HORA (antes da página ser desenhada): assim a nova
     página já surge com menu e rodapé, sem "pular" na transição.
     A cada página o arquivo é conferido em segundo plano: se mudou, a página
     já troca para a versão nova (sem precisar abrir outra aba).
     ========================================================= */
  const chavePartial = (nome) => `velozlog:partial:${nome}`;

  // Proteção extra: partials não têm scripts. Se algum servidor de teste
  // injetar um <script> de recarregamento, ele é removido antes de usar.
  const limpar = (texto) =>
    String(texto)
      .replace(/<!--\s*Code injected by[\s\S]*?-->/gi, "")
      .replace(/<script\b[\s\S]*?<\/script>/gi, "");

  function lerCache(nome) {
    try {
      const texto = sessionStorage.getItem(chavePartial(nome));
      return texto === null ? null : limpar(texto);
    } catch {
      return null;
    }
  }

  // o partial está inteiro? (termina fechando a mesma tag com que começa,
  // ex.: <aside …> … </aside>). Evita guardar um arquivo lido pela metade —
  // acontece quando o servidor de testes recarrega no meio de uma gravação.
  function completo(texto) {
    const abre = /^\s*(?:<!--[\s\S]*?-->\s*)*<([a-z][a-z0-9-]*)/i.exec(texto);
    return !!abre && new RegExp(`</${abre[1]}>\\s*$`, "i").test(texto);
  }

  async function buscarPartial(nome) {
    const resposta = await fetch(`/partials/${nome}.tpl`, { cache: "no-cache" });
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);
    const texto = limpar(await resposta.text());
    if (completo(texto)) {
      try {
        sessionStorage.setItem(chavePartial(nome), texto);
      } catch {
        /* sem sessionStorage: só não guarda */
      }
    }
    return texto;
  }

  // troca um elemento (o espaço reservado ou um partial antigo) pelo HTML do partial
  // e devolve o novo elemento, para poder trocá-lo de novo depois
  function colocar(alvo, texto) {
    const molde = document.createElement("template");
    molde.innerHTML = texto.trim();
    const novo = molde.content.firstElementChild;
    alvo.replaceWith(molde.content);
    return novo;
  }

  function inserirPartials() {
    const pendentes = [];
    document.querySelectorAll("[data-include]").forEach((espaco) => {
      const nome = espaco.dataset.include;
      const cache = lerCache(nome);

      if (cache && completo(cache)) {
        const inserido = colocar(espaco, cache); // na hora, sem esperar a rede
        // confere com o servidor: se o arquivo mudou, troca já nesta página
        buscarPartial(nome)
          .then((texto) => {
            if (texto !== cache && completo(texto) && inserido && inserido.isConnected) {
              colocar(inserido, texto);
              marcarAtivos();
            }
          })
          .catch(() => {});
        return;
      }

      pendentes.push(
        buscarPartial(nome)
          .then((texto) => colocar(espaco, texto))
          .catch((erro) =>
            console.error(`Não carregou /partials/${nome}.tpl`, erro),
          ),
      );
    });
    return Promise.all(pendentes);
  }

  // marca como ativo o link da página atual (só links sem #)
  function marcarAtivos() {
    document.querySelectorAll(".menu a, .acoes .btn-area, .pt-menu a").forEach((link) => {
      // "#" (itens "em breve") aponta para a própria página: não conta como ativo
      const href = link.getAttribute("href") || "";
      if (href === "" || href.startsWith("#")) return;
      const url = new URL(link.href, location.origin);
      if (mesmaPagina(url) && !url.hash) {
        link.classList.add("ativo");
        link.setAttribute("aria-current", "page");
      }
    });
  }

  async function carregarPartials() {
    await inserirPartials();
    marcarAtivos();

    // F5 com #rastreamento/#inicio na URL: o navegador pula direto para o card e
    // esconde o menu — corrige para o mesmo ponto do clique na nav (topo)
    if (location.hash && DESTINOS[location.hash]) {
      const y = destinoDe(location.hash);
      if (y !== null) window.scrollTo({ top: y, behavior: "instant" });
    }

    // com o cache, tudo acima acontece antes dos outros scripts da página
    // rodarem; espera o HTML terminar para que todos ouçam o "layout:pronto"
    if (document.readyState === "loading") {
      await new Promise((ok) =>
        document.addEventListener("DOMContentLoaded", ok, { once: true }),
      );
    }

    html.dataset.layoutPronto = ""; // libera o snap (ver style.css)
    document.dispatchEvent(new Event("layout:pronto"));
  }

  /* =========================================================
     2. ROLAGEM SUAVE
     ========================================================= */
  // duração cresce com a raiz da distância: saltos longos não ficam lentos
  // nem "disparam" (≈ 600ms para 1 tela, ≈ 1100ms do topo ao rodapé)
  const duracaoPara = (distancia) =>
    Math.min(1100, Math.max(450, 250 + Math.sqrt(Math.abs(distancia)) * 16));

  // começa e termina devagar, sem arrancada no meio
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // só desconta o menu se ele for fixo/sticky (hoje ele rola junto com a página)
  const alturaTopo = () => {
    const topo = document.querySelector(".topo");
    if (!topo) return 0;
    const pos = getComputedStyle(topo).position;
    return pos === "fixed" || pos === "sticky" ? topo.offsetHeight : 0;
  };

  const posicaoDe = (el) =>
    el.getBoundingClientRect().top + window.scrollY - alturaTopo();

  // âncoras que rolam para um ponto diferente do próprio elemento (home)
  const DESTINOS = {
    "#inicio": () => 0,
    // card de rastreio/simulação: topo da página, com o menu à vista
    "#rastreamento": () => 0,
    "#painel-simular": () => 0, // "Cotação Rápida"
    "#contato": () => document.querySelector(".terceira-tela"),
  };

  // âncoras que só disparam uma ação e NÃO ficam na URL
  // (assim o F5 volta ao estado padrão: card em "Rastrear Pedido")
  const SO_ACAO = ["#painel-simular"];

  function destinoDe(hash) {
    let alvo = null;
    try {
      alvo = document.querySelector(hash);
    } catch {
      return null; // hash que não é seletor válido
    }
    if (!alvo) return null;
    const especial = DESTINOS[hash] && DESTINOS[hash]();
    if (especial === 0) return 0;
    return posicaoDe(especial || alvo);
  }

  let animacao = null;

  function pararAnimacao() {
    cancelAnimationFrame(animacao);
    animacao = null;
  }

  // o snap só volta quando o usuário assume o controle da rolagem
  function devolverControle() {
    if (animacao) pararAnimacao();
    html.classList.remove("rolando");
  }

  function rolarPara(destinoY) {
    pararAnimacao();
    const maximo = html.scrollHeight - window.innerHeight;
    const alvoY = Math.min(Math.max(0, destinoY), maximo);
    const inicioY = window.scrollY;
    const distancia = alvoY - inicioY;

    // desliga o snap ANTES de tudo — mesmo sem precisar rolar: se o conteúdo
    // mudar de altura em seguida (ex.: aba "Simular Frete"), o navegador não
    // "re-imanta" a página em outra seção
    html.classList.add("rolando");
    if (Math.abs(distancia) < 2) return;

    if (reduzMovimento()) {
      window.scrollTo({ top: alvoY, behavior: "instant" });
      return;
    }

    const duracao = duracaoPara(distancia);
    const inicioTempo = performance.now();

    function passo(agora) {
      const progresso = Math.min((agora - inicioTempo) / duracao, 1);
      window.scrollTo({
        top: inicioY + distancia * easeInOutCubic(progresso),
        behavior: "instant",
      });
      animacao = progresso < 1 ? requestAnimationFrame(passo) : null;
      // no final NÃO religa o snap: evita o "puxão"
    }
    animacao = requestAnimationFrame(passo);
  }

  // mouse, toque, teclado ou barra de rolagem: para a animação e religa o snap
  ["wheel", "touchstart", "keydown", "pointerdown"].forEach((evento) =>
    window.addEventListener(evento, devolverControle, { passive: true }),
  );

  /* =========================================================
     3. TRANSIÇÃO ENTRE PÁGINAS
     Feita pelo próprio navegador (View Transitions, ver style.css): a página
     nova surge por cima da antiga, sem tela em branco no meio. Aqui só
     tratamos os links com âncora de outra página.
     ========================================================= */
  const CHAVE_ANCORA = "velozlog:ancora";

  function irPara(endereco) {
    const url = new URL(endereco, location.href);

    // âncora de outra página: abre no topo e rola suave ao chegar
    if (url.hash && url.origin === location.origin) {
      try {
        sessionStorage.setItem(CHAVE_ANCORA, url.hash);
        url.hash = "";
      } catch {
        /* sem sessionStorage: segue com o salto normal do navegador */
      }
    }
    location.href = url.href;
  }

  /* =========================================================
     CLIQUES EM LINKS
     Fica na window (e não no document) para rodar DEPOIS dos outros
     scripts: se algum já tratou o clique (preventDefault), não mexe.
     ========================================================= */
  window.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // nova aba etc.

    const link = e.target.closest("a[href]");
    if (!link || link.hasAttribute("download")) return;
    if (link.target && link.target !== "_self") return;

    const href = link.getAttribute("href");
    if (!href || href === "#") return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return; // WhatsApp, mailto, tel…

    // mesma página: rolagem suave até a âncora
    if (mesmaPagina(url) && url.search === location.search) {
      // link para a própria página sem âncora (logo, "Início"): sobe ao topo
      if (!url.hash) {
        e.preventDefault();
        rolarPara(0);
        if (location.hash) history.pushState(null, "", url.pathname);
        return;
      }
      const y = destinoDe(url.hash);
      if (y === null) return;
      e.preventDefault();
      rolarPara(y);
      if (!SO_ACAO.includes(url.hash)) history.pushState(null, "", url.hash);
      avisarAncora(url.hash);
      return;
    }

    // outra página com âncora: guarda a seção para rolar suave ao chegar.
    // Sem âncora, o navegador segue normalmente (com a transição do CSS).
    if (url.hash) {
      e.preventDefault();
      irPara(url.href);
    }
  });

  /* =========================================================
     4. CHEGADA COM ÂNCORA (vindo de outra página)
     ========================================================= */
  function rolarAncoraPendente() {
    let hash = null;
    try {
      hash = sessionStorage.getItem(CHAVE_ANCORA);
      sessionStorage.removeItem(CHAVE_ANCORA);
    } catch {
      return;
    }
    if (!hash) return;

    // a URL mostra a seção, como antes (menos as âncoras que são só ação)
    if (!SO_ACAO.includes(hash)) history.replaceState(null, "", hash);
    // espera a transição entre páginas terminar antes de rolar e avisar
    setTimeout(() => {
      const y = destinoDe(hash);
      if (y !== null) rolarPara(y);
      avisarAncora(hash);
    }, 400);
  }

  // avisa os outros scripts que o usuário foi levado até uma âncora
  // (ex.: script.js abre a aba "Simular Frete" ao receber #painel-simular)
  function avisarAncora(hash) {
    document.dispatchEvent(new CustomEvent("vl:ancora", { detail: { hash } }));
  }

  /* ---------- início ---------- */
  carregarPartials().then(rolarAncoraPendente);

  window.VelozLayout = { irPara, rolarPara };
})();
