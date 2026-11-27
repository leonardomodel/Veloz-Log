// =========================================================
// RASTREIO (rastreio.html)
// A barra e o histórico já animam só com CSS. Aqui:
//  • código vindo da URL: rastreio.html?codigo=CTE-894012
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

  // origem dos manifestos do portal: planta do cliente + hub de Campinas
  const ORIGEM = { nome: "Campinas (HUB SP-01)", sub: "Ind. ABC • Campinas • SP" };

  // por status: etiqueta, % do trajeto e etapa atual (0 coleta · 1 hub · 2 trânsito · 3 entregue)
  const POR_STATUS = {
    coleta: { tag: "Aguardando Coleta", progresso: 8, etapa: 0 },
    hub: { tag: "No Centro de Distribuição", progresso: 38, etapa: 1 },
    transito: { tag: "Em Trânsito", progresso: 65, etapa: 2 },
    entrega: { tag: "Saiu para Entrega", progresso: 90, etapa: 2 },
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const definir = (chave, texto) =>
    $$(`[data-rt="${chave}"]`).forEach((el) => (el.textContent = texto));

  const params = new URLSearchParams(location.search);
  const codigo = (params.get("codigo") || "").trim().toUpperCase();
  const doPortal = params.get("de") === "portal";
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

  // 1) código na página
  if (codigo) definir("codigo", manifesto ? `CTE-${manifesto.cte}` : codigo);

  // 2) vindo do portal: trilha e "voltar" apontam para o portal
  if (doPortal) {
    const t1 = $('[data-rt="trilha-1"]');
    const t2 = $('[data-rt="trilha-2"]');
    t1.textContent = "Portal B2B";
    t1.href = "/portal.html";
    t2.textContent = "Monitoramento";
    t2.href = "/portal.html";
    $('[data-rt="voltar"]').href = "/portal.html";
    definir("voltar-texto", "Voltar ao monitoramento");
  }

  // 3) dados do manifesto
  if (manifesto) preencher(manifesto);

  function preencher(m) {
    const info = POR_STATUS[m.status] || POR_STATUS.transito;
    const destino = `${m.cidade} (${m.uf})`;
    const entregaHoje = m.status === "entrega";

    document.title = `CTE-${m.cte} — ${destino} | VelozLog`;

    // etiqueta de status
    $('[data-rt="status"]').innerHTML = `<i></i> ${esc(info.tag)}`;

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

    // etapas
    const nomesEtapas = [
      m.status === "coleta" ? "Aguardando coleta" : "Coleta realizada",
      "No centro de distribuição",
      entregaHoje ? "Saiu para entrega" : "Em trânsito",
      "Entregue",
    ];
    $('[data-rt="etapas"]').innerHTML = nomesEtapas
      .map((nome, i) => {
        const classe = i < info.etapa ? " rt-feita" : i === info.etapa ? " rt-atual" : "";
        const icone = i < info.etapa ? "✓" : String(i + 1).padStart(2, "0");
        return `<li class="rt-etapa${classe}"><span class="rt-etapa-icone">${icone}</span> ${esc(nome)}</li>`;
      })
      .join("");

    // histórico (mais recentes primeiro)
    $('[data-rt="historico"]').innerHTML = historico(m, destino)
      .map(
        (ev, i) => `
        <li class="rt-evento${i === 0 ? " rt-evento-atual" : ""}">
          <span class="rt-evento-icone">${i === 0 ? String(info.etapa + 1).padStart(2, "0") : "✓"}</span>
          <div class="rt-evento-texto">
            <h3>${esc(ev.titulo)}</h3>
            <span class="rt-evento-local">${esc(ev.local)}</span>
            <p>${esc(ev.texto)}</p>
          </div>
          <span class="rt-evento-status">${i === 0 ? "Agora" : "Concluído"}</span>
        </li>`,
      )
      .join("");

    // informações do transporte
    $('[data-rt="info"]').innerHTML = [
      ["Modal", "Rodoviário"],
      ["Modalidade", m.mod],
      ["Nota fiscal", `NF ${m.nf}`],
      ["Origem", ORIGEM.nome],
      ["Destino", destino],
      ["Proteção da carga", "Seguro incluso"],
    ]
      .map(([dt, dd]) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`)
      .join("");
  }

  function historico(m, destino) {
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

    switch (m.status) {
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
          {
            titulo: "Chegada à base de destino",
            local: destino,
            texto: "Carga conferida e roteirizada para a entrega final.",
          },
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
