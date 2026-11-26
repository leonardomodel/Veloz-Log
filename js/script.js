/* =========================================================
   SCROLL SUAVE (links da nav e do rodapé)
   ========================================================= */
(function () {
  const html = document.documentElement;

  // duração proporcional à distância: entre 600ms e 1400ms
  const duracaoPara = (distancia) =>
    Math.min(1400, Math.max(600, Math.abs(distancia) * 0.9));

  // easing suave: começa e termina devagar
  const easeInOutQuart = (t) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

  // só desconta o menu se ele for fixo/sticky (o seu rola junto com a página)
  const topo = document.querySelector(".topo");
  const alturaTopo = () => {
    if (!topo) return 0;
    const pos = getComputedStyle(topo).position;
    return pos === "fixed" || pos === "sticky" ? topo.offsetHeight : 0;
  };

  // posição (em px) do topo de um elemento, já descontando o menu se for fixo
  const posicaoDe = (el) =>
    el.getBoundingClientRect().top + window.scrollY - alturaTopo();

  // links que rolam para um ponto diferente do próprio elemento
  const DESTINOS = {
    "#inicio": () => 0,
    "#rastreamento": () => posicaoDe(document.querySelector(".hero")),
    "#contato": () => posicaoDe(document.querySelector(".terceira-tela")),
  };

  let animacao = null;

  function pararAnimacao() {
    cancelAnimationFrame(animacao);
  }

  // o snap só volta quando o usuário assume o controle da rolagem
  function devolverControle() {
    pararAnimacao();
    html.classList.remove("rolando");
  }

  function rolarPara(destinoY) {
    pararAnimacao();
    html.classList.add("rolando"); // desliga o snap durante a animação

    const maximo = html.scrollHeight - window.innerHeight;
    const alvoY = Math.min(Math.max(0, destinoY), maximo);

    const inicioY = window.scrollY;
    const distancia = alvoY - inicioY;
    const duracao = duracaoPara(distancia);
    const inicioTempo = performance.now();

    function passo(agora) {
      const progresso = Math.min((agora - inicioTempo) / duracao, 1);
      window.scrollTo({
        top: inicioY + distancia * easeInOutQuart(progresso),
        behavior: "instant",
      });

      if (progresso < 1) {
        animacao = requestAnimationFrame(passo);
      }
      // no final NÃO religa o snap: evita o puxão
    }
    animacao = requestAnimationFrame(passo);
  }

  // mouse, toque, teclado ou barra de rolagem: para a animação e religa o snap
  ["wheel", "touchstart", "keydown", "pointerdown"].forEach((evento) =>
    window.addEventListener(evento, devolverControle, { passive: true }),
  );

  // Cliques em links âncora (#servicos, #cotacao, etc.)
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href*="#"]');
    if (!link) return;

    const url = new URL(link.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;

    const alvo = document.querySelector(url.hash);
    if (!alvo) return;

    e.preventDefault();
    const calcular = DESTINOS[url.hash];
    rolarPara(calcular ? calcular() : posicaoDe(alvo));
    history.pushState(null, "", url.hash);
  });
})();

/* =========================================================
   CONTADORES
   ========================================================= */

