/* VelozLog — página de cotação (frete.html)
   Modal "Editar Parâmetros da Carga" + recálculo dinâmico de resumo e tarifas. */
(() => {
  "use strict";

  /* ================= CONFIGURAÇÃO ================= */
  const FATOR_CUBAGEM = 300; // kg por m³ (padrão rodoviário)
  const GRIS_POR_MIL = 1; // 0,1% do valor da NF
  const SEGURO_POR_MIL = 3; // 0,3% do valor da NF
  const DESCONTO_PERCENTUAL = 5; // desconto corporativo
  const DESCONTO_PIX_PERCENTUAL = 1.5; // extra para pagamento via PIX (sobre o valor já com desconto corporativo)

  // Valores derivados dos números da tela (45 kg, NF R$ 15.000).
  // Quando tiver a tabela real de preços, é só trocar aqui.
  const MODALIDADES = {
    express: { nome: "Express", porKg: 6.4444, minimo: 120, pedagio: 34.5 },
    fracionada: {
      nome: "Fracionada",
      porKg: 3.4111,
      minimo: 80,
      pedagio: 34.5,
    },
    dedicado: { nome: "Dedicado", porKg: 17.6778, minimo: 450, pedagio: 34.5 },
  };
  const ROTA_PADRAO = { origem: "São Paulo", destino: "Curitiba" };

  /* ================= ESTADO ================= */
  const estado = {
    origem: { cep: "01000-000", cidade: "São Paulo", uf: "SP" },
    destino: { cep: "80010-000", cidade: "Curitiba", uf: "PR" },
    peso: 45,
    volumes: 4,
    dims: [40, 30, 30], // A x L x P (cm)
    nf: 15000,
    tipo: "manufaturados",
  };

  /* ================= UTILITÁRIOS ================= */
  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const brl = (centavos) =>
    (centavos / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  const numero = (n, casas = 2) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
  const soDigitos = (t) => String(t).replace(/\D/g, "");
  const formatarCep = (t) => {
    const d = soDigitos(t).slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };
  const formatarMoeda = (t) => {
    const d = soDigitos(t).slice(0, 12);
    return d
      ? (parseInt(d, 10) / 100).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "";
  };
  const lerMoeda = (t) => parseInt(soDigitos(t) || "0", 10) / 100;
  const lerPeso = (t) =>
    parseFloat(String(t).replace(/\./g, "").replace(",", "."));
  const pesoTexto = (n) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // máscara das dimensões: "40 x 30 x 30" (até 3 dígitos por medida).
  // Digite os números e use espaço, "x" ou vírgula para passar para a próxima medida.
  function formatarDimensoes(texto, apagando) {
    const grupos = [""];
    let pendente = false; // acabou de digitar um separador
    for (const c of String(texto)) {
      if (/\d/.test(c)) {
        if (grupos[grupos.length - 1].length === 3) {
          if (grupos.length === 3) break;
          grupos.push("");
        }
        grupos[grupos.length - 1] += c;
        pendente = false;
      } else if (grupos[grupos.length - 1] && grupos.length < 3) {
        grupos.push("");
        pendente = true;
      }
    }
    let saida = grupos
      .filter((g, i) => g || i === grupos.length - 1)
      .join(" x ");
    if (grupos[grupos.length - 1] === "" && (apagando || !pendente)) {
      saida = grupos.slice(0, -1).join(" x ");
    }
    return saida;
  }
  const lerDimensoes = (t) =>
    (String(t).match(/\d+(?:[.,]\d+)?/g) || []).map((v) =>
      parseFloat(v.replace(",", ".")),
    );

  /* ================= CÁLCULOS ================= */
  function pagamentoAtual() {
    const marcado = $('input[name="pagamento"]:checked');
    return marcado ? marcado.value : "faturado";
  }

  function pesoTributavel(e) {
    const [c, a, l] = e.dims;
    const cubado = ((c * a * l * e.volumes) / 1e6) * FATOR_CUBAGEM;
    return Math.max(e.peso, cubado); // vale o maior entre peso real e cubado
  }

  function calcular(m, e) {
    const peso = pesoTributavel(e);
    const nfCentavos = Math.round(e.nf * 100);
    const frete = Math.round(Math.max(m.minimo, peso * m.porKg) * 100);
    const gris = Math.round((nfCentavos * GRIS_POR_MIL) / 1000);
    const seguro = Math.round((nfCentavos * SEGURO_POR_MIL) / 1000);
    const pedagio = Math.round(m.pedagio * 100);
    const total = frete + gris + seguro + pedagio;
    const desconto = Math.floor((total * DESCONTO_PERCENTUAL) / 100);
    const pix =
      pagamentoAtual() === "pix"
        ? Math.floor(((total - desconto) * DESCONTO_PIX_PERCENTUAL) / 100)
        : 0;
    return {
      peso,
      frete,
      gris,
      seguro,
      pedagio,
      total,
      desconto,
      pix,
      final: total - desconto - pix,
    };
  }

  /* ================= TELA ================= */
  function destacar(el) {
    el.classList.remove("fr-flash");
    void el.offsetWidth; // reinicia a animação
    el.classList.add("fr-flash");
    el.addEventListener("animationend", () => el.classList.remove("fr-flash"), {
      once: true,
    });
  }
  function definir(seletor, texto, animar) {
    const el = $(seletor);
    if (!el) return;
    if (el.textContent !== texto) {
      el.textContent = texto;
      if (animar) destacar(el);
    }
  }
  const local = (p) =>
    p.cidade ? `${p.cidade} • ${p.uf}` : "Cidade não identificada";

  function renderResumo(animar) {
    const opcao = $(`#p-tipo option[value="${estado.tipo}"]`);
    definir("#r-origem-cidade", local(estado.origem), animar);
    definir("#r-origem-cep", `CEP ${estado.origem.cep}`, animar);
    definir("#r-destino-cidade", local(estado.destino), animar);
    definir("#r-destino-cep", `CEP ${estado.destino.cep}`, animar);
    definir("#r-peso", `${numero(pesoTributavel(estado))} kg`, animar);
    definir(
      "#r-volumes",
      `${estado.volumes} ${estado.volumes === 1 ? "caixa" : "caixas"}`,
      animar,
    );
    definir("#r-nf", brl(Math.round(estado.nf * 100)), animar);
    definir("#r-tipo", opcao ? opcao.dataset.resumo : "—", animar);

    // rota e mapa
    const padrao =
      estado.origem.cidade === ROTA_PADRAO.origem &&
      estado.destino.cidade === ROTA_PADRAO.destino;
    definir(
      "#r-distancia",
      padrao ? "400 km via BR-116" : "Distância sob consulta",
      animar,
    );
    const sub = $(".fr-mapa-sub");
    if (sub) sub.style.display = padrao ? "" : "none";
    const legenda = $(".fr-mapa-legenda");
    if (legenda) legenda.style.display = padrao ? "" : "none";
    if (estado.origem.cidade && estado.destino.cidade) {
      definir(
        ".fr-nota",
        padrao
          ? "Tarifas negociadas para o corredor industrial SP → PR com gestão integrada."
          : `Tarifas negociadas para a rota ${estado.origem.cidade} → ${estado.destino.cidade} com gestão integrada.`,
      );
      definir(
        ".fr-mapa h3",
        `Mapa Operacional da Rota: ${estado.origem.cidade} → ${estado.destino.cidade}`,
      );
      const textos = document.querySelectorAll(".fr-mapa-area svg text");
      if (textos.length >= 2) {
        textos[0].textContent = estado.origem.cidade;
        textos[1].textContent = estado.destino.cidade;
      }
    }
  }

  function renderTarifas(animar) {
    const marcada = $('input[name="modalidade"]:checked');
    const selecionada = marcada ? marcada.value : "express";

    for (const [id, m] of Object.entries(MODALIDADES)) {
      const t = calcular(m, estado);
      const entrada = $(`input[name="modalidade"][value="${id}"]`);
      const card = entrada && entrada.closest(".fr-modal");
      if (card) {
        const preco = $(".fr-modal-preco strong", card);
        const novo = brl(t.total);
        if (preco.textContent !== novo) {
          preco.textContent = novo;
          if (animar) destacar(preco);
        }
        if (id === "express") {
          const cheio = Math.round((t.total * 420) / 384.5);
          const riscado = $(".fr-modal-preco s", card);
          const economia = $(".fr-economia", card);
          if (riscado) riscado.textContent = brl(cheio);
          if (economia)
            economia.textContent = `Você economiza ${brl(cheio - t.total)}`;
        }
      }

      if (id === selecionada) {
        const kg = t.peso.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
        definir("#linhas-tarifa li span", `Frete Peso / Cubagem (${kg}kg)`);
        definir("#v-frete", brl(t.frete), animar);
        definir("#v-gris", brl(t.gris), animar);
        definir("#v-seguro", brl(t.seguro), animar);
        definir("#v-pedagio", brl(t.pedagio), animar);
        definir("#v-total", brl(t.total), animar);
        definir("#v-desconto", `– ${brl(t.desconto)}`, animar);
        const linhaPix = $("#linha-pix");
        if (linhaPix) linhaPix.hidden = t.pix === 0;
        definir("#v-pix", `– ${brl(t.pix)}`, animar);
        definir("#v-final", brl(t.final), animar);
        definir(".fr-painel-topo .fr-selo", m.nome);
      }
    }
  }

  function renderTudo(animar) {
    renderResumo(animar);
    renderTarifas(animar);
    if (animar)
      definir(".fr-status-info span:nth-child(2)", "Recalculada agora");
  }

  /* ================= CEP (ViaCEP) ================= */
  const cacheCep = new Map();
  function buscarCep(cep) {
    if (!cacheCep.has(cep)) {
      cacheCep.set(
        cep,
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) =>
            d && !d.erro ? { cidade: d.localidade, uf: d.uf } : { erro: true },
          )
          .catch(() => {
            cacheCep.delete(cep);
            return { offline: true };
          }),
      );
    }
    return cacheCep.get(cep);
  }

  function consultarCep(lado) {
    const campo = $(`#p-cep-${lado}`);
    const dica = $(`#d-cep-${lado}`);
    const cep = soDigitos(campo.value);
    if (cep.length !== 8) {
      dica.textContent = "";
      return;
    }
    dica.textContent = "Buscando cidade…";
    buscarCep(cep).then((r) => {
      if (soDigitos(campo.value) !== cep) return; // o usuário já mudou o CEP
      dica.textContent = r.cidade
        ? `${r.cidade}, ${r.uf}`
        : r.erro
          ? "CEP não encontrado"
          : "Não foi possível consultar a cidade";
    });
  }

  // trocar a condição de pagamento recalcula o total faturado
  const blocoPagamento = $(".fr-pagamento");
  if (blocoPagamento)
    blocoPagamento.addEventListener("change", () => renderTarifas(true));

  /* ================= COMPARTILHAR / PROPOSTA EM PDF ================= */
  const esc = (t) =>
    String(t).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const dataHora = (d) =>
    `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  function dadosProposta() {
    const marcada = $('input[name="modalidade"]:checked');
    const selId = marcada ? marcada.value : "express";
    const pag = $('input[name="pagamento"]:checked');
    const pagamento = pag
      ? pag
          .closest(".fr-pag")
          .querySelector("span")
          .textContent.replace(/\s+/g, " ")
          .trim()
      : "—";

    const modalidades = Object.entries(MODALIDADES).map(([id, m]) => {
      const card = $(`input[name="modalidade"][value="${id}"]`).closest(
        ".fr-modal",
      );
      return {
        id,
        nome: $("h2", card).childNodes[0].textContent.trim(),
        prazo: $(".fr-modal-prazo strong", card).textContent.trim(),
        etiquetas: [...card.querySelectorAll(".fr-modal-etiquetas span")].map(
          (x) => x.textContent.trim(),
        ),
        itens: [...card.querySelectorAll(".fr-modal-itens li")].map((x) =>
          x.textContent.trim(),
        ),
        t: calcular(m, estado),
        selecionada: id === selId,
      };
    });
    const escolhida = modalidades.find((m) => m.selecionada);
    const emissao = new Date();
    const validade = new Date(emissao.getTime() + 72 * 3600 * 1000);
    const opcaoTipo = $(`#p-tipo option[value="${estado.tipo}"]`);

    return {
      numero: ($(".fr-status-info .fr-tag") || { textContent: "" }).textContent
        .replace("Cotação", "")
        .trim(),
      emissao: dataHora(emissao),
      validade: dataHora(validade),
      distancia: ($("#r-distancia") || { textContent: "" }).textContent,
      tipo: opcaoTipo ? opcaoTipo.textContent.trim() : "—",
      pagamento,
      modalidades,
      escolhida,
    };
  }

  function resumoTexto() {
    const d = dadosProposta();
    const e = d.escolhida;
    return [
      `Cotação de frete VelozLog ${d.numero}`,
      `Rota: ${local(estado.origem)} (CEP ${estado.origem.cep}) → ${local(estado.destino)} (CEP ${estado.destino.cep})`,
      `Carga: ${numero(pesoTributavel(estado))} kg tributáveis, ${estado.volumes} ${estado.volumes === 1 ? "volume" : "volumes"}, NF ${brl(Math.round(estado.nf * 100))}`,
      `Modalidade: ${e.nome}`,
      `Prazo: ${e.prazo}`,
      `Valor do frete: ${brl(e.t.total)} | Total faturado: ${brl(e.t.final)}${e.t.pix ? " (com desconto PIX)" : ""}`,
      `Pagamento: ${d.pagamento}`,
      `Válida até ${d.validade}.`,
    ].join("\n");
  }

  function montarProposta() {
    const d = dadosProposta();
    const e = d.escolhida;
    const [a, l, p] = estado.dims;
    const linhasMod = d.modalidades
      .map(
        (m) => `
        <tr class="${m.selecionada ? "pp-sel" : ""}">
          <td><strong>${esc(m.nome)}</strong>${m.selecionada ? '<span class="pp-tag">SELECIONADA</span>' : ""}
            <small>${esc(m.etiquetas.join(" · "))}</small></td>
          <td>${esc(m.prazo)}</td>
          <td class="pp-dir"><span class="pp-preco">${brl(m.t.total)}</span></td>
        </tr>`,
      )
      .join("");

    $("#proposta-print").innerHTML = `
      <header class="pp-topo">
        <img src="/img/logo.svg" alt="VelozLog Transportes &amp; Logística">
        <div class="pp-doc">
          <h1>Proposta Comercial de Frete</h1>
          <div class="pp-num">Cotação ${esc(d.numero)}</div>
          <p>Emitida em ${esc(d.emissao)} · Válida até ${esc(d.validade)} (72 horas)</p>
        </div>
      </header>

      <section class="pp-secao">
        <h2>Rota</h2>
        <div class="pp-rota">
          <div class="pp-ponto"><small>ORIGEM</small><strong>${esc(local(estado.origem))}</strong><em>CEP ${esc(estado.origem.cep)}</em></div>
          <div class="pp-seta"><b>→</b>${esc(d.distancia)}</div>
          <div class="pp-ponto"><small>DESTINO</small><strong>${esc(local(estado.destino))}</strong><em>CEP ${esc(estado.destino.cep)}</em></div>
        </div>
      </section>

      <section class="pp-secao">
        <h2>Dados da carga</h2>
        <div class="pp-grade">
          <div><small>Peso bruto</small><strong>${esc(pesoTexto(estado.peso))} kg</strong></div>
          <div><small>Peso tributável</small><strong>${esc(numero(pesoTributavel(estado)))} kg</strong></div>
          <div><small>Volumes</small><strong>${estado.volumes}</strong></div>
          <div><small>Dimensões (A x L x P)</small><strong>${a} x ${l} x ${p} cm</strong></div>
          <div><small>Valor da NF declarada</small><strong>${brl(Math.round(estado.nf * 100))}</strong></div>
          <div><small>Tipo de mercadoria</small><strong>${esc(d.tipo)}</strong></div>
        </div>
      </section>

      <section class="pp-secao">
        <h2>Modalidades cotadas</h2>
        <table class="pp-tabela">
          <thead><tr><th>Modalidade</th><th>Previsão de entrega</th><th class="pp-dir">Valor do frete</th></tr></thead>
          <tbody>${linhasMod}</tbody>
        </table>
      </section>

      <section class="pp-secao">
        <h2>Composição da tarifa · ${esc(e.nome)}</h2>
        <div class="pp-linhas">
          <div><span>Frete peso / cubagem (${esc(e.t.peso.toLocaleString("pt-BR", { maximumFractionDigits: 2 }))} kg)</span><strong>${brl(e.t.frete)}</strong></div>
          <div><span>GRIS (Gerenciamento de Risco)</span><strong>${brl(e.t.gris)}</strong></div>
          <div><span>Seguro RCTR-C / RCF-DC (100%)</span><strong>${brl(e.t.seguro)}</strong></div>
          <div><span>Pedágios &amp; taxas de despacho</span><strong>${brl(e.t.pedagio)}</strong></div>
        </div>
        <div class="pp-totais">
          <div><span>Valor total do frete</span><strong>${brl(e.t.total)}</strong></div>
          <div class="pp-desc"><span>Desconto corporativo (${DESCONTO_PERCENTUAL}%)</span><strong>– ${brl(e.t.desconto)}</strong></div>
          ${e.t.pix ? `<div class="pp-desc"><span>Desconto PIX (${DESCONTO_PIX_PERCENTUAL.toString().replace(".", ",")}%)</span><strong>– ${brl(e.t.pix)}</strong></div>` : ""}
          <div class="pp-final"><span>Total faturado</span><strong>${brl(e.t.final)}</strong></div>
          <div class="pp-pag"><span>Condição de pagamento</span><strong>${esc(d.pagamento)}</strong></div>
        </div>
        <ul class="pp-inclusos">${e.itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>
      </section>

      <section class="pp-secao">
        <h2>Condições gerais</h2>
        <ul class="pp-notas">
          <li>Proposta válida por 72 horas, até ${esc(d.validade)}.</li>
          <li>Valores calculados com base nos dados informados; peso e cubagem serão conferidos na coleta e podem ajustar o valor final.</li>
          <li>Seguro RCTR-C e RCF-DC calculado sobre o valor da NF declarada.</li>
          <li>Carga monitorada por central de risco 24h, com averbação automática do seguro a cada embarque.</li>
        </ul>
      </section>

      <footer class="pp-rodape">
        <div><strong>VelozLog Transportes e Logística Ltda.</strong>CNPJ: 14.890.342/0001-90</div>
        <div><strong>Matriz &amp; Suporte</strong>Rodovia Presidente Dutra, KM 218 – Cumbica<br>Guarulhos – SP, CEP 07178-580</div>
        <div><strong>Contato</strong>Central 24h: 0800 700 8900<br>atendimento@velozlog.com.br</div>
      </footer>`;
  }

  function gerarPDF() {
    const comp = $("#modal-compartilhar");
    if (comp && comp.open) comp.close();
    montarProposta();

    const tituloOriginal = document.title;
    const numeroCotacao = dadosProposta().numero.replace("#", "");
    document.title = `Proposta-${numeroCotacao}-VelozLog`; // vira o nome sugerido do arquivo
    const restaurar = () => {
      document.title = tituloOriginal;
      window.removeEventListener("afterprint", restaurar);
    };
    window.addEventListener("afterprint", restaurar);

    // espera o logo carregar para ele aparecer no PDF
    const logo = $("#proposta-print img");
    const pronto =
      logo && !logo.complete
        ? new Promise((ok) => {
            logo.onload = logo.onerror = ok;
            setTimeout(ok, 1500);
          })
        : Promise.resolve();
    pronto.then(() => window.print());
  }

  /* ---------- WhatsApp: mensagem com emojis + proposta em PDF (arquivo) ---------- */
  const HTML2PDF_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js";
  let html2pdfCarregando = null;

  // carrega a biblioteca que transforma a proposta em PDF (só quando precisa)
  function carregarHtml2pdf() {
    if (window.html2pdf) return Promise.resolve();
    if (!html2pdfCarregando) {
      html2pdfCarregando = new Promise((ok, falha) => {
        const s = document.createElement("script");
        s.src = HTML2PDF_URL;
        s.onload = ok;
        s.onerror = () => {
          html2pdfCarregando = null;
          falha(new Error("Não carregou o html2pdf"));
        };
        document.head.appendChild(s);
      });
    }
    return html2pdfCarregando;
  }

  // texto que vai no WhatsApp (*negrito* e _itálico_ são do próprio WhatsApp)
  // emojis escritos como código (\u{...}) para não quebrarem por causa da codificação do arquivo
  const EMOJI = {
    caminhao: "\u{1F69A}", // 🚚
    mao: "\u{1F44B}", // 👋
    origem: "\u{1F4CD}", // 📍
    chegada: "\u{1F3C1}", // 🏁
    caixa: "\u{1F4E6}", // 📦
    nota: "\u{1F9FE}", // 🧾
    foguete: "\u{1F680}", // 🚀
    calendario: "\u{1F4C5}", // 📅
    dinheiro: "\u{1F4B0}", // 💰
    cartao: "\u{1F4B3}", // 💳
    escudo: "\u{1F6E1}\u{FE0F}", // 🛡️
    satelite: "\u{1F4E1}", // 📡
    ampulheta: "\u{23F3}", // ⏳
    documento: "\u{1F4C4}", // 📄
    seta: "\u{1F447}", // 👇
    check: "\u{2705}", // ✅
  };

  // texto que vai no WhatsApp (*negrito* e _itálico_ são do próprio WhatsApp)
  function mensagemWhats() {
    const d = dadosProposta();
    const e = d.escolhida;
    const volumes = `${estado.volumes} ${estado.volumes === 1 ? "volume" : "volumes"}`;
    const linha = "\u2501".repeat(16); // ━━━━━━━━━━━━━━━━
    return [
      `${EMOJI.caminhao} *VelozLog | Cotação de Frete*`,
      `*${d.numero}*`,
      linha,
      `Olá! ${EMOJI.mao} Aqui está a cotação do seu frete:`,
      "",
      `${EMOJI.origem} *Origem:* ${local(estado.origem)}`,
      `${EMOJI.chegada} *Destino:* ${local(estado.destino)}`,
      `${EMOJI.caixa} *Carga:* ${numero(pesoTributavel(estado))} kg · ${volumes}`,
      `${EMOJI.nota} *Valor da NF:* ${brl(Math.round(estado.nf * 100))}`,
      "",
      `${EMOJI.foguete} *Modalidade:* ${e.nome}`,
      `${EMOJI.calendario} *Prazo:* ${e.prazo}`,
      linha,
      `${EMOJI.dinheiro} *TOTAL: ${brl(e.t.final)}*${e.t.pix ? " _(com desconto PIX)_" : ""}`,
      `${EMOJI.cartao} *Pagamento:* ${d.pagamento}`,
      linha,
      `${EMOJI.escudo} Seguro RCTR-C incluso`,
      `${EMOJI.satelite} Rastreamento 24h em tempo real`,
      `${EMOJI.ampulheta} Válida até ${d.validade}`,
      "",
      `${EMOJI.documento} Logo abaixo envio a *proposta completa em PDF* ${EMOJI.seta}`,
      "",
      `_VelozLog · Segurança e visibilidade em cada quilômetro_ ${EMOJI.check}`,
    ].join("\n");
  }

  // gera o PDF da proposta como ARQUIVO (mesmo conteúdo do "Baixar proposta em PDF")
  async function gerarArquivoPDF() {
    await carregarHtml2pdf();
    montarProposta();

    const copia = document.createElement("div");
    copia.className = "pp-arquivo";
    copia.innerHTML = $("#proposta-print").innerHTML;

    // espera o logo carregar para ele sair no PDF
    await new Promise((ok) => {
      const img = new Image();
      img.onload = img.onerror = ok;
      img.src = "/img/logo.svg";
      setTimeout(ok, 1500);
    });

    const nome = `Proposta-${dadosProposta().numero.replace("#", "")}-VelozLog.pdf`;
    const pdf = await window
      .html2pdf()
      .set({
        margin: [10, 12, 14, 12], // mesmas margens do @page
        filename: nome,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".pp-secao", "tr"] },
      })
      .from(copia)
      .toPdf()
      .get("pdf");

    // "Página X de Y" no rodapé, igual à impressão
    const total = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Página ${i} de ${total}`, 198, 289, { align: "right" });
    }

    const blob = pdf.output("blob");
    return {
      blob,
      nome,
      arquivo: new File([blob], nome, { type: "application/pdf" }),
    };
  }

  // o PDF começa a ser preparado quando o modal abre, para o envio sair na hora
  let pdfPronto = null;
  function prepararPDF() {
    pdfPronto = gerarArquivoPDF().catch((erro) => {
      console.error("frete.js: não gerou o PDF", erro);
      pdfPronto = null;
      return null;
    });
    return pdfPronto;
  }

  function baixarBlob(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // WhatsApp em 2 passos:
  //   1º toque → abre o WhatsApp com a mensagem (emojis) para enviar
  //   2º toque → envia o PDF da proposta em anexo na mesma conversa
  let passoWhats = 1;

  function textoBotaoWhats(botao, titulo, legenda) {
    $("strong", botao).textContent = titulo;
    $("small", botao).textContent = legenda;
  }

  function reiniciarWhats() {
    passoWhats = 1;
    const botao = $("#comp-whats");
    if (!botao) return;
    botao.disabled = false;
    botao.classList.remove("fr-opcao-destaque");
    textoBotaoWhats(botao, "Enviar por WhatsApp", "Mensagem + proposta em PDF");
  }

  async function enviarWhats(botao) {
    // ---- 1º passo: mensagem com emojis ----
    if (passoWhats === 1) {
      const texto = mensagemWhats();
      // cópia de segurança: se algum emoji vier quebrado, é só apagar e colar (Ctrl+V)
      if (navigator.clipboard)
        navigator.clipboard.writeText(texto).catch(() => {});
      // api.whatsapp.com direto (o wa.me redireciona e às vezes estraga os emojis)
      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`,
        "_blank",
        "noopener",
      );
      passoWhats = 2;
      if (!pdfPronto) prepararPDF(); // o PDF vai sendo montado enquanto isso
      botao.classList.add("fr-opcao-destaque");
      textoBotaoWhats(
        botao,
        "2º passo: enviar o PDF da proposta",
        "Toque aqui e escolha a mesma conversa",
      );
      return;
    }

    // ---- 2º passo: PDF em anexo ----
    botao.disabled = true;
    textoBotaoWhats(botao, "Preparando o PDF…", "Só um instante");
    const pdf = await (pdfPronto || prepararPDF());
    botao.disabled = false;

    if (!pdf) {
      textoBotaoWhats(
        botao,
        "Não consegui montar o PDF",
        "Toque para tentar de novo",
      );
      pdfPronto = null;
      return;
    }

    // celular (e Windows com WhatsApp instalado): menu de compartilhar só com o PDF
    if (navigator.canShare && navigator.canShare({ files: [pdf.arquivo] })) {
      try {
        await navigator.share({ files: [pdf.arquivo] });
        textoBotaoWhats(
          botao,
          "PDF enviado ✔",
          "Mensagem e proposta compartilhadas",
        );
        setTimeout(reiniciarWhats, 3000);
      } catch (erro) {
        if (erro.name === "NotAllowedError") {
          // o navegador pede um novo toque depois de montar o PDF
          textoBotaoWhats(
            botao,
            "PDF pronto! Toque de novo",
            "Para enviar na conversa",
          );
        } else {
          // fechou o menu sem escolher: continua no 2º passo
          textoBotaoWhats(
            botao,
            "2º passo: enviar o PDF da proposta",
            "Toque aqui e escolha a mesma conversa",
          );
        }
      }
      return;
    }

    // computador sem menu de compartilhar arquivo: baixa o PDF para anexar
    baixarBlob(pdf.blob, pdf.nome);
    textoBotaoWhats(
      botao,
      "PDF baixado ✔",
      "Arraste o arquivo para a conversa do WhatsApp",
    );
    setTimeout(reiniciarWhats, 6000);
  }

  const dialogComp = $("#modal-compartilhar");
  const botaoComp = $("#btn-compartilhar");
  if (dialogComp && botaoComp) {
    botaoComp.addEventListener("click", () => {
      dialogComp.showModal();
      reiniciarWhats();
      prepararPDF(); // já vai montando o PDF com os dados atuais
    });
    dialogComp
      .querySelector("[data-fechar-comp]")
      .addEventListener("click", () => dialogComp.close());

    $("#comp-pdf").addEventListener("click", gerarPDF);
    $("#comp-whats").addEventListener("click", (e) =>
      enviarWhats(e.currentTarget),
    );
    $("#comp-email").addEventListener("click", () => {
      const assunto = `Cotação de frete VelozLog ${dadosProposta().numero}`;
      location.href = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(resumoTexto())}`;
    });
    $("#comp-copiar").addEventListener("click", async () => {
      const titulo = $("#comp-copiar-titulo");
      try {
        await navigator.clipboard.writeText(resumoTexto());
        titulo.textContent = "Resumo copiado!";
      } catch {
        titulo.textContent = "Não foi possível copiar";
      }
      setTimeout(() => (titulo.textContent = "Copiar resumo"), 2000);
    });
    if (navigator.share) {
      const nativo = $("#comp-nativo");
      nativo.hidden = false;
      nativo.addEventListener("click", () => {
        navigator
          .share({
            title: `Cotação VelozLog ${dadosProposta().numero}`,
            text: resumoTexto(),
          })
          .catch(() => {});
      });
    }
  } else {
    console.error(
      "frete.js: faltam #btn-compartilhar ou #modal-compartilhar no HTML",
    );
  }
  const botaoPdf = $("#btn-pdf");
  if (botaoPdf) botaoPdf.addEventListener("click", gerarPDF);

  // mapa do Google (js/mapa.js): redesenha a rota com a origem e o destino atuais
  function atualizarMapa() {
    if (window.VelozMapa)
      window.VelozMapa.atualizar(estado.origem, estado.destino);
  }

  /* ================= MODAL ================= */
  const dialog = $("#modal-params");
  const form = $("#form-params");
  const botaoEditar = $("#btn-editar");

  if (!dialog || !form || !botaoEditar) {
    console.error("frete.js: faltam no HTML →", {
      "#modal-params": !!dialog,
      "#form-params": !!form,
      "#btn-editar": !!botaoEditar,
    });
    return;
  }

  function preencherForm() {
    $("#p-cep-origem").value = estado.origem.cep;
    $("#p-cep-destino").value = estado.destino.cep;
    $("#d-cep-origem").textContent = estado.origem.cidade
      ? `${estado.origem.cidade}, ${estado.origem.uf}`
      : "";
    $("#d-cep-destino").textContent = estado.destino.cidade
      ? `${estado.destino.cidade}, ${estado.destino.uf}`
      : "";
    $("#p-peso").value = pesoTexto(estado.peso);
    $("#p-volumes").value = estado.volumes;
    $("#p-dims").value = estado.dims.join(" x ");
    $("#p-nf").value = formatarMoeda(String(Math.round(estado.nf * 100)));
    $("#p-tipo").value = estado.tipo;
  }

  function marcarErro(id, mensagem) {
    const campo = $("#" + id);
    campo.setAttribute("aria-invalid", "true");
    campo.closest(".fr-campo").classList.add("tem-erro");
    $("#e-" + id).textContent = mensagem;
  }
  function limparErros() {
    form
      .querySelectorAll(".tem-erro")
      .forEach((c) => c.classList.remove("tem-erro"));
    form
      .querySelectorAll("[aria-invalid]")
      .forEach((c) => c.removeAttribute("aria-invalid"));
    form.querySelectorAll(".fr-erro").forEach((e) => (e.textContent = ""));
  }

  // abrir e fechar
  botaoEditar.addEventListener("click", () => {
    preencherForm();
    limparErros();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    $("#p-cep-origem").focus();
  });
  form
    .querySelectorAll("[data-fechar]")
    .forEach((b) => b.addEventListener("click", () => dialog.close()));
  // só fecha por "Cancelar" ou pelo X: Esc e clique no fundo não fecham
  dialog.addEventListener("cancel", (e) => e.preventDefault());
  dialog.addEventListener("keydown", (e) => {
    if (e.key === "Escape") e.preventDefault();
  });

  // máscaras
  $("#p-cep-origem").addEventListener("input", (e) => {
    e.target.value = formatarCep(e.target.value);
    consultarCep("origem");
  });
  $("#p-cep-destino").addEventListener("input", (e) => {
    e.target.value = formatarCep(e.target.value);
    consultarCep("destino");
  });
  $("#p-peso").addEventListener("input", (e) => {
    e.target.value = formatarMoeda(soDigitos(e.target.value).slice(0, 9));
  });
  $("#p-dims").addEventListener("input", (e) => {
    const apagando = (e.inputType || "").startsWith("delete");
    e.target.value = formatarDimensoes(e.target.value, apagando);
  });
  $("#p-volumes").addEventListener("input", (e) => {
    e.target.value = soDigitos(e.target.value).slice(0, 5).replace(/^0+/, "");
  });
  $("#p-nf").addEventListener("input", (e) => {
    e.target.value = formatarMoeda(e.target.value);
  });

  // some o erro do campo assim que o usuário volta a digitar
  form.addEventListener("input", (e) => {
    const campo = e.target.closest(".fr-campo");
    if (campo && campo.classList.contains("tem-erro")) {
      campo.classList.remove("tem-erro");
      e.target.removeAttribute("aria-invalid");
      const msg = $("#e-" + e.target.id);
      if (msg) msg.textContent = "";
    }
  });

  // salvar
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    limparErros();

    const cepO = soDigitos($("#p-cep-origem").value);
    const cepD = soDigitos($("#p-cep-destino").value);
    const peso = lerPeso($("#p-peso").value);
    const volumes = parseInt(soDigitos($("#p-volumes").value) || "0", 10);
    const dims = lerDimensoes($("#p-dims").value);
    const nf = lerMoeda($("#p-nf").value);

    const erros = [];
    const exigir = (id, falhou, mensagem) => {
      if (falhou) {
        marcarErro(id, mensagem);
        erros.push(id);
      }
    };

    exigir("p-cep-origem", cepO.length !== 8, "Informe um CEP com 8 dígitos");
    exigir("p-cep-destino", cepD.length !== 8, "Informe um CEP com 8 dígitos");
    exigir("p-peso", !(peso > 0), "Informe o peso em kg");
    exigir("p-volumes", !(volumes >= 1), "Informe ao menos 1 volume");
    exigir(
      "p-dims",
      !(dims.length === 3 && dims.every((v) => v > 0)),
      "Informe A x L x P, ex.: 40 x 30 x 30",
    );
    exigir("p-nf", !(nf > 0), "Informe o valor da NF");

    if (erros.length) {
      $("#" + erros[0]).focus();
      return;
    }

    const botao = $("#btn-salvar-params");
    botao.disabled = true;
    const [infoO, infoD] = await Promise.all([
      buscarCep(cepO),
      buscarCep(cepD),
    ]);
    botao.disabled = false;

    exigir("p-cep-origem", infoO.erro, "CEP não encontrado");
    exigir("p-cep-destino", infoD.erro, "CEP não encontrado");
    if (erros.length) {
      $("#" + erros[0]).focus();
      return;
    }

    estado.origem = {
      cep: formatarCep(cepO),
      cidade: infoO.cidade || null,
      uf: infoO.uf || null,
    };
    estado.destino = {
      cep: formatarCep(cepD),
      cidade: infoD.cidade || null,
      uf: infoD.uf || null,
    };
    estado.peso = peso;
    estado.volumes = volumes;
    estado.dims = dims;
    estado.nf = nf;
    estado.tipo = $("#p-tipo").value;

    dialog.close();
    renderTudo(true);
    atualizarMapa();
  });

  // trocar de modalidade atualiza a composição da tarifa
  const lista = $(".fr-modalidades");
  if (lista) lista.addEventListener("change", () => renderTarifas(false));

  /* ===== dados vindos do formulário da página inicial (frete.html?o=...&d=...&p=...&v=...&nf=...&t=...) ===== */
  function lerParametrosIniciais() {
    const q = new URLSearchParams(location.search);
    if (!q.has("o") && !q.has("d")) return null;
    const cepO = soDigitos(q.get("o") || "");
    const cepD = soDigitos(q.get("d") || "");
    const peso = parseFloat(q.get("p"));
    const volumes = parseInt(q.get("v"), 10);
    const nf = parseFloat(q.get("nf"));
    const tipo = q.get("t");
    return {
      cepO: cepO.length === 8 ? cepO : null,
      cepD: cepD.length === 8 ? cepD : null,
      peso: peso > 0 ? peso : null,
      volumes: volumes >= 1 ? volumes : null,
      nf: nf > 0 ? nf : null,
      tipo: tipo && $(`#p-tipo option[value="${tipo}"]`) ? tipo : null,
    };
  }

  async function iniciar() {
    const ini = lerParametrosIniciais();
    if (ini) {
      if (ini.peso) estado.peso = ini.peso;
      if (ini.volumes) estado.volumes = ini.volumes;
      if (ini.nf) estado.nf = ini.nf;
      if (ini.tipo) estado.tipo = ini.tipo;
      const [infoO, infoD] = await Promise.all([
        ini.cepO ? buscarCep(ini.cepO) : null,
        ini.cepD ? buscarCep(ini.cepD) : null,
      ]);
      if (ini.cepO && infoO)
        estado.origem = {
          cep: formatarCep(ini.cepO),
          cidade: infoO.cidade || null,
          uf: infoO.uf || null,
        };
      if (ini.cepD && infoD)
        estado.destino = {
          cep: formatarCep(ini.cepD),
          cidade: infoD.cidade || null,
          uf: infoD.uf || null,
        };
    }
    renderTudo(false);
    atualizarMapa();
  }
  iniciar();
})();
