/* VelozLog — Gestão de Envios, Cargas e Comprovantes (portal-manifestos.html)
   Dados de DEMONSTRAÇÃO em /js/manifestos.js (window.VelozManifestos.cargas / totais).
   • Busca (chave NF-e, CT-e, destinatário, pedido, cidade) + filtro por status + paginação
   • Exportar: baixa a lista filtrada em CSV (abre no Excel)
   • Entregues: clique na linha (ou "Ver POD") abre o Comprovante Digital com o canhoto,
     os metadados e o mapa do local da baixa (Leaflet + OpenStreetMap, o mesmo da cotação)
   • Demais: "Rastrear" abre a página de rastreio do CT-e */
(() => {
  "use strict";

  const dados = window.VelozManifestos;
  if (!dados) {
    console.error("gestao.js: carregue /js/manifestos.js antes deste arquivo");
    return;
  }
  // situação atual de cada carga (com as ocorrências tratadas aplicadas)
  let CARGAS = dados.cargas.map(dados.efetivo);
  const POR_PAGINA = 5;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => el.querySelectorAll(s);
  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const norm = (t) =>
    String(t)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // tira os acentos
      .toLowerCase();
  const avisar = (t, x) => window.VelozPortal && window.VelozPortal.avisar(t, x);
  const kg = (n) => n.toLocaleString("pt-BR");

  /* ---------- período (despachos dos últimos N dias) ---------- */
  const selectPeriodo = $("#gs-periodo");
  const doPeriodo = () => {
    const dias = Number(selectPeriodo.value) || 30;
    return CARGAS.filter((m) => m.dias >= -dias);
  };

  /* ---------- números do topo e dos filtros: contados da lista do período ---------- */
  function mostrarTotais() {
    Object.entries(dados.calcularTotais(doPeriodo())).forEach(([chave, valor]) =>
      $$(`[data-gs="${chave}"]`).forEach(
        (el) => (el.textContent = chave === "novos" ? `+${valor}` : valor),
      ),
    );
  }
  mostrarTotais();

  /* ---------- ícones ---------- */
  const ICONES = {
    pino: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>',
    lotacao: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h12v10H2z" /><path d="M14 9h4l3 3.5V16h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>',
    fracionada: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="8" height="8" rx="1" /><rect x="13" y="11" width="8" height="8" rx="1" /><rect x="8" y="3" width="8" height="8" rx="1" /></svg>',
    expresso: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>',
    entregue: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>',
    transito: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8" /><path d="M18.5 2v3.8h-3.8M5.5 22v-3.8h3.8" /></svg>',
    ocorrencia: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h0" /></svg>',
    coleta: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>',
    pod: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 15l2 2 4-4" /></svg>',
    alvo: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>',
  };

  /* ---------- tabela ---------- */
  const corpo = $("#gs-linhas");
  const busca = $("#gs-busca");
  let filtro = "todos";
  let pagina = 1;
  let lista = doPeriodo();

  const modalidadeHTML = (m) => {
    const [l1, ...resto] = m.mod.split(" ");
    return `<span class="gs-mod">${ICONES[m.modTipo]}<span>${esc(l1)}<br>${esc(resto.join(" "))}</span></span>`;
  };

  const codigoDe = (m) => dados.codigo(m); // código de rastreio VLZ-{CT-e}-{UF}

  function linha(m) {
    const codigo = codigoDe(m);
    const temPod = m.status === "entregue" && m.pod;
    const acao = temPod
      ? `<button type="button" class="gs-acao gs-acao-pod" data-pod-abrir="${m.cte}">${ICONES.pod}Ver POD</button>`
      : `<a class="gs-acao" href="/rastreio.html?codigo=${codigo}&de=gestao">${ICONES.alvo}Rastrear</a>`;
    return `<tr class="gs-entrando${temPod ? " gs-com-pod" : ""}"${temPod ? ` data-pod-abrir="${m.cte}"` : ""}>
      <td>
        <div class="gs-doc">
          <strong>${codigo}</strong>
          <span class="gs-serie">${esc(m.serie)}</span>
          <span class="gs-chave">CT-e ${esc(m.cte)} • NF-e: ${esc(m.chave)}</span>
          <span class="gs-vols">Vols: ${m.vols} • ${kg(m.kg)} kg</span>
        </div>
      </td>
      <td class="gs-dest">
        <strong>${esc(m.dest)}</strong>
        <span>${ICONES.pino}${esc(m.cidade)} / ${esc(m.uf)} • ${esc(m.bairro)}</span>
        <small>Ped: ${esc(m.pedido)}</small>
      </td>
      <td class="gs-data"><strong>${esc(m.despacho)}</strong><small>${esc(m.despachoHora)}</small></td>
      <td>${modalidadeHTML(m)}</td>
      <td>
        <div class="gs-status-col">
          <span class="gs-status gs-status-${dados.grupo(m)}">${ICONES[dados.grupo(m)]}${esc(m.rotulo)}</span>
          ${etiquetaOcorrencia(m)}
        </div>
      </td>
      <td class="gs-prev ${dados.grupo(m)}"><strong>${esc(m.prev)}</strong><small>${esc(m.prevNota)}</small></td>
      <td>
        <div class="gs-acoes">
          ${acao}
          <button type="button" class="gs-acao gs-acao-oc" data-ocorrencia="${m.cte}" aria-label="Registrar ocorrência em ${codigo}" title="Registrar ocorrência">${ICONES.ocorrencia}</button>
        </div>
      </td>
    </tr>`;
  }

  // carga com ocorrência registrada pelo cliente: etiqueta com o protocolo, abaixo do status
  // só ocorrências ainda em tratamento (encerradas/canceladas não marcam a linha)
  function etiquetaOcorrencia(m) {
    const emAberto = (dados.ocorrenciasCliente ? dados.ocorrenciasCliente(m.cte) : []).filter(
      (o) => dados.ESTADOS_OC[o.estado].fase !== "encerrada",
    );
    if (!emAberto.length) return "";
    const o = emAberto[0];
    const mais = emAberto.length > 1 ? ` +${emAberto.length - 1}` : "";
    const fase = dados.ESTADOS_OC[o.estado].fase; // aberta (vermelho) · andamento (âmbar)
    return `<a class="gs-oc-tag gs-oc-tag-${fase}" href="#gs-ocorrencias" title="${esc(o.tipo)} — ${esc(o.status)}">${ICONES.ocorrencia}<span>${esc(o.protocolo)}${mais}</span></a>`;
  }

  // ocorrência registrada ou tratada: recalcula a situação das cargas, os números e a tabela
  document.addEventListener("vl:ocorrencias", () => {
    CARGAS = dados.cargas.map(dados.efetivo);
    mostrarTotais();
    filtrar();
  });

  function filtrar() {
    const termo = norm(busca.value.trim());
    lista = doPeriodo().filter((m) => {
      if (filtro !== "todos" && dados.grupo(m) !== filtro) return false;
      if (!termo) return true;
      const texto = norm(
        [codigoDe(m), `cte-${m.cte}`, m.cte, m.chave, m.chave.replace(/\s/g, ""), m.nf, m.dest, m.pedido, m.cidade, m.uf, m.bairro].join(" "),
      );
      return texto.includes(termo);
    });
    pagina = 1;
    render();
  }

  function render() {
    const total = lista.length;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    pagina = Math.min(pagina, paginas);
    const inicio = (pagina - 1) * POR_PAGINA;
    const itens = lista.slice(inicio, inicio + POR_PAGINA);

    corpo.innerHTML = itens.length
      ? itens.map(linha).join("")
      : `<tr class="gs-vazio"><td colspan="7">Nenhum manifesto encontrado com esses filtros.</td></tr>`;

    $("#gs-mostrando").innerHTML = total
      ? `Mostrando <b>${inicio + 1} a ${inicio + itens.length}</b> de <b>${total}</b> manifestos e cargas`
      : "Nenhum resultado";

    $("#gs-paginas").innerHTML = Array.from({ length: paginas }, (_, i) => {
      const n = i + 1;
      return `<button type="button" data-pagina="${n}"${n === pagina ? ' aria-current="page"' : ""} aria-label="Página ${n}">${n}</button>`;
    }).join("");
    $("#gs-anterior").disabled = pagina === 1;
    $("#gs-proximo").disabled = pagina === paginas;
  }

  busca.addEventListener("input", filtrar);

  $("#gs-chips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filtro]");
    if (!chip) return;
    filtro = chip.dataset.filtro;
    $$("#gs-chips [data-filtro]").forEach((b) => {
      const ativo = b === chip;
      b.classList.toggle("ativo", ativo);
      b.setAttribute("aria-pressed", String(ativo));
    });
    filtrar();
  });

  $("#gs-paginas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pagina]");
    if (!b) return;
    pagina = Number(b.dataset.pagina);
    render();
  });
  $("#gs-anterior").addEventListener("click", () => {
    pagina--;
    render();
  });
  $("#gs-proximo").addEventListener("click", () => {
    pagina++;
    render();
  });

  selectPeriodo.addEventListener("change", (e) => {
    const texto = e.target.options[e.target.selectedIndex].textContent;
    mostrarTotais();
    filtrar();
    avisar("Período aplicado", `${texto}: ${lista.length} manifesto${lista.length === 1 ? "" : "s"} na lista.`);
  });

  /* ---------- exportar CSV (Excel) ---------- */
  $("#gs-exportar").addEventListener("click", () => {
    const cab = ["Código de rastreio", "CT-e", "Série", "Chave NF-e", "Volumes", "Peso (kg)", "Destinatário", "Cidade", "UF", "Pedido", "Despacho", "Modalidade", "Status", "Previsão / Entrega"];
    const linhas = lista.map((m) => [
      codigoDe(m), `CTE-${m.cte}`, m.serie, m.chave, m.vols, m.kg, m.dest, m.cidade, m.uf, m.pedido,
      `${m.despacho} ${m.despachoHora}`, m.mod, m.rotulo, `${m.prev} — ${m.prevNota}`,
    ]);
    const csv = [cab, ...linhas]
      .map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    // BOM para o Excel reconhecer os acentos
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `VelozLog-manifestos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    avisar("Exportação concluída", `${lista.length} manifestos exportados em CSV (abre no Excel).`);
  });

  /* =========================================================
     COMPROVANTE DIGITAL (POD)
     ========================================================= */
  const fundo = $("#gs-fundo");
  const painel = $("#gs-pod");
  const moldura = $(".gs-canhoto-moldura");
  const botaoZoom = $("#gs-zoom");
  let focoAnterior = null;
  let mapa = null;
  let camadasMapa = [];

  const definirPod = (chave, texto) =>
    $$(`[data-pod="${chave}"]`).forEach((el) => (el.textContent = texto));

  // canhoto ilustrativo montado com os dados da entrega
  function canhotoHTML(m) {
    const [dia, mes, ano] = m.pod.carimbo.slice(0, 10).split("/");
    const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const dataCarimbo = `${dia} ${MESES[Number(mes) - 1]} ${ano}`;
    return `
      <div class="gs-canhoto-topo">
        <span class="gs-canhoto-marca">VELOZLOG<small>Gestão de Cargas</small></span>
        <span class="gs-canhoto-doc">
          <b>COMPROVANTE DE ENTREGA - VELOZLOG</b>
          <span>Nº NF: ${esc(m.nf)}</span> <span>Data: ${dia}/${mes}/${ano}</span>
        </span>
      </div>
      <div class="gs-canhoto-linha">Cliente: ${esc(m.dest)}</div>
      <div class="gs-canhoto-linha">Destinatário: Recebido por ${esc(m.pod.recebedor)}</div>
      <div class="gs-canhoto-assinatura">Entregue por: <i>${esc(m.pod.entregador)}</i></div>
      <div class="gs-canhoto-rodape">
        <span class="gs-carimbo-retangulo">ENTREGUE EM:<b>${dataCarimbo}</b>VELOZLOG - LOGÍSTICA</span>
        <span class="gs-carimbo-conferente">${esc(m.pod.conferente)}</span>
        <span class="gs-carimbo-redondo">RECEBIDO<br>${dia} ${MESES[Number(mes) - 1]}<br>${ano}</span>
      </div>
      <div class="gs-canhoto-vols">Volumes: ${m.vols} • Peso: ${kg(m.kg)} kg • ${esc(m.pedido)}</div>`;
  }

  async function mostrarMapa(m) {
    const caixa = $("#gs-mapa");
    const aviso = $("#gs-mapa-aviso");
    aviso.hidden = true;
    try {
      const L = await window.VelozLeaflet.carregar();
      const ponto = [m.pod.lat, m.pod.lng];
      if (!mapa) {
        mapa = L.map(caixa, {
          zoomControl: true,
          attributionControl: false,
          scrollWheelZoom: false,
        });
        L.control.attribution({ prefix: false, position: "bottomright" }).addTo(mapa);
        L.tileLayer(window.VelozLeaflet.TILES, {
          maxZoom: 19,
          attribution: window.VelozLeaflet.CREDITO,
        }).addTo(mapa);
      }
      camadasMapa.forEach((c) => c.remove());
      camadasMapa = [
        // área da cerca virtual (geofence) do destino
        L.circle(ponto, {
          radius: 90,
          color: "#f26a1b",
          weight: 2,
          fillColor: "#f26a1b",
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(mapa),
        L.marker(ponto, {
          icon: L.divIcon({ className: "", html: '<div class="gs-pino"></div>', iconSize: [0, 0] }),
          interactive: false,
          keyboard: false,
        }).addTo(mapa),
      ];
      mapa.setView(ponto, 16);
      // o painel ainda está deslizando: recalcula o tamanho quando ele termina
      setTimeout(() => {
        mapa.invalidateSize();
        mapa.setView(ponto, 16);
      }, 450);
    } catch (erro) {
      console.warn("[VelozLog] Mapa indisponível no comprovante.", erro);
      aviso.hidden = false;
    }
  }

  function abrirPod(cte) {
    const m = CARGAS.find((c) => c.cte === cte);
    if (!m || !m.pod) return;

    definirPod("codigo", `${codigoDe(m)} • CT-e ${m.cte}`);
    definirPod("registro", m.pod.registro);
    definirPod("recebedor", m.pod.recebedor);
    definirPod("doc", m.pod.doc);
    definirPod("carimbo", m.pod.carimbo);
    definirPod("coordenadas", `${m.pod.lat.toFixed(6)}, ${m.pod.lng.toFixed(6)}`);
    definirPod("raio", m.pod.raio);
    definirPod("local", m.pod.local);
    $("#gs-canhoto").innerHTML = canhotoHTML(m);
    ampliar(false);

    focoAnterior = document.activeElement;
    fundo.hidden = false;
    painel.hidden = false;
    document.body.style.overflow = "hidden";
    $(".gs-pod-fechar", painel).focus();
    $(".gs-pod-corpo", painel).scrollTop = 0;
    mostrarMapa(m);
  }

  function fecharPod() {
    if (painel.hidden) return;
    fundo.hidden = true;
    painel.hidden = true;
    document.body.style.overflow = "";
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }

  function ampliar(sim) {
    moldura.classList.toggle("ampliado", sim);
    botaoZoom.setAttribute("aria-pressed", String(sim));
    $("span", botaoZoom).textContent = sim ? "Reduzir" : "Zoom";
  }

  // abrir: botão "Ver POD" ou clique na linha de uma carga entregue
  corpo.addEventListener("click", (e) => {
    // ícone de ocorrência e etiqueta: tratados pelo /js/ocorrencias.js (não abrem o POD)
    if (e.target.closest("[data-ocorrencia], .gs-oc-tag")) return;
    const alvo = e.target.closest("[data-pod-abrir]");
    if (!alvo || e.target.closest("a")) return;
    abrirPod(alvo.dataset.podAbrir);
  });

  $$("[data-fechar-pod]").forEach((b) => b.addEventListener("click", fecharPod));
  fundo.addEventListener("click", fecharPod);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") fecharPod();
  });

  botaoZoom.addEventListener("click", () =>
    ampliar(!moldura.classList.contains("ampliado")),
  );

  // "Baixar Dossiê POD (PDF)": imprime só o painel — escolha "Salvar como PDF"
  $("#gs-baixar").addEventListener("click", () => {
    document.body.classList.add("gs-imprimindo");
    const tituloOriginal = document.title;
    document.title = `Dossie-POD-${$('[data-pod="codigo"]').textContent.split(" ")[0]}`;
    window.print();
    document.title = tituloOriginal;
    document.body.classList.remove("gs-imprimindo");
  });

  /* ---------- início ---------- */
  render();

  // abrir direto um comprovante: portal-manifestos.html?pod=VLZ-0089241-SP (ou CTE-0089241)
  const podUrl = new URLSearchParams(location.search).get("pod");
  if (podUrl) abrirPod(podUrl.replace(/\D/g, ""));
})();