(function () {
  function iniciarContadores() {
    const contadores = document.querySelectorAll(".contador");

    contadores.forEach((contador) => {
      const valorFinal = parseFloat(contador.dataset.valor);
      const tipo = contador.dataset.tipo;
      const duracao = 3000;
      const inicio = performance.now();

      function atualizar(tempo) {
        const progresso = Math.min((tempo - inicio) / duracao, 1);
        const suavizacao = 1 - Math.pow(1 - progresso, 3);

        const valor = valorFinal * suavizacao;

        if (tipo === "milhao") {
          contador.textContent = "+" + valor.toFixed(1) + "M";
        }

        if (tipo === "porcentagem") {
          contador.textContent = valor.toFixed(1).replace(".", ",") + "%";
        }

        if (tipo === "milhoes") {
          contador.textContent = "R$ " + Math.floor(valor) + "M+";
        }

        if (progresso < 1) {
          requestAnimationFrame(atualizar);
        }
      }

      requestAnimationFrame(atualizar);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarContadores);
  } else {
    iniciarContadores();
  }
})();

/* =========================================================
   CARD DE RASTREAMENTO / SIMULAR FRETE
   ========================================================= */
(function () {
  // ----- configurações -----
  const EXIGIR_CODIGO = true; // false = rastrear com o campo vazio usa o código de demonstração
  const CODIGO_DEMO = "VLZ-849102-SP";
  const PERCENTUAL = 75;
  const DURACAO_BARRA = 2200; // ms que a barra leva para chegar aos 75%
  const ATRASO_BARRA = 600; // ms de espera (as informações aparecem primeiro)
  const TEMPO_BUSCA = 700; // ms do "Buscando…" antes do resultado

  const card = document.querySelector("#rastreamento");
  if (!card) return;

  const reduzMovimento = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // ----- elementos -----
  const abas = card.querySelector(".abas");
  const botoesAba = [...abas.querySelectorAll('[role="tab"]')];
  const paineis = {
    rastrear: card.querySelector("#painel-rastrear"),
    simular: card.querySelector("#painel-simular"),
  };

  const form = card.querySelector(".rastreio-form");
  const campoBusca = card.querySelector(".campo-busca");
  const campo = card.querySelector("#codigo");
  const botao = card.querySelector(".btn-rastrear");
  const rotuloBotao = botao.querySelector("span");

  const paineisBox = card.querySelector(".paineis");
  const estados = card.querySelector(".estados");
  const vazio = card.querySelector(".estado-vazio");
  const resultado = card.querySelector(".estado-resultado");
  const codigoExibido = card.querySelector("#codigo-exibido");
  const barra = card.querySelector(".barra");
  const preenchimento = card.querySelector(".barra-preenchimento");
  const porcentagem = card.querySelector("#porcentagem");

  // ----- ALTURA DINÂMICA -----
  // anima o container da altura atual até a altura do novo conteúdo
  const DURACAO_ALTURA = 450; // igual ao transition de height no CSS
  const timers = new WeakMap();

  function animarAltura(container, mudar) {
    clearTimeout(timers.get(container));
    if (reduzMovimento) {
      mudar();
      return;
    }

    const antes = container.offsetHeight; // altura atual (mesmo no meio de uma animação)
    container.style.transition = "none";
    container.style.height = antes + "px";
    container.classList.add("animando");

    mudar(); // troca o conteúdo ativo

    container.style.height = "auto";
    const depois = container.offsetHeight; // altura natural do novo conteúdo
    container.style.height = antes + "px";
    void container.offsetHeight; // força o navegador a registrar o ponto de partida

    container.style.transition = "";
    container.style.height = depois + "px";

    timers.set(
      container,
      setTimeout(() => {
        container.style.height = ""; // volta a ser automática
        container.classList.remove("animando");
      }, DURACAO_ALTURA + 50),
    );
  }

  // ----- ABAS -----
  function mostrarAba(nome, animar = true) {
    abas.dataset.ativa = nome;
    const aplicar = () =>
      botoesAba.forEach((b) => {
        const ativa = b.dataset.aba === nome;
        const painel = paineis[b.dataset.aba];
        b.setAttribute("aria-selected", ativa);
        b.tabIndex = ativa ? 0 : -1;
        painel.classList.toggle("ativo", ativa);
        painel.inert = !ativa;
        painel.setAttribute("aria-hidden", !ativa);
      });
    if (animar) animarAltura(paineisBox, aplicar);
    else aplicar();
  }

  botoesAba.forEach((b) =>
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-selected") === "true") return;
      mostrarAba(b.dataset.aba);
    }),
  );

  // setas do teclado alternam entre as abas
  abas.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const atual = botoesAba.findIndex(
      (b) => b.getAttribute("aria-selected") === "true",
    );
    const proxima = botoesAba[(atual + 1) % botoesAba.length];
    mostrarAba(proxima.dataset.aba);
    proxima.focus();
  });

  // ----- BARRA DE PROGRESSO -----
  let quadro = null;
  let atraso = null;

  function aplicarProgresso(valor) {
    const v = Math.round(valor);
    preenchimento.style.width = valor + "%";
    porcentagem.textContent = v + "% do trajeto concluído";
    barra.setAttribute("aria-valuenow", v);
  }

  function zerarBarra() {
    clearTimeout(atraso);
    cancelAnimationFrame(quadro);
    aplicarProgresso(0);
  }

  function iniciarBarra() {
    zerarBarra();
    if (reduzMovimento) {
      aplicarProgresso(PERCENTUAL);
      return;
    }
    atraso = setTimeout(() => {
      const inicio = performance.now();
      const passo = (agora) => {
        const t = Math.min((agora - inicio) / DURACAO_BARRA, 1);
        aplicarProgresso(PERCENTUAL * easeInOutCubic(t));
        if (t < 1) quadro = requestAnimationFrame(passo);
      };
      quadro = requestAnimationFrame(passo);
    }, ATRASO_BARRA);
  }

  // ----- ESTADOS (vazio / resultado) -----
  function mostrarEstado(nome, animar = true) {
    const ehResultado = nome === "resultado";
    const aplicar = () => {
      vazio.classList.toggle("ativo", !ehResultado);
      vazio.inert = ehResultado;
      resultado.classList.toggle("ativo", ehResultado);
      resultado.inert = !ehResultado;
    };
    if (animar) animarAltura(estados, aplicar);
    else aplicar();

    if (ehResultado) iniciarBarra();
    else zerarBarra();
  }

  // ----- BUSCA -----
  let buscando = false;

  function sinalizarErro() {
    campoBusca.classList.remove("erro");
    void campoBusca.offsetWidth; // reinicia a animação
    campoBusca.classList.add("erro");
    campo.setAttribute("aria-invalid", "true");
    campo.focus();
  }

  function buscar(codigo) {
    if (buscando) return;
    buscando = true;
    botao.disabled = true;
    botao.classList.add("carregando");
    rotuloBotao.textContent = "Buscando…";

    setTimeout(() => {
      codigoExibido.textContent = codigo;
      mostrarEstado("resultado");
      botao.disabled = false;
      botao.classList.remove("carregando");
      rotuloBotao.textContent = "Rastrear";
      buscando = false;
    }, TEMPO_BUSCA);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let codigo = campo.value.trim();

    if (!codigo) {
      if (EXIGIR_CODIGO) {
        sinalizarErro();
        return;
      }
      codigo = CODIGO_DEMO;
    }
    buscar(codigo.toUpperCase());
  });

  // apagou o código? volta para a tela de "Acompanhe sua remessa"
  campo.addEventListener("input", () => {
    campoBusca.classList.remove("erro");
    campo.removeAttribute("aria-invalid");
    if (campo.value.trim() === "" && resultado.classList.contains("ativo")) {
      mostrarEstado("vazio");
    }
  });

  // ----- SIMULAR FRETE -----
  card.querySelectorAll('[data-mascara="cep"]').forEach((input) =>
    input.addEventListener("input", () => {
      const d = input.value.replace(/\D/g, "").slice(0, 8);
      input.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
    }),
  );

  card.querySelector(".simular-form").addEventListener("submit", (e) => {
    e.preventDefault(); // por enquanto o botão ainda não calcula nada
  });

  // ----- ESTADO INICIAL -----
  mostrarAba("rastrear", false);
  mostrarEstado("vazio", false);
})();
