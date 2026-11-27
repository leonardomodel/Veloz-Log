// =========================================================
// RASTREIO (rastreio.html)
// A barra e o histórico já animam só com CSS. Aqui:
//  • código vindo da URL: rastreio.html?codigo=VLZ-894012-SP (aceita também CTE-894012)
//  • se o código é de um manifesto do Portal B2B (/js/manifestos.js), a página
//    inteira mostra os dados DESSE pedido: destino, status, previsão, etapas,
//    histórico e informações do transporte
//  • vindo do portal (&de=portal), "voltar" leva de volta ao portal
//  • porcentagem contando junto com a barra
// =========================================================
(() => {
  "use strict";

  const ESTADOS = {
    AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
    DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
    MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
    PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
    RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
    SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
  };

  // origem do pedido (hub de saída) — vem do /js/manifestos.js
  let ORIGEM = null;

  // histórico: mostra até esta quantidade de movimentações; acima disso vira um
  // "carrossel" vertical (altura limitada + rolagem suave). Fica aqui no topo porque
  // é usado já no preenchimento da página (declarado depois dava erro e travava tudo).
  const LIMITE_SEM_ROLAGEM = 4;


  // de onde o cliente veio (botão "voltar" e trilha do topo)
  const VOLTAR = {
    portal: { trilha: "Monitoramento", url: "/portal.html", texto: "Voltar ao monitoramento" },
    gestao: { trilha: "Manifestos & CTEs", url: "/portal-manifestos.html", texto: "Voltar à gestão de cargas" },
    telemetria: { trilha: "Telemetria de Rota", url: "/portal-telemetria.html", texto: "Voltar à telemetria" },
    faturas: { trilha: "Faturas & Canhotos", url: "/portal-faturas.html?aba=edi", texto: "Voltar à conciliação" },
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const definir = (chave, texto) =>
    $$(`[data-rt="${chave}"]`).forEach((el) => (el.textContent = texto));

  const params = new URLSearchParams(location.search);
  const codigo = (params.get("codigo") || "").trim().toUpperCase();
  const veioDe = VOLTAR[params.get("de")] || null;
  const manifesto =
    codigo && window.VelozManifestos ? window.VelozManifestos.buscar(codigo) : null;

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

  // 1) código na página — sempre no formato de rastreio VLZ-{CT-e}-{UF}
  if (codigo)
    definir("codigo", manifesto ? window.VelozManifestos.codigo(manifesto) : codigo);

  // 2) vindo do portal (monitoramento ou gestão): trilha e "voltar" apontam para lá
  if (veioDe) {
    const t1 = $('[data-rt="trilha-1"]');
    const t2 = $('[data-rt="trilha-2"]');
    t1.textContent = "Portal B2B";
    t1.href = "/portal.html";
    t2.textContent = veioDe.trilha;
    t2.href = veioDe.url;
    $('[data-rt="voltar"]').href = veioDe.url;
    definir("voltar-texto", veioDe.texto);
  }

  // 3) dados do manifesto
  if (manifesto) preencher(manifesto);

  function preencher(m) {
    const info = window.VelozManifestos.situacao(m); // etiqueta, % e etapa
    const destino = `${m.cidade} (${m.uf})`;
    const entregaHoje = m.status === "entrega";
    ORIGEM = window.VelozManifestos.origem(m);

    document.title = `${window.VelozManifestos.codigo(m)} — ${destino} | VelozLog`;

    // etiqueta de status
    const etiqueta = $('[data-rt="status"]');
    etiqueta.innerHTML = `<i></i> ${esc(info.tag)}`;
    etiqueta.dataset.situacao = m.status; // cor: verde entregue, vermelho ocorrência… (rastreio.css)

    // rota e previsão
    definir("origem", ORIGEM.nome);
    definir("origem-sub", ORIGEM.sub);
    definir("destino", destino);
    definir("destino-sub", ESTADOS[m.uf] || m.uf);
    definir("previsao", m.eta);
    definir("previsao-nota", m.obs);
    definir("local", m.local);

    // barra de progresso
    const barra = $(".rt-barra-preenchida");
    barra.dataset.progresso = info.progresso;
    barra.style.width = info.progresso + "%";

    // etapas — a etapa atual acompanha a etiqueta do topo; as já passadas ganham ✓
    const ocorrencia = m.status === "ocorrencia";
    // triângulo desenhado centralizado (do 2,5 ao 20,5 na altura) para assentar no meio do círculo
    const ALERTA =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 3.6a1.6 1.6 0 0 1 2.8 0l8 14.2a1.6 1.6 0 0 1-1.4 2.4H4a1.6 1.6 0 0 1-1.4-2.4z" /><path d="M12 9v4.4M12 16.6h0" /></svg>';
    const nomesEtapas = [
      m.status === "coleta" ? "Aguardando coleta" : "Coleta realizada",
      "No centro de distribuição",
      ocorrencia ? "Ocorrência na entrega" : entregaHoje ? "Saiu para entrega" : "Em trânsito",
      "Entregue",
    ];
    // ícone da etapa: ✓ nas já alcançadas (inclusive a atual) · alerta se a atual for ocorrência
    // · número só nas que ainda vão acontecer
    const iconeEtapa = (i) =>
      i < info.etapa ? "✓" : i === info.etapa ? (ocorrencia ? ALERTA : "✓") : String(i + 1).padStart(2, "0");

    $('[data-rt="etapas"]').innerHTML = nomesEtapas
      .map((nome, i) => {
        let classe = i < info.etapa ? " rt-feita" : i === info.etapa ? " rt-atual" : "";
        if (i === info.etapa && ocorrencia) classe += " rt-ocorrencia";
        return `<li class="rt-etapa${classe}"><span class="rt-etapa-icone">${iconeEtapa(i)}</span> ${esc(nome)}</li>`;
      })
      .join("");

    // histórico (mais recentes primeiro) — o evento atual usa o mesmo ícone da etapa atual;
    // ocorrências anteriores (tipo "ocorrencia") ganham o ícone de alerta
    const eventos = historico(m, destino);
    const listaHistorico = $('[data-rt="historico"]');
    listaHistorico.innerHTML = eventos
      .map((ev, i) => {
        const atual = i === 0;
        const alertaAntigo = !atual && ev.tipo === "ocorrencia";
        const classes = [
          "rt-evento",
          atual && "rt-evento-atual",
          atual && ocorrencia && "rt-evento-ocorrencia",
          alertaAntigo && "rt-evento-alerta",
        ]
          .filter(Boolean)
          .join(" ");
        const icone = atual && info.etapa < 4 ? iconeEtapa(info.etapa) : alertaAntigo ? ALERTA : "✓";
        const status = atual ? (info.etapa === 4 ? "Finalizado" : "Agora") : ev.quando || "Concluído";
        return `
        <li class="${classes}">
          <span class="rt-evento-icone">${icone}</span>
          <div class="rt-evento-texto">
            <h3>${esc(ev.titulo)}</h3>
            <span class="rt-evento-local">${esc(ev.local)}</span>
            <p>${esc(ev.texto)}</p>
          </div>
          <span class="rt-evento-status">${esc(status)}</span>
        </li>`;
      })
      .join("");

    // muitas movimentações: a lista vira um "carrossel" vertical com rolagem suave
    const selo = $(".rt-historico-topo .rt-selo-cinza");
    if (selo) selo.textContent = `Mais recentes primeiro • ${eventos.length}`;
    if (eventos.length > LIMITE_SEM_ROLAGEM) ativarRolagem(listaHistorico);

    // informações do transporte
    $('[data-rt="info"]').innerHTML = [
      ["Modal", "Rodoviário"],
      ["Modalidade", m.mod],
      ["CT-e", `CTE-${m.cte}`],
      ["Nota fiscal", `NF ${m.nf}`],
      ["Origem", ORIGEM.nome],
      ["Destino", destino],
      ["Proteção da carga", "Seguro incluso"],
    ]
      .map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`)
      .join("");
  }

  /* ---------- histórico longo: rolagem suave dentro do card ----------
     A roda do mouse move a lista com desaceleração (em vez dos "saltos" padrão).
     Nas pontas da lista a rolagem volta para a página normalmente. */

  function ativarRolagem(lista) {
    lista.classList.add("rt-rolavel");
    lista.tabIndex = 0; // teclado (setas / Page Down) também rola
    lista.setAttribute("aria-label", "Histórico de movimentações (role para ver todas)");

    // altura = as primeiras LIMITE movimentações + metade da seguinte
    // (o item "cortado" mostra que há mais para rolar)
    const limitarAltura = () => {
      const corte = lista.children[LIMITE_SEM_ROLAGEM];
      if (!corte) return;
      lista.style.maxHeight = `${Math.round(corte.offsetTop + corte.offsetHeight * 0.5)}px`;
    };
    limitarAltura();
    let timerAltura = null;
    window.addEventListener("resize", () => {
      clearTimeout(timerAltura);
      timerAltura = setTimeout(limitarAltura, 150);
    });

    // esmaecimento em cima/embaixo só quando há mais itens naquela direção
    const sombras = () => {
      const max = lista.scrollHeight - lista.clientHeight;
      lista.classList.toggle("tem-acima", lista.scrollTop > 4);
      lista.classList.toggle("tem-abaixo", lista.scrollTop < max - 4);
    };
    lista.addEventListener("scroll", sombras, { passive: true });
    sombras();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let alvo = lista.scrollTop;
    let quadro = null;

    const passo = () => {
      const falta = alvo - lista.scrollTop;
      if (Math.abs(falta) < 0.5) {
        lista.scrollTop = alvo;
        quadro = null;
        return;
      }
      lista.scrollTop += falta * 0.16; // desacelera até parar
      quadro = requestAnimationFrame(passo);
    };

    lista.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) return; // zoom do navegador
        const max = lista.scrollHeight - lista.clientHeight;
        const unidade = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? lista.clientHeight : 1;
        const base = quadro ? alvo : lista.scrollTop;
        const novo = Math.max(0, Math.min(max, base + e.deltaY * unidade));
        if (novo === base) return; // já está na ponta: deixa a página rolar
        e.preventDefault();
        alvo = novo;
        if (!quadro) quadro = requestAnimationFrame(passo);
      },
      { passive: false },
    );

    // arrastou a barra ou usou o teclado: o próximo giro da roda parte daí
    lista.addEventListener("scroll", () => {
      if (!quadro) alvo = lista.scrollTop;
    }, { passive: true });
  }

  function historico(m, destino) {
    // pedido com histórico próprio (ex.: VLZ-0089377-SP): usa como está
    if (Array.isArray(m.eventos) && m.eventos.length) return m.eventos;

    const coleta = {
      titulo: "Coleta realizada",
      local: ORIGEM.sub,
      texto: `Mercadoria da NF ${m.nf} coletada e integrada à operação.`,
    };
    const noHub = {
      titulo: "Carga recebida no hub",
      local: ORIGEM.nome,
      texto: "Conferência de peso e cubagem finalizada no centro de distribuição.",
    };
    const saidaHub = {
      titulo: "Saída do centro de distribuição",
      local: ORIGEM.nome,
      texto: `Carga liberada para transferência rodoviária (${m.mod}).`,
    };

    const chegadaBase = {
      titulo: "Chegada à base de destino",
      local: destino,
      texto: "Carga conferida e roteirizada para a entrega final.",
    };

    switch (m.status) {
      case "entregue":
        return [
          {
            titulo: "Entrega realizada",
            local: m.pod ? m.pod.local : `${m.local} (${m.uf})`,
            texto: m.pod
              ? `Recebido por ${m.pod.recebedor} em ${m.pod.carimbo}. Comprovante digital (POD) autenticado.`
              : "Entrega confirmada pelo destinatário.",
          },
          chegadaBase,
          saidaHub,
          noHub,
          coleta,
        ];
      case "ocorrencia":
        return [
          {
            titulo: `Ocorrência: ${m.rotulo}`,
            local: `${m.local} (${m.uf})`,
            texto: `${m.obs}. ${m.prev} — ${m.prevNota.toLowerCase()}.`,
          },
          chegadaBase,
          saidaHub,
          noHub,
          coleta,
        ];
      case "coleta":
        return [
          {
            titulo: "Aguardando coleta",
            local: m.local,
            texto: `Coleta agendada — ${m.obs}.`,
          },
          {
            titulo: "Pedido registrado",
            local: "Portal B2B • Ind. ABC",
            texto: `Manifesto CTE-${m.cte} emitido para ${destino}.`,
          },
        ];
      case "hub":
        return [
          {
            titulo: m.rotulo,
            local: m.local,
            texto: `Carga em cross-docking, seguindo para ${destino}.`,
          },
          noHub,
          coleta,
        ];
      case "entrega":
        return [
          {
            titulo: "Saiu para entrega",
            local: `${m.local} (${m.uf})`,
            texto: `${m.obs}. Previsão: ${m.eta.toLowerCase()}.`,
          },
          chegadaBase,
          saidaHub,
          noHub,
          coleta,
        ];
      default: // transito
        return [
          {
            titulo: "Carga em trânsito",
            local: `${m.local} • A caminho de ${destino}`,
            texto: `${m.obs}. Sua carga segue viagem para o destino.`,
          },
          saidaHub,
          noHub,
          coleta,
        ];
    }
  }

  // 4) porcentagem contando junto com a barra (mesmo tempo do CSS: 2.2s)
  const numero = $('[data-rt="porcentagem"]');
  const barra = $(".rt-barra-preenchida");
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
})();
