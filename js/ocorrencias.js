/* VelozLog — Ocorrências registradas pelo cliente (portal-manifestos.html)
   • "Registrar Ocorrência" (cartão abaixo da tabela) ou o ícone de alerta na linha da carga
     abrem a janela já com a carga escolhida
   • tipo, quando foi constatada, volumes afetados, descrição, contato e fotos (até 5)
   • gera o protocolo OCR-ANO-NNNN, guarda neste navegador (/js/manifestos.js) e:
       – lista no cartão "Ocorrências Registradas"
       – marca a linha da carga na tabela (etiqueta com o protocolo)
       – aparece no histórico da página de rastreio da carga
   • abrir direto: portal-manifestos.html?ocorrencia=VLZ-0089241-SP
   DEMONSTRAÇÃO: sem servidor. As fotos não são enviadas (guardamos só a quantidade). */
(() => {
  "use strict";

  const dados = window.VelozManifestos;
  const janela = document.getElementById("gs-oc-janela");
  if (!dados || !janela) return;

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const avisar = (t, x) => window.VelozPortal && window.VelozPortal.avisar(t, x);
  const ANO = new Date().getFullYear();
  const MAX_FOTOS = 5;

  const form = $("#gs-oc-form");
  const campos = {
    carga: $("#gs-oc-carga"),
    tipo: $("#gs-oc-tipo"),
    quando: $("#gs-oc-quando"),
    volumes: $("#gs-oc-volumes"),
    contato: $("#gs-oc-contato"),
    descricao: $("#gs-oc-descricao"),
  };
  const arquivos = $("#gs-oc-arquivos");
  const miniaturas = $("#gs-oc-miniaturas");
  let fotos = []; // { nome, url }

  const cargaDe = (cte) => dados.todos.find((m) => m.cte === cte) || null;

  // cor do status da ocorrência: aberta (vermelho) · andamento (âmbar) · resolvida (verde) · cancelada (azul)
  const CLASSE_FASE = {
    aberta: "gs-status-ocorrencia",
    andamento: "gs-status-transito",
    encerrada: "gs-status-entregue",
    cancelada: "gs-status-coleta",
  };

  /* ---------- lista de cargas do select ---------- */
  campos.carga.innerHTML =
    '<option value="">Selecione a carga…</option>' +
    dados.todos
      .map(
        (m) =>
          `<option value="${esc(m.cte)}">${esc(dados.codigo(m))} — ${esc(m.cidade)}/${esc(m.uf)} • ${esc(m.rotulo)}</option>`,
      )
      .join("");

  /* ---------- data e hora padrão: agora (sem permitir o futuro) ---------- */
  const doisDig = (n) => String(n).padStart(2, "0");
  const paraCampo = (d) =>
    `${d.getFullYear()}-${doisDig(d.getMonth() + 1)}-${doisDig(d.getDate())}T${doisDig(d.getHours())}:${doisDig(d.getMinutes())}`;

  /* ---------- validação ---------- */
  const REGRAS = {
    carga: () => !!cargaDe(campos.carga.value),
    tipo: () => !!campos.tipo.value,
    quando: () => {
      const d = new Date(campos.quando.value);
      return !isNaN(d) && d.getTime() <= Date.now() + 60000;
    },
    volumes: () => {
      if (!campos.volumes.value) return true; // opcional
      const v = Number(campos.volumes.value);
      const m = cargaDe(campos.carga.value);
      return Number.isInteger(v) && v >= 1 && (!m || !m.vols || v <= m.vols);
    },
    contato: () => campos.contato.value.trim().length >= 8,
    descricao: () => campos.descricao.value.trim().length >= 10,
  };

  function mostrarErro(nome, mostrar) {
    const caixa = campos[nome].closest(".gs-oc-campo");
    caixa.classList.toggle("gs-oc-invalido", mostrar);
    $(".gs-oc-erro", caixa).hidden = !mostrar;
    campos[nome].setAttribute("aria-invalid", String(mostrar));
  }

  Object.keys(REGRAS).forEach((nome) =>
    ["input", "change"].forEach((ev) =>
      campos[nome].addEventListener(ev, () => {
        if (campos[nome].getAttribute("aria-invalid") === "true" && REGRAS[nome]()) mostrarErro(nome, false);
      }),
    ),
  );

  // volumes afetados: no máximo o total da carga escolhida
  campos.carga.addEventListener("change", () => {
    const m = cargaDe(campos.carga.value);
    if (m && m.vols) {
      campos.volumes.max = m.vols;
      campos.volumes.placeholder = `De 1 a ${m.vols}`;
    } else {
      campos.volumes.removeAttribute("max");
      campos.volumes.placeholder = "Ex.: 2";
    }
  });

  /* ---------- fotos ---------- */
  function mostrarFotos() {
    miniaturas.innerHTML = fotos
      .map(
        (f, i) => `<li>
          <img src="${f.url}" alt="${esc(f.nome)}">
          <button type="button" data-oc-remover="${i}" aria-label="Remover ${esc(f.nome)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>
          </button>
        </li>`,
      )
      .join("");
  }

  arquivos.addEventListener("change", () => {
    const novas = [...arquivos.files].filter((f) => f.type.startsWith("image/"));
    const cabem = MAX_FOTOS - fotos.length;
    novas.slice(0, cabem).forEach((f) => fotos.push({ nome: f.name, url: URL.createObjectURL(f) }));
    if (novas.length > cabem) avisar("Fotos", `Cabem até ${MAX_FOTOS} fotos por ocorrência.`);
    arquivos.value = "";
    mostrarFotos();
  });

  miniaturas.addEventListener("click", (e) => {
    const b = e.target.closest("[data-oc-remover]");
    if (!b) return;
    const [removida] = fotos.splice(Number(b.dataset.ocRemover), 1);
    if (removida) URL.revokeObjectURL(removida.url);
    mostrarFotos();
  });

  /* ---------- abrir e fechar ---------- */
  function limpar() {
    form.reset();
    campos.contato.value = campos.contato.defaultValue;
    fotos.forEach((f) => URL.revokeObjectURL(f.url));
    fotos = [];
    mostrarFotos();
    Object.keys(REGRAS).forEach((nome) => mostrarErro(nome, false));
  }

  function abrir(cte = "") {
    limpar();
    const agora = new Date();
    campos.quando.value = paraCampo(agora);
    campos.quando.max = paraCampo(agora);
    campos.carga.value = cargaDe(cte) ? cte : "";
    campos.carga.dispatchEvent(new Event("change"));
    if (typeof janela.showModal === "function") janela.showModal();
    else janela.setAttribute("open", "");
    (campos.carga.value ? campos.tipo : campos.carga).focus();
  }

  const fechar = () => (typeof janela.close === "function" ? janela.close() : janela.removeAttribute("open"));

  document.addEventListener("click", (e) => {
    const naLinha = e.target.closest("[data-ocorrencia]");
    if (naLinha) {
      e.preventDefault();
      abrir(naLinha.dataset.ocorrencia);
    } else if (e.target.closest("[data-oc-nova]")) {
      abrir();
    } else if (e.target.closest("[data-oc-fechar]")) {
      fechar();
    }
  });
  // clique no fundo escuro fecha (a janela não tem espaço vazio próprio: o form ocupa tudo)
  janela.addEventListener("click", (e) => {
    if (e.target === janela) fechar();
  });

  /* ---------- registrar ---------- */
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const invalidos = Object.keys(REGRAS).filter((nome) => !REGRAS[nome]());
    Object.keys(REGRAS).forEach((nome) => mostrarErro(nome, invalidos.includes(nome)));
    if (invalidos.length) {
      campos[invalidos[0]].focus();
      return;
    }

    const m = cargaDe(campos.carga.value);
    const existentes = dados.ocorrenciasCliente();
    const protocolo = `OCR-${ANO}-${String(1041 + existentes.length).padStart(4, "0")}`;
    const ocorrencia = {
      protocolo,
      cte: m.cte,
      codigo: dados.codigo(m),
      cidade: m.cidade,
      uf: m.uf,
      tipo: campos.tipo.value,
      quando: new Date(campos.quando.value).toISOString(),
      volumes: campos.volumes.value ? Number(campos.volumes.value) : null,
      descricao: campos.descricao.value.trim(),
      contato: campos.contato.value.trim(),
      fotos: fotos.length,
      status: "Em análise pela Torre",
      criada: Date.now(),
    };

    try {
      dados.salvarOcorrencia(ocorrencia);
    } catch {
      avisar("Não foi possível salvar", "Este navegador bloqueou o armazenamento. Fale com a Torre: 0800 700 8900, ramal 9099.");
      return;
    }
    fechar();
    mostrarLista(protocolo);
    avisar("Ocorrência registrada", `Protocolo ${protocolo}. A Torre de Controle responde em até 2 horas úteis.`);
  });

  /* ---------- lista "Ocorrências Registradas" ---------- */
  const dataHora = (ms) => {
    const d = new Date(ms);
    return `${d.toLocaleDateString("pt-BR")} • ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  function mostrarLista(destacar = null) {
    const lista = dados.ocorrenciasCliente();
    $("#gs-oc-vazio").hidden = lista.length > 0;
    $("#gs-oc-linhas").innerHTML = lista
      .map((o) => {
        const resumo = o.descricao.length > 90 ? `${o.descricao.slice(0, 90)}…` : o.descricao;
        const extras = [o.volumes ? `${o.volumes} vol.` : "", o.fotos ? `${o.fotos} foto${o.fotos > 1 ? "s" : ""}` : ""]
          .filter(Boolean)
          .join(" • ");
        const whats = `Olá, Torre VelozLog! Quero acompanhar a ocorrência ${o.protocolo} (${o.tipo}) da carga ${o.codigo}.`;
        const fase = dados.ESTADOS_OC[o.estado].fase;
        const ultimo = o.historico.length ? o.historico[o.historico.length - 1] : null;
        const encerrada = fase === "encerrada";
        return `<tr class="${o.protocolo === destacar ? "gs-oc-nova" : ""}">
          <td><strong class="gs-oc-protocolo">${esc(o.protocolo)}</strong><small>${esc(dataHora(o.criada))}</small></td>
          <td><strong>${esc(o.codigo)}</strong><small>${esc(o.cidade)} / ${esc(o.uf)}</small></td>
          <td><strong>${esc(o.tipo)}</strong>${extras ? `<small>${esc(extras)}</small>` : ""}</td>
          <td class="gs-oc-desc" title="${esc(o.descricao)}">${esc(resumo)}</td>
          <td>
            <span class="gs-status ${CLASSE_FASE[o.estado] || CLASSE_FASE[fase]}">${esc(o.status)}</span>
            ${ultimo ? `<small class="gs-oc-atualizado">Atualizada ${esc(dataHora(ultimo.ts))}</small>` : ""}
          </td>
          <td>
            <div class="gs-acoes">
              <button type="button" class="gs-acao ${encerrada ? "" : "gs-acao-tratar"}" data-oc-tratar="${esc(o.protocolo)}">${encerrada ? "Ver andamento" : "Tratar"}</button>
              <a class="gs-acao" href="/rastreio.html?codigo=${encodeURIComponent(o.codigo)}&de=gestao">Rastrear</a>
              <a class="gs-acao" href="#" data-whatsapp="${esc(whats)}">Acompanhar</a>
            </div>
          </td>
        </tr>`;
      })
      .join("");
  }

  mostrarLista();

  /* =========================================================
     TRATAR OCORRÊNCIA
     Mostra o resumo e o andamento; oferece só as próximas etapas possíveis.
     "Pendência solucionada" ou "Colocar para despacho" iniciam o ciclo da nova
     tentativa (em rota → saiu para entrega → entregue). Cada etapa atualiza a
     situação da carga em todo o site (rastreio, card da home, tabela, Visão Geral).
     ========================================================= */
  const janelaTrat = $("#gs-trat-janela");
  const formTrat = $("#gs-trat-form");
  const selAcao = $("#gs-trat-acao");
  const campoObs = $("#gs-trat-obs");
  const campoRecebedor = $("#gs-trat-recebedor");
  const campoDoc = $("#gs-trat-doc");
  let emTratamento = null; // protocolo aberto na janela

  // etapas em que "o que foi feito" é obrigatório
  const PEDE_OBS = ["aguardando", "solucionada", "devolucao", "cancelada", "analise"];
  // etapas que pedem quem recebeu
  const PEDE_RECEBEDOR = ["entregue", "devolvido"];

  const erroTrat = (campo, mostrar) => {
    const caixa = campo.closest(".gs-oc-campo");
    caixa.classList.toggle("gs-oc-invalido", mostrar);
    $(".gs-oc-erro", caixa).hidden = !mostrar;
    campo.setAttribute("aria-invalid", String(mostrar));
  };

  function ajustarCamposTrat() {
    const estado = selAcao.value;
    const pedeRecebedor = PEDE_RECEBEDOR.includes(estado);
    janelaTrat.querySelectorAll("[data-trat-recebedor]").forEach((el) => (el.hidden = !pedeRecebedor));
    $("#gs-trat-obs-opcional").hidden = PEDE_OBS.includes(estado);
    [selAcao, campoObs, campoRecebedor].forEach((c) => erroTrat(c, false));
  }
  selAcao.addEventListener("change", ajustarCamposTrat);

  function abrirTratamento(protocolo) {
    const o = dados.ocorrenciasCliente().find((x) => x.protocolo === protocolo);
    if (!o) return;
    emTratamento = protocolo;
    const estado = dados.ESTADOS_OC[o.estado];
    const encerrada = estado.fase === "encerrada";

    $("#gs-trat-protocolo").textContent = o.protocolo;
    $("#gs-trat-resumo").innerHTML = [
      ["Carga", `${o.codigo} • ${o.cidade}/${o.uf}`],
      ["Tipo", o.tipo],
      ["Registrada em", dataHora(o.criada)],
      ["Situação atual", o.status],
      ["Contato", o.contato],
      ["Volumes / fotos", [o.volumes ? `${o.volumes} vol.` : "—", o.fotos ? `${o.fotos} foto(s)` : "sem fotos"].join(" • ")],
      ["Descrição", o.descricao],
    ]
      .map(([dt, dd]) => `<div${dt === "Descrição" ? ' class="gs-trat-largo"' : ""}><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`)
      .join("");

    // andamento: do mais recente ao registro
    const passos = [
      ...[...o.historico].reverse().map((h) => ({
        titulo: dados.ESTADOS_OC[h.estado] ? dados.ESTADOS_OC[h.estado].rotulo : h.estado,
        texto: [h.obs, h.recebedor ? `Recebido por ${h.recebedor}${h.doc ? ` (doc. ${h.doc})` : ""}` : ""].filter(Boolean).join(" • "),
        ts: h.ts,
        fase: dados.ESTADOS_OC[h.estado] ? dados.ESTADOS_OC[h.estado].fase : "aberta",
      })),
      { titulo: "Ocorrência registrada", texto: o.tipo, ts: o.criada, fase: "aberta" },
    ];
    $("#gs-trat-linha").innerHTML = passos
      .map(
        (p, i) => `<li class="gs-trat-passo gs-trat-${p.fase}${i === 0 ? " gs-trat-atual" : ""}">
          <span class="gs-trat-ponto" aria-hidden="true"></span>
          <div><strong>${esc(p.titulo)}</strong>${p.texto ? `<p>${esc(p.texto)}</p>` : ""}</div>
          <small>${esc(dataHora(p.ts))}</small>
        </li>`,
      )
      .join("");

    // próximas etapas possíveis
    selAcao.innerHTML =
      '<option value="">Selecione…</option>' +
      estado.proximos.map((e) => `<option value="${e}">${esc(dados.ACOES_OC[e])}</option>`).join("");
    formTrat.reset();
    ajustarCamposTrat();

    janelaTrat.querySelectorAll("[data-trat-form]").forEach((el) => (el.hidden = encerrada));
    $("#gs-trat-enviar").hidden = encerrada;
    const aviso = $("#gs-trat-encerrada");
    aviso.hidden = !encerrada;
    aviso.textContent = encerrada
      ? o.estado === "cancelada"
        ? "Ocorrência cancelada. Se o problema continuar, registre uma nova ocorrência."
        : `Ocorrência encerrada: ${o.status.replace("Resolvida • ", "").toLowerCase()}. O rastreio da carga já mostra o resultado.`
      : "";

    if (typeof janelaTrat.showModal === "function") janelaTrat.showModal();
    else janelaTrat.setAttribute("open", "");
    (encerrada ? $("[data-trat-fechar]", janelaTrat) : selAcao).focus();
  }

  const fecharTrat = () =>
    typeof janelaTrat.close === "function" ? janelaTrat.close() : janelaTrat.removeAttribute("open");

  document.addEventListener("click", (e) => {
    const tratar = e.target.closest("[data-oc-tratar]");
    if (tratar) abrirTratamento(tratar.dataset.ocTratar);
    else if (e.target.closest("[data-trat-fechar]")) fecharTrat();
  });
  janelaTrat.addEventListener("click", (e) => {
    if (e.target === janelaTrat) fecharTrat();
  });

  formTrat.addEventListener("submit", (e) => {
    e.preventDefault();
    const estado = selAcao.value;
    const obs = campoObs.value.trim();
    const recebedor = campoRecebedor.value.trim();
    const faltaAcao = !estado;
    const faltaObs = !!estado && PEDE_OBS.includes(estado) && obs.length < 10;
    const faltaRecebedor = !!estado && PEDE_RECEBEDOR.includes(estado) && recebedor.length < 3;
    erroTrat(selAcao, faltaAcao);
    erroTrat(campoObs, faltaObs);
    erroTrat(campoRecebedor, faltaRecebedor);
    if (faltaAcao || faltaObs || faltaRecebedor) {
      (faltaAcao ? selAcao : faltaRecebedor ? campoRecebedor : campoObs).focus();
      return;
    }

    const extra = {};
    if (obs) extra.obs = obs;
    if (PEDE_RECEBEDOR.includes(estado)) {
      extra.recebedor = recebedor;
      if (campoDoc.value.trim()) extra.doc = campoDoc.value.trim();
    }

    let o;
    try {
      o = dados.atualizarOcorrencia(emTratamento, estado, extra);
    } catch {
      avisar("Não foi possível atualizar", "Tente de novo. Se continuar, fale com a Torre: 0800 700 8900, ramal 9099.");
      return;
    }
    fecharTrat();
    mostrarLista(o.protocolo);
    avisar(`Ocorrência ${o.protocolo} atualizada`, `${o.status}. O rastreio da carga ${o.codigo} já mostra a nova situação.`);
  });

  // abrir direto pela URL: ?ocorrencia=VLZ-0089241-SP (ou só o número do CT-e)
  const pedida = new URLSearchParams(location.search).get("ocorrencia");
  if (pedida) {
    const m = dados.buscar(pedida);
    if (m) abrir(m.cte);
  }
})();
