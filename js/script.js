
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
          contador.textContent = "+" + valor.toFixed(1).replace(".", ",") + "M";
        }

        if (tipo === "porcentagem") {
          // número inteiro (100%) sem casa decimal; os demais com vírgula (99,4%)
          contador.textContent =
            (Number.isInteger(valorFinal) ? String(Math.round(valor)) : valor.toFixed(1).replace(".", ",")) + "%";
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
  // formato dos códigos de rastreio: VLZ-{CT-e}-{UF} (ver /js/manifestos.js)
  const CODIGO_DEMO = "VLZ-893910-SP"; // existe em /js/manifestos.js
  const PERCENTUAL_DEMO = 75; // % do código de demonstração
  let percentual = PERCENTUAL_DEMO; // % do pedido exibido no card
  const DURACAO_BARRA = 2200; // ms que a barra leva para chegar ao percentual
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
    porcentagem.textContent = v + "% concluído"; // curto: cabe numa linha até com 100%
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
      aplicarProgresso(percentual);
      return;
    }
    atraso = setTimeout(() => {
      const inicio = performance.now();
      const passo = (agora) => {
        const t = Math.min((agora - inicio) / DURACAO_BARRA, 1);
        aplicarProgresso(percentual * easeInOutCubic(t));
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

  // dados do resultado: os valores do HTML são os do código de demonstração
  const campos = {
    status: card.querySelector("#home-status"),
    origem: card.querySelector("#home-origem"),
    prazo: card.querySelector("#home-prazo"),
    destino: card.querySelector("#home-destino"),
    local: card.querySelector("#home-local"),
  };
  const DEMO = Object.fromEntries(
    Object.entries(campos).map(([k, el]) => [k, el ? el.textContent : ""]),
  );
  const linkDetalhes = card.querySelector("#home-detalhes");
  const linhaPrazo = card.querySelector("#home-prazo-linha");
  const rotuloPrazo = card.querySelector("#home-prazo-rotulo");

  // data e hora da entrega: do comprovante (POD) "19/05/2024 às 14:28:11";
  // sem POD, do texto "Entregue em 19/05, 14:28" com o ano da previsão
  function dataDaEntrega(m) {
    // mesmo formato da página de rastreio: ano com 2 dígitos (ex.: 24/11/26 • 14:28)
    const pod = m.pod && /(\d{2}\/\d{2})\/\d{2}(\d{2}) às (\d{2}:\d{2})/.exec(m.pod.carimbo || "");
    if (pod) return `${pod[1]}/${pod[2]} • ${pod[3]}`;
    const eta = /(\d{2}\/\d{2})\D+(\d{2}:\d{2})/.exec(m.eta || "");
    if (!eta) return m.eta;
    const ano = String((/\d{4}/.exec(m.prev || "") || [new Date().getFullYear()])[0]).slice(2);
    return `${eta[1]}/${ano} • ${eta[2]}`;
  }

  function preencherResultado(codigo) {
    const dados = window.VelozManifestos;
    const m = dados && dados.buscar(codigo);
    let valores = DEMO;
    let exibido = codigo;
    percentual = PERCENTUAL_DEMO;

    // pedido do portal (ex.: VLZ-894012-SP): mostra os dados reais dele
    // ocorrência registrada pelo cliente no portal: mesma etiqueta da página de rastreio
    const comOcorrencia = !!(m && dados.ocorrenciaAberta && dados.ocorrenciaAberta(m.cte)); // só enquanto aberta

    if (m) {
      const sit = dados.situacao(m);
      exibido = dados.codigo(m);
      percentual = sit.progresso;
      valores = {
        status: comOcorrencia ? "Ocorrência registrada" : sit.tag,
        origem: dados.origem(m).nome,
        prazo: m.eta,
        destino: `${m.cidade} (${m.uf})`,
        local: m.local,
      };
    }

    // entregue: no lugar do prazo, só a data e a hora da entrega (ex.: 19/05/2024 • 14:28)
    const entregue = m && m.status === "entregue";
    if (entregue) valores = { ...valores, prazo: dataDaEntrega(m) };

    codigoExibido.textContent = exibido;
    Object.entries(campos).forEach(([k, el]) => el && (el.textContent = valores[k]));

    // entregue: barra verde (style.css)
    preenchimento.classList.toggle("entregue", !!entregue);

    if (linhaPrazo) {
      rotuloPrazo.hidden = entregue;
      linhaPrazo.classList.toggle("entregue", entregue);
      linhaPrazo.title = entregue ? `Entregue em ${valores.prazo}` : `Prazo: ${valores.prazo}`;
    }

    // telemetria longa fica numa linha com "…": o texto inteiro aparece no mouse
    const telemetria = card.querySelector("#home-telemetria");
    if (telemetria) telemetria.title = telemetria.textContent.trim();

    // cor da etiqueta conforme a situação (verde = entregue, vermelho = ocorrência…)
    const etiqueta = campos.status && campos.status.closest(".status");
    if (etiqueta) {
      if (m) etiqueta.dataset.situacao = comOcorrencia ? "ocorrencia" : m.status;
      else delete etiqueta.dataset.situacao; // demonstração: em trânsito (laranja)
    }
    if (linkDetalhes)
      linkDetalhes.href = `/rastreio.html?codigo=${encodeURIComponent(exibido)}`;
  }

  // estado "vazio" reaproveitado para "código não encontrado" (mesmo visual)
  const vazioTitulo = vazio.querySelector("h3");
  const vazioTexto = vazio.querySelector("[data-vazio-texto]") || vazio.querySelector("p");
  const VAZIO_ORIGINAL = { titulo: vazioTitulo.innerHTML, texto: vazioTexto.innerHTML };
  const escHtml = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function avisarNaoEncontrado(codigo) {
    vazioTitulo.textContent = "Código não encontrado";
    vazioTexto.innerHTML = `Não encontramos nenhuma carga com <strong>${escHtml(codigo)}</strong>. Confira o código no seu CT-e ou e-mail de despacho (formato VLZ-000000-UF) e tente de novo.`;
    if (resultado.classList.contains("ativo")) mostrarEstado("vazio");
    sinalizarErro();
  }

  function restaurarVazio() {
    vazioTitulo.innerHTML = VAZIO_ORIGINAL.titulo;
    vazioTexto.innerHTML = VAZIO_ORIGINAL.texto;
  }

  function buscar(codigo) {
    if (buscando) return;
    buscando = true;
    botao.disabled = true;
    botao.classList.add("carregando");
    rotuloBotao.textContent = "Buscando…";

    setTimeout(() => {
      const dados = window.VelozManifestos;
      if (dados && !dados.buscar(codigo)) {
        // código que não existe: avisa, em vez de mostrar dados de exemplo
        avisarNaoEncontrado(codigo);
      } else {
        restaurarVazio();
        preencherResultado(codigo);
        mostrarEstado("resultado");
      }
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
    if (campo.value.trim() === "") {
      restaurarVazio();
      if (resultado.classList.contains("ativo")) mostrarEstado("vazio");
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
  // a página sempre abre (e recarrega no F5) em "Rastrear Pedido"
  const ABA_SIMULAR = "#painel-simular";
  mostrarAba("rastrear", false);
  mostrarEstado("vazio", false);

  // links da nav (aqui ou vindo de outra página) escolhem a aba do card:
  // "Cotação Rápida" → Simular Frete · "Rastreamento" → Rastrear Pedido
  const ABA_POR_ANCORA = {
    [ABA_SIMULAR]: "simular",
    "#rastreamento": "rastrear",
  };
  document.addEventListener("vl:ancora", (e) => {
    const aba = ABA_POR_ANCORA[e.detail.hash];
    if (aba && abas.dataset.ativa !== aba) mostrarAba(aba);
  });
})();
