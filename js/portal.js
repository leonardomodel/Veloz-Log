/* VelozLog — Portal B2B (portal.html), tela após o login.
   Dados de DEMONSTRAÇÃO (ainda não há API): manifestos, indicadores e avisos.
   • Tabela "Monitoramento em Tempo Real": busca por CT-e, NF-e ou cidade + paginação
   • Botão de sincronizar (SEFAZ & Siga-Route) e "Há X min" atualizando sozinho
   • Contadores dos indicadores. Menu da conta, avisos e "em breve": /js/portal-base.js */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const POR_PAGINA = 5;

  /* ---------- manifestos (demonstração) ----------
     A lista fica em /js/manifestos.js: a mesma que a página de rastreio usa */
  // remessas ativas = em rota ou com ocorrência (mesma base e mesma conta do indicador
  // "Cargas em trânsito"; coletas ainda não saíram e ficam no indicador de coletas)
  const DADOS = window.VelozManifestos;
  const MANIFESTOS = DADOS
    ? DADOS.todos
        .map(DADOS.efetivo) // situação atual (ocorrências tratadas aplicadas)
        .filter((m) => ["transito", "ocorrencia"].includes(DADOS.grupo(m)))
    : [];

  /* ---------- indicadores: contados da mesma lista ---------- */
  if (DADOS) {
    const t = DADOS.totais;
    const novas = DADOS.coletasSolicitadas().length; // agendadas pelo cliente nesta conta
    const definirKpi = (sel, valor) => {
      const el = document.querySelector(sel);
      if (el) {
        el.dataset.valor = valor;
        el.textContent = String(valor).padStart(Number(el.dataset.digitos || 0), "0");
      }
    };
    definirKpi("#pt-kpi-transito", t.emRota + t.ocorrencias);
    definirKpi("#pt-kpi-coletas", t.coletas + novas);
    definirKpi("#pt-kpi-entregas", t.entregas);
    const texto = (sel, valor) => {
      const el = document.querySelector(sel);
      if (el) el.textContent = valor;
    };
    texto("#pt-kpi-transito-pe", `${t.emRota} em rota no prazo`);
    texto("#pt-kpi-ocorrencias", `${t.ocorrencias} com ocorrência`);
    texto("#pt-kpi-pod", t.pctPod);
  }

  const ICONE_STATUS = {
    entrega:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h12v10H2z" /><path d="M14 9h4l3 3.5V16h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>',
    transito:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22v-8M12 14L6 4M12 14l6-10" /><path d="M6 4h0M18 4h0" /></svg>',
    hub: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="3.5" r="1.8" /><circle cx="12" cy="20.5" r="1.8" /><circle cx="3.5" cy="12" r="1.8" /><circle cx="20.5" cy="12" r="1.8" /><path d="M12 5.3v4.2M12 14.5v4.2M5.3 12h4.2M14.5 12h4.2" /></svg>',
    coleta:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>',
    ocorrencia:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h0" /></svg>',
  };
  const ICONE_ALVO =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>';

  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const norm = (t) =>
    String(t)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // tira os acentos: "florianopolis" acha "Florianópolis"
      .toLowerCase();

  /* ---------- tabela + busca + paginação ---------- */
  const corpo = $("#pt-linhas");
  const busca = $("#pt-busca");
  let pagina = 1;
  let lista = MANIFESTOS;

  const codigoDe = (m) => window.VelozManifestos.codigo(m); // VLZ-{CT-e}-{UF}

  function linha(m) {
    const codigo = codigoDe(m);
    return `<tr class="pt-entrando">
      <td class="pt-cte"><strong>${codigo}</strong><small>CT-e ${esc(m.cte)} • NF ${esc(m.nf)}</small></td>
      <td class="pt-destino"><strong>${esc(m.cidade)} / ${esc(m.uf)}</strong><small>De: ${esc(DADOS.origem(m).nome)}</small></td>
      <td><span class="pt-modalidade">${esc(m.mod)}</span></td>
      <td><span class="pt-status pt-status-${m.status}">${ICONE_STATUS[m.status]}${esc(m.rotulo)}</span></td>
      <td class="pt-eta${m.hoje ? " hoje" : ""}"><strong>${esc(m.eta)}</strong><small>${esc(m.obs)}</small></td>
      <td><a class="pt-rastrear" href="/rastreio.html?codigo=${codigo}&de=portal" aria-label="Rastrear ${codigo}" title="Rastrear ${codigo}">${ICONE_ALVO}</a></td>
    </tr>`;
  }

  function render() {
    const total = lista.length;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    pagina = Math.min(pagina, paginas);
    const inicio = (pagina - 1) * POR_PAGINA;
    const itens = lista.slice(inicio, inicio + POR_PAGINA);

    corpo.innerHTML = itens.length
      ? itens.map(linha).join("")
      : `<tr class="pt-vazio"><td colspan="6">${
          busca.value.trim()
            ? `Nenhum manifesto encontrado para “${esc(busca.value.trim())}”${lista !== MANIFESTOS && filtrosAtivos() ? " com esses filtros" : ""}.`
            : "Nenhuma remessa com esses filtros. Use “Limpar” no painel de filtros para ver todas."
        }</td></tr>`;

    $("#pt-contagem").textContent = `${total} ${total === 1 ? "remessa" : "remessas"}`;
    $("#pt-mostrando").textContent =
      busca.value.trim() || filtrosAtivos()
        ? `Mostrando ${itens.length} de ${total} resultado${total === 1 ? "" : "s"} (de ${MANIFESTOS.length} remessas ativas)`
        : `Mostrando ${itens.length} de ${total} remessas ativas`;

    $("#pt-paginas").innerHTML = Array.from({ length: paginas }, (_, i) => {
      const n = i + 1;
      return `<button type="button" data-pagina="${n}"${n === pagina ? ' aria-current="page"' : ""} aria-label="Página ${n}">${n}</button>`;
    }).join("");
    $("#pt-anterior").disabled = pagina === 1;
    $("#pt-proximo").disabled = pagina === paginas;
  }

  /* ---------- filtros (painel do botão ao lado da busca) ----------
     Situação e modalidade: marque uma ou mais opções (nenhuma = todas).
     Os filtros se somam à busca por texto. */
  const SITUACOES_FILTRO = [
    { id: "transito", rotulo: "Em trânsito", ok: (m) => m.status === "transito" && !m.emTratamento },
    { id: "entrega", rotulo: "Saiu para entrega", ok: (m) => m.status === "entrega" && !m.emTratamento },
    { id: "hub", rotulo: "No centro de distribuição", ok: (m) => m.status === "hub" && !m.emTratamento },
    { id: "ocorrencia", rotulo: "Ocorrência", ok: (m) => m.status === "ocorrencia" || !!(DADOS.ocorrenciaAberta && DADOS.ocorrenciaAberta(m.cte)) },
    { id: "tentativa", rotulo: "Nova tentativa", ok: (m) => !!m.emTratamento },
  ];
  const filtros = { situacao: new Set(), modalidade: new Set(), uf: "", hoje: false };
  function filtrosAtivos() {
    return filtros.situacao.size + filtros.modalidade.size + (filtros.uf ? 1 : 0) + (filtros.hoje ? 1 : 0);
  }

  const painel = $("#pt-filtros");
  const botaoFiltro = $("#pt-filtro-botao");

  // opções montadas a partir dos próprios dados
  const chip = (grupo, valor, rotulo) =>
    `<label class="pt-filtros-chip"><input type="checkbox" data-grupo="${grupo}" value="${esc(valor)}"><span>${esc(rotulo)}</span></label>`;
  $("#pt-filtro-situacao").innerHTML = SITUACOES_FILTRO.map((s) => chip("situacao", s.id, s.rotulo)).join("");
  const modalidades = [...new Set(MANIFESTOS.map((m) => m.mod))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  $("#pt-filtro-modalidade").innerHTML = modalidades.map((mod) => chip("modalidade", mod, mod)).join("");
  const ufs = [...new Set(MANIFESTOS.map((m) => m.uf))].sort();
  $("#pt-filtro-uf").insertAdjacentHTML("beforeend", ufs.map((uf) => `<option value="${uf}">${uf}</option>`).join(""));

  function passaNosFiltros(m) {
    if (filtros.situacao.size && !SITUACOES_FILTRO.some((s) => filtros.situacao.has(s.id) && s.ok(m))) return false;
    if (filtros.modalidade.size && !filtros.modalidade.has(m.mod)) return false;
    if (filtros.uf && m.uf !== filtros.uf) return false;
    if (filtros.hoje && !m.hoje && !/^hoje/i.test(m.eta || "")) return false;
    return true;
  }

  function aplicar() {
    const termo = norm(busca.value.trim());
    lista = MANIFESTOS.filter(
      (m) =>
        passaNosFiltros(m) &&
        (!termo ||
          norm(`${codigoDe(m)} cte-${m.cte} ${m.cte} ${m.nf} ${String(m.nf).replace(".", "")} ${m.cidade} ${m.uf}`).includes(termo)),
    );
    // quantos filtros estão ativos (no botão) e quantas remessas sobram (no painel)
    const ativos = filtros.situacao.size + filtros.modalidade.size + (filtros.uf ? 1 : 0) + (filtros.hoje ? 1 : 0);
    const num = $("#pt-filtro-num");
    num.hidden = !ativos;
    num.textContent = ativos;
    botaoFiltro.classList.toggle("ativo", ativos > 0);
    botaoFiltro.setAttribute("aria-label", ativos ? `Filtros (${ativos} ativos)` : "Filtros");
    $("#pt-filtros-resultado").textContent = `${lista.length} ${lista.length === 1 ? "remessa" : "remessas"}`;
    pagina = 1;
    render();
  }

  painel.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.grupo) {
      const grupo = filtros[t.dataset.grupo];
      if (t.checked) grupo.add(t.value);
      else grupo.delete(t.value);
    } else if (t.id === "pt-filtro-uf") filtros.uf = t.value;
    else if (t.id === "pt-filtro-hoje") filtros.hoje = t.checked;
    aplicar();
  });

  $("#pt-filtros-limpar").addEventListener("click", () => {
    filtros.situacao.clear();
    filtros.modalidade.clear();
    filtros.uf = "";
    filtros.hoje = false;
    painel.querySelectorAll("input[type=checkbox]").forEach((c) => (c.checked = false));
    $("#pt-filtro-uf").value = "";
    aplicar();
  });

  // abrir / fechar o painel
  function abrirPainel(abrir) {
    painel.hidden = !abrir;
    botaoFiltro.setAttribute("aria-expanded", String(abrir));
    if (abrir) {
      const primeiro = painel.querySelector("input");
      if (primeiro) primeiro.focus();
    }
  }
  botaoFiltro.addEventListener("click", () => abrirPainel(painel.hidden));
  $("#pt-filtros-ok").addEventListener("click", () => {
    abrirPainel(false);
    botaoFiltro.focus();
  });
  document.addEventListener("click", (e) => {
    if (!painel.hidden && !e.target.closest(".pt-filtros-caixa")) abrirPainel(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !painel.hidden) {
      abrirPainel(false);
      botaoFiltro.focus();
    }
  });

  busca.addEventListener("input", aplicar);

  $("#pt-paginas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pagina]");
    if (!b) return;
    pagina = Number(b.dataset.pagina);
    render();
  });
  $("#pt-anterior").addEventListener("click", () => {
    pagina--;
    render();
  });
  $("#pt-proximo").addEventListener("click", () => {
    pagina++;
    render();
  });

  render();

  /* ---------- sincronização SEFAZ & Siga-Route ---------- */
  const horaSync = $("#pt-sync-hora");
  const haSync = $("#pt-sync-ha");
  const botaoSync = $("#pt-sync-botao");
  let ultimaSync = Date.now() - 2 * 60 * 1000; // "há 2 min" ao abrir

  const relogio = (d) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function atualizarHa() {
    const min = Math.floor((Date.now() - ultimaSync) / 60000);
    haSync.textContent = min < 1 ? "(Agora)" : `(Há ${min} min)`;
  }

  horaSync.textContent = relogio(new Date(ultimaSync));
  atualizarHa();
  setInterval(atualizarHa, 30000);

  botaoSync.addEventListener("click", () => {
    if (botaoSync.classList.contains("girando")) return;
    botaoSync.classList.add("girando");
    haSync.textContent = "(Sincronizando…)";
    setTimeout(() => {
      ultimaSync = Date.now();
      horaSync.textContent = relogio(new Date(ultimaSync));
      atualizarHa();
      botaoSync.classList.remove("girando");
      window.VelozPortal.avisar("Sincronização concluída", "SEFAZ e Siga-Route atualizados com sucesso.");
    }, 1400);
  });

  /* ---------- datas e protocolos sempre do ano atual ---------- */
  const ANO = new Date().getFullYear();
  document.querySelectorAll("[data-ano-tabela]").forEach((el) => (el.textContent = `SP-SUL-${ANO}`));
  document.querySelectorAll("[data-ano-vencimento]").forEach((el) => (el.textContent = `28/11/${ANO}`));
  document.querySelectorAll("[data-protocolo-aviso]").forEach((el) => (el.textContent = `COL-${ANO}-8841`));
  // "Acompanhar Coleta": abre o rastreio da coleta (o protocolo COL-… é rastreável)
  document.querySelectorAll('a[href="/portal-coleta.html#cl-historico"]').forEach((a) => {
    a.href = `/rastreio.html?codigo=COL-${ANO}-8841&de=portal`;
  });

  /* ---------- autorizar a entrada do motorista na doca da planta ---------- */
  const botaoDoca = $("#pt-autorizar-doca");
  if (botaoDoca)
    botaoDoca.addEventListener("click", () => {
      botaoDoca.disabled = true;
      botaoDoca.textContent = "Doca Autorizada";
      window.VelozPortal.avisar(
        "Doca autorizada",
        "A portaria da Planta Vinhedo foi avisada e o motorista Edson Carvalho (PL-9921) pode encostar na doca.",
      );
    });

  /* ---------- CARROSSEL DE CORREDORES (Leaflet + OpenStreetMap, o mesmo da cotação) ----------
     Cada corredor mostra a rota, as carretas na ÚLTIMA POSIÇÃO GPS (ícone de caminhão),
     o posto/terminal e os dados do corredor. Corredores e frota: /js/manifestos.js
     (a Telemetria usa as mesmas posições). Troca sozinho a cada 8 s; para com o mouse em cima. */
  const caixaMapa = $("#pt-mapa-leaflet");
  const CORREDORES = DADOS && DADOS.corredores;
  const FROTA = (DADOS && DADOS.frota) || [];
  if (caixaMapa && CORREDORES && CORREDORES.length) {
    const TROCA_MS = 8000;
    let indice = 0;
    let mapa = null;
    let camadas = null;
    let L = null;

    const ICONE_CAMINHAO =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h12v10H2z" /><path d="M14 9h4l3 3.5V16h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>';

    // bolinhas (uma por corredor)
    const pontos = $("#pt-corredor-pontos");
    pontos.innerHTML = CORREDORES.map(
      (c, i) => `<button type="button" data-corredor="${i}" aria-label="${esc(c.titulo)}"></button>`,
    ).join("");

    const texto = (sel, valor) => {
      const el = $(sel);
      if (el) el.textContent = valor;
    };

    function desenharMapa(c, carretas) {
      if (!mapa) return;
      camadas.clearLayers();
      // sem traçado de rota: só os caminhões (e o posto do corredor).
      // As rotas continuam servindo para enquadrar a região do corredor (ver fitBounds).
      L.circleMarker(c.posto.pos, { radius: 6, color: "#16a34a", weight: 3, fillColor: "#fff", fillOpacity: 1 })
        .bindTooltip(`${c.posto.nome}: ${c.posto.situacao} • ${c.posto.fila}`, { direction: "left", offset: [-8, 0] })
        .addTo(camadas);
      // carretas na última posição GPS
      carretas.forEach((v) =>
        L.marker(v.pos, {
          icon: L.divIcon({
            className: "",
            iconSize: [0, 0],
            html: `<span class="pt-caminhao-pino${v.alerta ? " pt-caminhao-alerta" : ""}">${ICONE_CAMINHAO}</span>`,
          }),
          keyboard: false,
        })
          .bindTooltip(
            `<b>${esc(v.placa)}</b> • ${v.vel} km/h<br>${esc(v.de)} → ${esc(v.para)}<br>Última posição: há ${v.atualizado} min`,
            { direction: "top", offset: [0, -16] },
          )
          .addTo(camadas),
      );
      // enquadra rotas + carretas, com espaço para os chips do topo e as bolinhas
      const limites = L.latLngBounds([...c.rotas.flat(), ...carretas.map((v) => v.pos), c.posto.pos]);
      mapa.fitBounds(limites, { paddingTopLeft: [24, 52], paddingBottomRight: [24, 34] });
    }

    function mostrar(i) {
      indice = (i + CORREDORES.length) % CORREDORES.length;
      const c = CORREDORES[indice];
      const carretas = FROTA.filter((v) => v.regiao === c.regiao);
      const media = carretas.length ? Math.round(carretas.reduce((s, v) => s + v.vel, 0) / carretas.length) : 0;
      const gps = carretas.length ? Math.min(...carretas.map((v) => v.atualizado)) : 0;

      texto("#pt-corredor-nome", c.titulo);
      $("#pt-corredor-nome").parentElement.title = c.titulo;
      texto("#pt-corredor-carretas", `${carretas.length} ${carretas.length === 1 ? "carreta" : "carretas"} em rota`);
      texto("#pt-corredor-vias", c.vias);
      texto("#pt-corredor-posto", `${c.posto.nome}: ${c.posto.situacao}`);
      texto("#pt-corredor-fila", c.posto.fila);
      texto("#pt-corredor-chegada", c.proxima);
      texto("#pt-corredor-vel", `${media} km/h`);
      texto("#pt-corredor-malha", c.malha);
      texto("#pt-corredor-gps", `há ${gps} min`);
      pontos.querySelectorAll("[data-corredor]").forEach((b, n) => b.setAttribute("aria-current", String(n === indice)));
      desenharMapa(c, carretas);
    }

    // troca automática (pausa com o mouse ou o foco no cartão)
    const cartao = caixaMapa.closest(".pt-corredor");
    let timer = null;
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parar = () => clearInterval(timer);
    const iniciar = () => {
      parar();
      if (!reduz) timer = setInterval(() => mostrar(indice + 1), TROCA_MS);
    };
    cartao.addEventListener("mouseenter", parar);
    cartao.addEventListener("mouseleave", iniciar);
    cartao.addEventListener("focusin", parar);
    cartao.addEventListener("focusout", iniciar);

    $("#pt-corredor-anterior").addEventListener("click", () => mostrar(indice - 1));
    $("#pt-corredor-proximo").addEventListener("click", () => mostrar(indice + 1));
    pontos.addEventListener("click", (e) => {
      const b = e.target.closest("[data-corredor]");
      if (b) mostrar(Number(b.dataset.corredor));
    });

    mostrar(0); // textos já aparecem antes do mapa carregar
    iniciar();

    window.VelozLeaflet && window.VelozLeaflet.carregar()
      .then((Leaflet) => {
        L = Leaflet;
        mapa = L.map(caixaMapa, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true, // zoom com a roda do mouse sobre o mapa (igual à cotação)
        });
        L.control.attribution({ prefix: false, position: "bottomright" }).addTo(mapa);
        L.tileLayer(window.VelozLeaflet.TILES, { maxZoom: 18, attribution: window.VelozLeaflet.CREDITO }).addTo(mapa);
        camadas = L.layerGroup().addTo(mapa);
        mostrar(indice);
        // a coluna pode mudar de largura (menu, janela): refaz o enquadramento
        let tempo = null;
        window.addEventListener("resize", () => {
          clearTimeout(tempo);
          tempo = setTimeout(() => {
            mapa.invalidateSize();
            mostrar(indice);
          }, 150);
        });
        setTimeout(() => {
          mapa.invalidateSize();
          mostrar(indice);
        }, 300);
      })
      .catch(() => {
        const aviso = $("#pt-mapa-aviso");
        if (aviso) aviso.hidden = false;
      });
  }

  /* ---------- contadores dos indicadores ---------- */
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".pt-contador").forEach((el) => {
      const final = Number(el.dataset.valor);
      const digitos = Number(el.dataset.digitos || 0);
      const formatar = (v) =>
        el.hasAttribute("data-milhar")
          ? Math.round(v).toLocaleString("pt-BR")
          : String(Math.round(v)).padStart(digitos, "0");
      const inicio = performance.now();
      const DURACAO = 1400;
      el.textContent = formatar(0);
      const passo = (agora) => {
        const t = Math.min((agora - inicio) / DURACAO, 1);
        el.textContent = formatar(final * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
  }

})();
