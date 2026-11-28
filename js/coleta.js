/* VelozLog — Solicitar Coleta (portal-coleta.html) — DEMONSTRAÇÃO, sem envio ao servidor
   • etapas no topo acompanham onde o usuário está e o que já está completo
   • resumo à direita recalcula veículo, capacidade, chegada e condição comercial
   • NF-e: arrastar/selecionar XML (lê nNF e vNF do arquivo) ou colar a chave de 44 dígitos
   • confirmar gera o protocolo (COL-ANO-NNNN) e coloca a coleta no topo do histórico
   • "Salvar como Rascunho" guarda o formulário neste navegador (localStorage) */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const avisar = (t, m) => window.VelozPortal && window.VelozPortal.avisar(t, m);
  const digitos = (t) => String(t).replace(/\D/g, "");
  const milhar = (n) => Number(n).toLocaleString("pt-BR");
  const reais = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CHAVE_RASCUNHO = "velozlog:coleta-rascunho";
  const ANO = new Date().getFullYear();
  const EMPRESA = "Indústrias Metalúrgicas ABC";

  const form = $("#cl-form");
  const campos = {
    planta: $("#cl-planta"),
    janela: $("#cl-janela"),
    responsavel: $("#cl-responsavel"),
    telefone: $("#cl-telefone"),
    volumes: $("#cl-volumes"),
    peso: $("#cl-peso"),
  };

  /* ---------------- pontos de coleta ---------------- */
  const PLANTAS = {
    vinhedo: { empresa: EMPRESA, texto: "Vinhedo / SP - Planta Principal", curto: "Planta Vinhedo - SP", doca: "Galpão A-4" },
    technopark: { empresa: EMPRESA, texto: "Campinas / SP - Techno Park", curto: "Techno Park Campinas", doca: "Doca Externa #12" },
    sumare: { empresa: EMPRESA, texto: "Sumaré / SP - Unidade Sumaré", curto: "Unidade Sumaré - SP", doca: "Doca 02" },
    fornecedor: { empresa: "Aços Paulista (Fornecedor)", texto: "Jundiaí / SP - Fornecedor Homologado", curto: "Aços Paulista - Jundiaí", doca: "Doca Única" },
  };
  const planta = () =>
    PLANTAS[campos.planta.value] || {
      empresa: EMPRESA,
      texto: campos.planta.selectedOptions[0].textContent,
      curto: campos.planta.selectedOptions[0].textContent.split(" (")[0],
      doca: "Doca a definir",
    };

  // cadastro rápido de ponto
  const caixaNovo = $("#cl-novo-ponto-caixa");
  $("#cl-novo-ponto").addEventListener("click", () => {
    caixaNovo.hidden = !caixaNovo.hidden;
    if (!caixaNovo.hidden) $("#cl-novo-nome").focus();
  });
  $("#cl-novo-cancelar").addEventListener("click", () => (caixaNovo.hidden = true));
  $("#cl-novo-salvar").addEventListener("click", () => {
    const nome = $("#cl-novo-nome").value.trim();
    if (nome.length < 6) {
      $("#cl-novo-nome").focus();
      avisar("Novo ponto", "Informe o nome e o endereço do ponto de coleta.");
      return;
    }
    const op = new Option(nome, `novo-${Date.now()}`, true, true);
    campos.planta.add(op);
    caixaNovo.hidden = true;
    $("#cl-novo-nome").value = "";
    atualizar();
    avisar("Ponto cadastrado", "O novo ponto entra em homologação e já pode receber esta coleta.");
  });

  /* ---------------- máscaras ---------------- */
  campos.telefone.addEventListener("input", () => {
    const d = digitos(campos.telefone.value).slice(0, 11);
    let t = d;
    if (d.length > 2) t = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) t = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    campos.telefone.value = t;
  });

  campos.peso.addEventListener("input", () => {
    const d = digitos(campos.peso.value).slice(0, 5);
    campos.peso.value = d ? milhar(Number(d)) : "";
  });

  /* ---------------- acondicionamento ---------------- */
  const UNIDADES = {
    paletizada: { longa: "Paletes PBR (1,00 x 1,20m)", curta: "Paletes" },
    seca: { longa: "Volumes de Carga Seca", curta: "Volumes" },
    bobinas: { longa: "Bobinas / Rolos", curta: "Bobinas" },
    caixas: { longa: "Caixas Soltas", curta: "Caixas" },
  };
  const acond = () => $('input[name="acond"]:checked').value;

  /* ---------------- notas fiscais ---------------- */
  // começa sem notas: o cliente vincula as NF-e desta coleta (XML ou chave de acesso)
  let notas = [];
  const listaNotas = $("#cl-notas");
  const erroChave = $("#cl-chave-erro");

  const formatarNumero = (n) => {
    const s = String(Number(n) % 1000000).padStart(6, "0");
    return `${s.slice(0, 3)}.${s.slice(3)}`;
  };

  function mostrarNotas() {
    listaNotas.innerHTML = notas
      .map(
        (n, i) => `<li>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
          NF-e ${esc(n.numero)} (${esc(reais(n.valor))})
          <button type="button" data-remover="${i}" aria-label="Remover NF-e ${esc(n.numero)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>
          </button>
        </li>`,
      )
      .join("");
    atualizar();
  }

  function adicionarNota(nota) {
    if (notas.some((n) => n.numero === nota.numero)) {
      avisar("NF-e já vinculada", `A NF-e ${nota.numero} já está nesta coleta.`);
      return false;
    }
    notas.push(nota);
    mostrarNotas();
    return true;
  }

  listaNotas.addEventListener("click", (e) => {
    const b = e.target.closest("[data-remover]");
    if (!b) return;
    notas.splice(Number(b.dataset.remover), 1);
    mostrarNotas();
  });

  function erroNota(texto) {
    erroChave.textContent = texto;
    erroChave.hidden = !texto;
  }

  // chave de acesso: 44 dígitos; modelo nas posições 21-22 (55 = NF-e); nNF nas 26-34
  const campoChave = $("#cl-chave");
  campoChave.addEventListener("input", () => {
    const d = digitos(campoChave.value).slice(0, 44);
    campoChave.value = d.replace(/(\d{4})(?=\d)/g, "$1 ");
    erroNota("");
  });

  $("#cl-autopreencher").addEventListener("click", () => {
    const d = digitos(campoChave.value);
    if (d.length !== 44) {
      erroNota(`A chave de acesso tem 44 dígitos (você informou ${d.length}).`);
      campoChave.focus();
      return;
    }
    if (d.slice(20, 22) !== "55") {
      erroNota("Esta chave não é de NF-e modelo 55.");
      campoChave.focus();
      return;
    }
    // demonstração: o valor viria da consulta à SEFAZ
    const valor = 10000 + (Number(d.slice(-6)) % 90000);
    if (adicionarNota({ numero: formatarNumero(d.slice(25, 34)), valor })) {
      campoChave.value = "";
      avisar("NF-e importada", "Dados da nota consultados na SEFAZ e vinculados à coleta.");
    }
  });

  // XML da NF-e: lê o número (nNF) e o valor total (vNF)
  async function lerXmls(arquivos) {
    let ok = 0;
    for (const arq of arquivos) {
      if (!/\.xml$/i.test(arq.name)) {
        erroNota(`"${arq.name}" não é um arquivo XML.`);
        continue;
      }
      try {
        const doc = new DOMParser().parseFromString(await arq.text(), "application/xml");
        const nNF = doc.getElementsByTagName("nNF")[0];
        const vNF = doc.getElementsByTagName("vNF")[0];
        if (!nNF) throw new Error("sem nNF");
        if (adicionarNota({ numero: formatarNumero(nNF.textContent), valor: vNF ? Number(vNF.textContent) : 0 })) ok++;
      } catch {
        erroNota(`"${arq.name}" não parece ser o XML de uma NF-e.`);
      }
    }
    if (ok) avisar("XML importado", `${ok} NF-e vinculada${ok > 1 ? "s" : ""} à coleta.`);
  }

  const soltar = $("#cl-soltar");
  const arquivos = $("#cl-arquivos");
  arquivos.addEventListener("change", () => {
    erroNota("");
    lerXmls([...arquivos.files]);
    arquivos.value = "";
  });
  ["dragenter", "dragover"].forEach((ev) =>
    soltar.addEventListener(ev, (e) => {
      e.preventDefault();
      soltar.classList.add("cl-arrastando");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    soltar.addEventListener(ev, (e) => {
      e.preventDefault();
      soltar.classList.remove("cl-arrastando");
    }),
  );
  soltar.addEventListener("drop", (e) => {
    erroNota("");
    lerXmls([...e.dataTransfer.files]);
  });

  /* ---------------- validação ---------------- */
  const pesoKg = () => Number(digitos(campos.peso.value)) || 0;
  const volumes = () => Number(campos.volumes.value) || 0;

  const REGRAS = {
    responsavel: () => campos.responsavel.value.trim().length >= 3,
    telefone: () => digitos(campos.telefone.value).length >= 10,
    volumes: () => volumes() >= 1 && volumes() <= 60,
    peso: () => pesoKg() >= 1 && pesoKg() <= 30000,
  };

  function mostrarErro(nome, mostrar) {
    const caixa = campos[nome].closest(".cl-campo");
    caixa.classList.toggle("cl-invalido", mostrar);
    $(".cl-erro", caixa).hidden = !mostrar;
    campos[nome].setAttribute("aria-invalid", String(mostrar));
  }

  // apaga o erro assim que o campo fica certo
  Object.keys(REGRAS).forEach((nome) =>
    campos[nome].addEventListener("input", () => {
      if (campos[nome].getAttribute("aria-invalid") === "true" && REGRAS[nome]()) mostrarErro(nome, false);
    }),
  );

  const etapaValida = {
    1: () => REGRAS.responsavel() && REGRAS.telefone(),
    2: () => REGRAS.volumes() && REGRAS.peso() && notas.length > 0,
    3: () => etapaValida[1]() && etapaValida[2](),
    4: () => confirmado,
  };

  /* ---------------- resumo ---------------- */
  function veiculoIndicado(kg, vol) {
    if (kg <= 1600 && vol <= 4) return "VUC Baú";
    if (kg <= 4000 && vol <= 8) return "Toco ou VUC Sider";
    if (kg <= 8000 && vol <= 14) return "Truck 6x2";
    if (kg <= 14000 && vol <= 20) return "Bitruck 8x2";
    return "Carreta LS Sider";
  }

  function chegada() {
    const dia = $('input[name="data"]:checked').value === "hoje" ? "Hoje" : "Amanhã";
    const [h, m] = campos.janela.value.split("|")[0].split(":").map(Number);
    const total = h * 60 + m + 90; // frota chega até 1h30 depois da abertura da janela
    const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return `${dia} até às ${hh}:${mm}`;
  }

  function condicao() {
    const extras = [];
    if (form.elements.ajudante.checked) extras.push("Ajudante");
    if (form.elements.escolta.checked) extras.push("Escolta");
    if (!extras.length) return "Incluso em Contrato Faturado";
    return `Contrato Faturado + ${extras.join(" e ")}`;
  }

  function atualizar() {
    const p = planta();
    const unidade = UNIDADES[acond()];
    $("#cl-volumes-unidade").textContent = unidade.longa;
    $("#cl-r-empresa").textContent = p.empresa;
    $("#cl-r-planta").textContent = p.texto;
    $("#cl-r-veiculo").textContent = veiculoIndicado(pesoKg(), volumes());
    $("#cl-r-capacidade").textContent = `${volumes() || 0} ${unidade.curta} (${milhar(pesoKg())} kg)`;
    $("#cl-r-chegada").textContent = chegada();
    $("#cl-r-condicao").textContent = condicao();
    marcarEtapas();
  }

  form.addEventListener("input", atualizar);
  form.addEventListener("change", atualizar);

  /* ---------------- etapas ---------------- */
  let etapaAtual = 2; // a tela abre com o endereço já preenchido: próxima etapa é a carga
  let confirmado = false;
  const botoesEtapa = $$("#cl-etapas button");

  function marcarEtapas() {
    botoesEtapa.forEach((b) => {
      const n = Number(b.dataset.etapa);
      const atual = n === etapaAtual && !confirmado;
      const feita = etapaValida[n]() && !atual;
      b.classList.toggle("cl-atual", atual);
      b.classList.toggle("cl-feita", feita);
      b.querySelector(".cl-etapa-num").innerHTML = feita
        ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>'
        : n;
      b.querySelector("small").textContent = `Etapa 0${n}${atual ? " (Em Curso)" : ""}`;
      if (atual) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
  }

  function irParaEtapa(n) {
    if (n === etapaAtual) return;
    etapaAtual = n;
    marcarEtapas();
  }

  // a etapa "em curso" segue a seção onde o usuário está mexendo
  form.addEventListener("focusin", (e) => {
    const secao = e.target.closest("[data-secao]");
    if (secao) irParaEtapa(Number(secao.dataset.secao));
  });
  $("#cl-resumo").addEventListener("focusin", () => irParaEtapa(4));

  botoesEtapa.forEach((b) =>
    b.addEventListener("click", () => {
      const alvo = document.getElementById(b.dataset.ir);
      irParaEtapa(Number(b.dataset.etapa));
      const topo = alvo.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: topo, behavior: reduzMovimento ? "auto" : "smooth" });
    }),
  );

  /* ---------------- histórico ---------------- */
  const hoje = new Date();
  const dataCurta = (dias) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - dias);
    return d.toLocaleDateString("pt-BR");
  };

  const STATUS = {
    alocacao: { texto: "Aguardando Alocação", classe: "cl-st-alocacao", icone: "ponto" },
    caminho: { texto: "Motorista a Caminho", classe: "cl-st-caminho", icone: "ponto" },
    hub: { texto: "Coletado e no Hub SP-01", classe: "cl-st-hub", icone: "hub" },
    concluido: { texto: "Concluído com Canhoto", classe: "cl-st-concluido", icone: "ok" },
  };
  const ICONES_STATUS = {
    ponto: "<i></i>",
    hub: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="3.5" r="1.8" /><circle cx="12" cy="20.5" r="1.8" /><circle cx="3.5" cy="12" r="1.8" /><circle cx="20.5" cy="12" r="1.8" /><path d="M12 5.3v4.2M12 14.5v4.2M5.3 12h4.2M14.5 12h4.2" /></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>',
  };

  // coletas: mesma lista do rastreio (/js/manifestos.js) — o protocolo COL-… também
  // pode ser consultado em "Rastrear Pedido" (home) e na página de rastreio.
  // As confirmadas neste navegador entram no início (ver "início", mais abaixo).
  const rastreioDe = (protocolo) => `/rastreio.html?codigo=${encodeURIComponent(protocolo)}&de=coleta`;
  const ACAO_POR_STATUS = {
    alocacao: (c) => ({ texto: "Acompanhar", href: rastreioDe(c.protocolo) }),
    caminho: (c) => ({ texto: "Acompanhar", href: rastreioDe(c.protocolo) }),
    hub: () => ({ texto: "Ver CTE", href: "/portal-manifestos.html" }),
    concluido: () => ({ texto: "Comprovante", href: "/portal-manifestos.html" }),
  };
  const comAcao = (c) => ({ ...c, acao: (ACAO_POR_STATUS[c.status] || ACAO_POR_STATUS.alocacao)(c) });
  const historico = (window.VelozManifestos ? window.VelozManifestos.coletas() : [])
    .filter((c) => !c.criada || !(window.VelozManifestos.coletasSolicitadas().some((s) => s.protocolo === c.protocolo)))
    .map(comAcao);

  const linhas = $("#cl-linhas");
  function mostrarHistorico(novo = null) {
    linhas.innerHTML = historico
      .map((h) => {
        const st = STATUS[h.status];
        return `<tr class="${h === novo ? "cl-nova-linha" : ""}">
          <td><strong class="cl-protocolo-cel">${esc(h.protocolo)}</strong><small>${esc(h.data)}</small></td>
          <td><strong>${esc(h.origem)}</strong><small>${esc(h.doca)}</small></td>
          <td><strong>${esc(h.veiculo)}</strong><small>${esc(h.motorista)}</small></td>
          <td class="cl-volume">${esc(h.vol)} ·<br>${esc(milhar(h.kg))} kg</td>
          <td><span class="cl-status ${st.classe}">${ICONES_STATUS[st.icone]}${esc(st.texto)}</span></td>
          <td class="cl-acao">${
            h.acao.href
              ? `<a href="${esc(h.acao.href)}">${esc(h.acao.texto)}</a>`
              : `<button type="button" data-detalhe="${esc(h.protocolo)}">${esc(h.acao.texto)}</button>`
          }</td>
        </tr>`;
      })
      .join("");
  }

  linhas.addEventListener("click", (e) => {
    const b = e.target.closest("[data-detalhe]");
    if (b)
      avisar(b.dataset.detalhe, "A Torre de Controle está alocando o veículo. Você recebe o motorista e a placa em instantes.");
  });

  /* ---------------- coletas confirmadas (guardadas neste navegador) ---------------- */
  const CHAVE_COLETAS = "velozlog:coletas"; // a mesma lida pelo /js/manifestos.js
  function lerColetas() {
    try {
      const l = JSON.parse(localStorage.getItem(CHAVE_COLETAS) || "[]");
      return Array.isArray(l) ? l : [];
    } catch {
      return [];
    }
  }
  function guardarColeta(c) {
    try {
      localStorage.setItem(CHAVE_COLETAS, JSON.stringify([{ ...c, criada: Date.now() }, ...lerColetas()].slice(0, 20)));
    } catch {
      /* sem armazenamento: fica só nesta visita */
    }
  }

  /* ---------------- confirmar ---------------- */
  const botaoConfirmar = $("#cl-confirmar");
  const rotuloConfirmar = $("span", botaoConfirmar);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (confirmado) return;

    const invalidos = Object.keys(REGRAS).filter((nome) => !REGRAS[nome]());
    Object.keys(REGRAS).forEach((nome) => mostrarErro(nome, invalidos.includes(nome)));
    if (!notas.length) erroNota("Vincule ao menos uma NF-e (XML ou chave de acesso).");

    if (invalidos.length || !notas.length) {
      const primeiro = invalidos.length ? campos[invalidos[0]] : campoChave;
      primeiro.focus({ preventScroll: true });
      const topo = primeiro.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: topo, behavior: reduzMovimento ? "auto" : "smooth" });
      return;
    }

    botaoConfirmar.disabled = true;
    botaoConfirmar.classList.add("cl-carregando");
    rotuloConfirmar.textContent = "Alocando frota…";

    setTimeout(() => {
      const p = planta();
      const numero = 8841 + historico.filter((h) => h.status === "alocacao").length + 1;
      const protocolo = `COL-${ANO}-${numero}`;
      const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const nova = {
        protocolo,
        data: `Hoje, ${agora}`,
        origem: p.curto,
        doca: p.doca,
        veiculo: veiculoIndicado(pesoKg(), volumes()),
        motorista: "Alocação em andamento",
        vol: `${volumes()} ${UNIDADES[acond()].curta}`,
        kg: pesoKg(),
        status: "alocacao",
        acao: { texto: "Acompanhar", href: rastreioDe(protocolo) },
      };
      historico.unshift(nova);
      mostrarHistorico(nova);
      guardarColeta(nova); // aparece de novo ao voltar e conta em "Coletas agendadas" da Visão Geral

      confirmado = true;
      marcarEtapas();
      $("#cl-protocolo-numero").textContent = protocolo;
      $("#cl-protocolo").hidden = false;
      botaoConfirmar.hidden = true;
      $("#cl-rascunho").hidden = true;
      botaoConfirmar.disabled = false;
      botaoConfirmar.classList.remove("cl-carregando");
      rotuloConfirmar.textContent = "Confirmar Agendamento de Coleta";
      try {
        localStorage.removeItem(CHAVE_RASCUNHO);
      } catch {
        /* ignora */
      }
      avisar("Coleta agendada", `Protocolo ${protocolo} • ${chegada()}. Acompanhe pelo histórico abaixo.`);
    }, 900);
  });

  $("#cl-nova").addEventListener("click", () => {
    confirmado = false;
    etapaAtual = 1;
    $("#cl-protocolo").hidden = true;
    botaoConfirmar.hidden = false;
    $("#cl-rascunho").hidden = false;
    notas = [];
    mostrarNotas();
    const topo = $("#cl-secao-1").getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: topo, behavior: reduzMovimento ? "auto" : "smooth" });
  });

  /* ---------------- rascunho ---------------- */
  function lerFormulario() {
    return {
      planta: campos.planta.value,
      data: $('input[name="data"]:checked').value,
      janela: campos.janela.value,
      responsavel: campos.responsavel.value,
      telefone: campos.telefone.value,
      acond: acond(),
      volumes: campos.volumes.value,
      peso: campos.peso.value,
      notas,
      plataforma: form.elements.plataforma.checked,
      ajudante: form.elements.ajudante.checked,
      escolta: form.elements.escolta.checked,
    };
  }

  function aplicarFormulario(r) {
    if ([...campos.planta.options].some((o) => o.value === r.planta)) campos.planta.value = r.planta;
    const data = $(`input[name="data"][value="${r.data}"]`);
    if (data) data.checked = true;
    if ([...campos.janela.options].some((o) => o.value === r.janela)) campos.janela.value = r.janela;
    campos.responsavel.value = r.responsavel || "";
    campos.telefone.value = r.telefone || "";
    const ac = $(`input[name="acond"][value="${r.acond}"]`);
    if (ac) ac.checked = true;
    campos.volumes.value = r.volumes || "";
    campos.peso.value = r.peso || "";
    notas = Array.isArray(r.notas) ? r.notas : [];
    ["plataforma", "ajudante", "escolta"].forEach((n) => (form.elements[n].checked = !!r[n]));
  }

  $("#cl-rascunho").addEventListener("click", () => {
    try {
      localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify(lerFormulario()));
      avisar("Rascunho salvo", "Ao voltar para esta tela, a solicitação continua de onde parou.");
    } catch {
      avisar("Rascunho", "Não foi possível salvar neste navegador.");
    }
  });

  /* ---------------- ajuda ---------------- */
  // mesmo canal dos outros "Chamar" do site: WhatsApp do gestor de conta
  $("#cl-chamar").addEventListener("click", (e) => {
    const texto = `Olá, Tatiane! Sou da ${EMPRESA} e tenho uma dúvida de cubagem na coleta da ${planta().curto} (${volumes() || 0} ${UNIDADES[acond()].curta}, ${milhar(pesoKg())} kg).`;
    if (window.VelozWhatsApp) window.VelozWhatsApp.conversar(texto, e.currentTarget);
    else avisar("Gestor de conta", "Fale com a Tatiane Moreira: 0800 700 8900, ramal 9099.");
  });

  /* ---------------- início ---------------- */
  let restaurou = false;
  try {
    const salvo = localStorage.getItem(CHAVE_RASCUNHO);
    if (salvo) {
      aplicarFormulario(JSON.parse(salvo));
      restaurou = true;
    }
  } catch {
    /* sem rascunho */
  }

  // veio da cotação ("Contratar Coleta Imediata"): já traz volumes e peso
  const daCotacao = new URLSearchParams(location.search);
  const vCot = parseInt(daCotacao.get("v"), 10);
  const pCot = parseFloat(daCotacao.get("p"));
  if (!restaurou && vCot >= 1 && pCot > 0) {
    campos.volumes.value = Math.min(vCot, 60);
    campos.peso.value = milhar(Math.ceil(pCot));
    const caixas = $('input[name="acond"][value="caixas"]');
    if (caixas) caixas.checked = true;
    setTimeout(() => avisar("Dados da cotação aplicados", "Volumes e peso vieram da sua cotação. Agora vincule as NF-e e confirme."), 400);
  }

  // coletas já confirmadas neste navegador continuam no histórico
  const salvas = window.VelozManifestos ? window.VelozManifestos.coletasSolicitadas() : lerColetas();
  const hojeTexto = new Date().toDateString();
  salvas.forEach((c) => {
    // "Hoje, 14:20" só vale no mesmo dia; depois mostra a data
    if (c.criada && new Date(c.criada).toDateString() !== hojeTexto) {
      const d = new Date(c.criada);
      c.data = `${d.toLocaleDateString("pt-BR")}, ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    }
  });
  historico.unshift(...salvas.map(comAcao)); // "Acompanhar" abre o rastreio da coleta

  mostrarNotas();
  mostrarHistorico();
  if (restaurou) setTimeout(() => avisar("Rascunho restaurado", "Continuamos a solicitação que você salvou."), 400);
})();
