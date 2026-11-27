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
  // acima disso não abrimos um campo por volume (a tela ficaria enorme): vira cotação corporativa
  const MAX_VOLUMES_DETALHADOS = 50;
  // true: cada volume paga pelo maior entre o SEU peso real e o SEU peso cubado (padrão de courier/expresso)
  // false: compara só os totais da carga (peso total x cubagem total)
  const CUBAGEM_POR_VOLUME = true;

  /* ================= ESTADO ================= */
  const estado = {
    origem: { cep: "01000-000", cidade: "São Paulo", uf: "SP" },
    destino: { cep: "80010-000", cidade: "Curitiba", uf: "PR" },
    peso: 45,
    volumes: 4,
    // uma medida [A, L, P] em cm para cada volume
    medidas: [
      [40, 30, 30],
      [40, 30, 30],
      [40, 30, 30],
      [40, 30, 30],
    ],
    // peso real (kg) de cada volume, na mesma ordem das medidas
    pesos: [11.25, 11.25, 11.25, 11.25],
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

  // volume total em m³ (soma de todos os volumes)
  const metrosCubicos = (medidas) =>
    medidas.reduce((soma, [a, l, p]) => soma + (a * l * p) / 1e6, 0);
  const pesoCubado = (medidas) => metrosCubicos(medidas) * FATOR_CUBAGEM;

  // peso real de cada volume (sem o detalhe, divide o total igualmente)
  function pesosReais(e) {
    const n = e.medidas.length;
    if (n === 1) return [e.peso];
    return e.pesos && e.pesos.length === n
      ? e.pesos
      : Array(n).fill(e.peso / n);
  }

  // detalhe por volume: real, cubado e o que vale (o maior dos dois)
  function detalheVolumes(e) {
    const reais = pesosReais(e);
    return e.medidas.map((m, i) => {
      const cubado = pesoCubado([m]);
      return {
        medida: m,
        real: reais[i],
        cubado,
        tributavel: Math.max(reais[i], cubado),
      };
    });
  }

  function pesoTributavel(e) {
    if (!e.medidas.length) return e.peso; // sem medidas, vale o peso real
    if (!CUBAGEM_POR_VOLUME) return Math.max(e.peso, pesoCubado(e.medidas));
    return detalheVolumes(e).reduce((soma, v) => soma + v.tributavel, 0);
  }

  // texto das dimensões para a proposta: iguais → "40 x 30 x 30 cm (cada)"; diferentes → cubagem total
  function dimensoesTexto(medidas) {
    if (!medidas.length) return "Não informadas";
    const primeira = medidas[0].join(" x ");
    const iguais = medidas.every((m) => m.join(" x ") === primeira);
    if (iguais) return `${primeira} cm${medidas.length > 1 ? " (cada)" : ""}`;
    return `Variadas · ${numero(metrosCubicos(medidas), 3)} m³ no total`;
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
    // linha de apoio: mostra de onde veio o tributável (real x cubado)
    definir(
      "#r-peso-detalhe",
      estado.medidas.length
        ? `Real ${numero(estado.peso)} kg · Cubado ${numero(pesoCubado(estado.medidas))} kg`
        : `Real ${numero(estado.peso)} kg · sem medidas`,
      animar,
    );
    const detalhe = $("#r-peso-detalhe");
    if (detalhe)
      detalhe.title = CUBAGEM_POR_VOLUME
        ? "Cada volume paga pelo maior entre o seu peso real e o seu peso cubado (300 kg/m³)"
        : "Vale o maior entre o peso real total e o peso cubado total (300 kg/m³)";
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
          <div><small>Dimensões (A x L x P)</small><strong>${esc(dimensoesTexto(estado.medidas))}</strong></div>
          <div><small>Valor da NF declarada</small><strong>${brl(Math.round(estado.nf * 100))}</strong></div>
          <div><small>Tipo de mercadoria</small><strong>${esc(d.tipo)}</strong></div>
        </div>
      </section>
      ${
        estado.medidas.length > 1
          ? `<section class="pp-secao">
        <h2>Detalhamento dos volumes</h2>
        <table class="pp-tabela">
          <thead><tr><th>Volume</th><th>Dimensões (A x L x P)</th><th class="pp-dir">Peso real</th><th class="pp-dir">Peso cubado</th><th class="pp-dir">Peso tributável</th></tr></thead>
          <tbody>${detalheVolumes(estado)
            .map(
              (v, i) => `<tr>
              <td><strong>Volume ${i + 1}</strong></td>
              <td>${v.medida.join(" x ")} cm</td>
              <td class="pp-dir">${numero(v.real)} kg</td>
              <td class="pp-dir">${numero(v.cubado)} kg</td>
              <td class="pp-dir"><strong>${numero(v.tributavel)} kg</strong></td>
            </tr>`,
            )
            .join("")}</tbody>
        </table>
      </section>`
          : ""
      }

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
    montarCamposDims(
      estado.volumes,
      estado.medidas.map((m) => m.join(" x ")),
      estado.volumes > 1 && estado.pesos.length === estado.volumes
        ? estado.pesos.map(pesoParaCampo)
        : [],
    );
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

  /* ----- volumes: medidas e peso de cada um ----- */
  // 1 volume  → só o campo de dimensões (o peso é o Peso Bruto Total)
  // 2 ou mais → "Volume N" com dimensões + peso; o total se ajusta sozinho:
  //   • falta só 1 peso → ele é preenchido com o que sobra do total (em itálico, "automático")
  //   • todos informados → o Peso Bruto Total vira a soma dos volumes (fica travado)
  //   • apagou o peso de um volume → o total destrava para editar de novo
  const grade = $(".fr-form-grade", form);
  const campoDims = $("#campo-dims");
  const listaDims = $("#p-dims-lista");
  const botaoCopiar = $("#btn-copiar-dims");
  const botaoDividir = $("#btn-dividir-peso");
  const campoPeso = $("#p-peso");
  const iconeRegua =
    '<svg class="fr-input-icone" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17 17 3l4 4L7 21z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" /></svg>';

  const camposDims = () => [...listaDims.querySelectorAll(".fr-dim")];
  const camposPesoVol = () => [...listaDims.querySelectorAll(".fr-dim-peso")];
  const medidaOk = (m) => m.length === 3 && m.every((v) => v > 0);
  function pesoParaCampo(n) {
    return formatarMoeda(String(Math.round(n * 100)));
  }

  // guarda o que foi digitado: diminuir e aumentar os volumes não apaga nada
  let memoriaDims = [];
  let memoriaPesos = [];

  function montarCamposDims(qtd, valores, pesos) {
    if (valores) {
      memoriaDims = [...valores];
      memoriaPesos = [...(pesos || [])];
    } else {
      camposDims().forEach((c, i) => (memoriaDims[i] = c.value));
      // peso automático não é guardado: ele é recalculado
      camposPesoVol().forEach(
        (c, i) => (memoriaPesos[i] = c.dataset.auto ? "" : c.value),
      );
    }
    const n = Math.min(Math.max(qtd || 1, 1), MAX_VOLUMES_DETALHADOS);
    const varios = n > 1;
    listaDims.innerHTML = Array.from({ length: n }, (_, i) => {
      const id = `p-dim-${i + 1}`;
      return `
        <div class="fr-dim-item">
          ${varios ? `<label for="${id}">Volume ${i + 1}</label>` : ""}
          <div class="fr-dim-linha">
            <div class="fr-input">
              ${iconeRegua}
              <input id="${id}" class="fr-dim" data-volume="${i + 1}" type="text" inputmode="numeric" maxlength="15" placeholder="A x L x P" autocomplete="off" aria-label="Dimensões do volume ${i + 1} (cm)">
            </div>
            ${
              varios
                ? `<div class="fr-input fr-input-kg sem-icone">
              <input id="p-dim-peso-${i + 1}" class="fr-dim-peso" data-volume="${i + 1}" type="text" inputmode="numeric" maxlength="9" placeholder="0,00" autocomplete="off" aria-label="Peso do volume ${i + 1} (kg)">
              <span class="fr-input-sufixo" aria-hidden="true">kg</span>
            </div>`
                : ""
            }
          </div>
        </div>`;
    }).join("");
    camposDims().forEach((c, i) => (c.value = memoriaDims[i] || ""));
    camposPesoVol().forEach((c, i) => (c.value = memoriaPesos[i] || ""));

    grade.classList.toggle("varios-volumes", varios);
    $("#l-dims").textContent = varios
      ? `Medidas e peso por volume · ${n} volumes`
      : "Dimensões (A x L x P) cm";
    botaoCopiar.hidden = !varios;
    botaoDividir.hidden = !varios;
    sincronizarPesos();
  }

  // mantém Peso Bruto Total e pesos dos volumes conversando entre si
  function sincronizarPesos() {
    const campos = camposPesoVol();
    const caixaTotal = campoPeso.closest(".fr-input");
    const dicaTotal = campoPeso.closest(".fr-campo").querySelector(".fr-dica");
    const destravar = () => {
      campoPeso.readOnly = false;
      caixaTotal.classList.remove("travado");
      dicaTotal.textContent = "";
    };

    if (!campos.length) {
      destravar();
      atualizarDicaDims();
      return;
    }

    const informados = campos.filter(
      (c) => !c.dataset.auto && lerPeso(c.value) > 0,
    );
    const soma = informados.reduce((t, c) => t + lerPeso(c.value), 0);
    const livres = campos.filter((c) => !informados.includes(c));

    if (!livres.length) {
      // todos os volumes têm peso → o total é a soma
      campoPeso.value = pesoParaCampo(soma);
      campoPeso.readOnly = true;
      caixaTotal.classList.add("travado");
      dicaTotal.textContent = "Soma dos volumes";
    } else {
      destravar();
      livres.forEach((c) => {
        if (c.dataset.auto) {
          c.value = "";
          delete c.dataset.auto;
        }
      });
      const total = lerPeso(campoPeso.value) || 0;
      const resto = Math.round((total - soma) * 100) / 100;
      if (livres.length === 1 && resto > 0) {
        livres[0].value = pesoParaCampo(resto);
        livres[0].dataset.auto = "1";
        livres[0].title = "Calculado: peso total menos os outros volumes";
      }
    }
    atualizarDicaDims();
  }

  // dica embaixo do bloco: cubagem e o que ainda falta
  function atualizarDicaDims() {
    const dica = $("#d-dims");
    const varios = camposPesoVol().length > 0;
    const medidas = camposDims()
      .map((c) => lerDimensoes(c.value))
      .filter(medidaOk);
    const faltamMedidas = camposDims().length - medidas.length;
    const faltamPesos = camposPesoVol().filter(
      (c) => !(lerPeso(c.value) > 0),
    ).length;
    const soma = camposPesoVol().reduce(
      (t, c) => t + (lerPeso(c.value) || 0),
      0,
    );
    const total = lerPeso(campoPeso.value) || 0;

    const partes = [];
    if (medidas.length)
      partes.push(
        `Cubagem ${numero(metrosCubicos(medidas), 3)} m³ (${numero(pesoCubado(medidas))} kg cubados)`,
      );
    if (faltamMedidas && medidas.length)
      partes.push(`faltam medidas de ${faltamMedidas}`);
    if (varios && faltamPesos) {
      if (faltamPesos === 1 && soma >= total && total > 0)
        partes.push(
          `os volumes já somam ${numero(soma)} kg (total ${numero(total)} kg)`,
        );
      else partes.push(`falta o peso de ${faltamPesos}`);
    }

    if (
      !medidas.length &&
      (!varios || faltamPesos === camposPesoVol().length)
    ) {
      dica.textContent = campoDims.classList.contains("pendente")
        ? varios
          ? "Faltam as medidas e o peso de cada volume."
          : "Faltam as medidas da carga."
        : "";
    } else {
      dica.textContent = partes.join(" · ");
    }
    if (!faltamMedidas && !faltamPesos) campoDims.classList.remove("pendente");
  }

  // máscaras + limpar erro de cada campo da lista
  listaDims.addEventListener("input", (e) => {
    const campo = e.target;
    if (campo.classList.contains("fr-dim")) {
      const apagando = (e.inputType || "").startsWith("delete");
      campo.value = formatarDimensoes(campo.value, apagando);
    } else if (campo.classList.contains("fr-dim-peso")) {
      campo.value = formatarMoeda(soDigitos(campo.value).slice(0, 9));
      delete campo.dataset.auto; // mexeu → passa a ser valor do usuário
      campo.removeAttribute("title");
    } else return;

    if (campo.hasAttribute("aria-invalid")) {
      campo.removeAttribute("aria-invalid");
      if (!listaDims.querySelector("[aria-invalid]")) {
        campoDims.classList.remove("tem-erro");
        $("#e-p-dims").textContent = "";
      }
    }
    if (campo.classList.contains("fr-dim-peso")) sincronizarPesos();
    else atualizarDicaDims();
  });

  // ao entrar num peso automático, seleciona tudo: digitar substitui o valor
  listaDims.addEventListener("focusin", (e) => {
    if (e.target.dataset && e.target.dataset.auto) e.target.select();
  });

  // Enter pula para o próximo campo da lista (em vez de enviar)
  listaDims.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const campos = [...listaDims.querySelectorAll("input")];
    const i = campos.indexOf(e.target);
    if (i > -1 && i < campos.length - 1) {
      e.preventDefault();
      campos[i + 1].focus();
    }
  });

  function erroNaLista(campo, mensagem) {
    campo.setAttribute("aria-invalid", "true");
    campoDims.classList.add("tem-erro");
    $("#e-p-dims").textContent = mensagem;
    campo.focus();
  }
  function limparErroLista() {
    listaDims
      .querySelectorAll("[aria-invalid]")
      .forEach((c) => c.removeAttribute("aria-invalid"));
    campoDims.classList.remove("tem-erro");
    $("#e-p-dims").textContent = "";
  }

  botaoCopiar.addEventListener("click", () => {
    const campos = camposDims();
    const primeira = campos[0].value;
    if (!medidaOk(lerDimensoes(primeira)))
      return erroNaLista(
        campos[0],
        "Preencha as medidas do Volume 1 para repetir nos demais",
      );
    campos.forEach((c) => (c.value = primeira));
    limparErroLista();
    atualizarDicaDims();
  });

  // divide o Peso Bruto Total igualmente (centavos que sobram vão para o último volume)
  botaoDividir.addEventListener("click", () => {
    const campos = camposPesoVol();
    const total = lerPeso(campoPeso.value);
    if (!(total > 0)) {
      marcarErro("p-peso", "Informe o peso total para dividir");
      campoPeso.focus();
      return;
    }
    const centavos = Math.round(total * 100);
    const parte = Math.floor(centavos / campos.length);
    campos.forEach((c, i) => {
      const v =
        i === campos.length - 1
          ? centavos - parte * (campos.length - 1)
          : parte;
      c.value = formatarMoeda(String(v));
      delete c.dataset.auto;
      c.removeAttribute("title");
    });
    limparErroLista();
    sincronizarPesos();
  });

  // abrir e fechar
  // pedirMedidas = true quando vem da página inicial (lá não há campo de dimensões)
  function abrirModal(pedirMedidas = false) {
    preencherForm();
    limparErros();
    campoDims.classList.toggle("pendente", pedirMedidas);
    atualizarDicaDims();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    if (pedirMedidas) {
      const vazio =
        [...listaDims.querySelectorAll("input")].find((c) => !c.value) ||
        camposDims()[0];
      vazio.focus();
    } else {
      $("#p-cep-origem").focus();
    }
  }
  botaoEditar.addEventListener("click", () => abrirModal(false));
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
    sincronizarPesos(); // recalcula o peso automático do volume que falta
  });
  $("#p-volumes").addEventListener("input", (e) => {
    e.target.value = soDigitos(e.target.value).slice(0, 5).replace(/^0+/, "");
    // muda a quantidade → refaz os campos de dimensão (vazio = espera digitar)
    const qtd = parseInt(e.target.value || "0", 10);
    if (qtd >= 1 && qtd !== camposDims().length) montarCamposDims(qtd);
  });
  $("#p-nf").addEventListener("input", (e) => {
    e.target.value = formatarMoeda(e.target.value);
  });

  // some o erro do campo assim que o usuário volta a digitar
  form.addEventListener("input", (e) => {
    if (e.target.closest("#p-dims-lista")) return; // tratado na lista dos volumes
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
    const medidas = camposDims().map((c) => lerDimensoes(c.value));
    const pesosVol = camposPesoVol().map((c) => lerPeso(c.value) || 0);
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
      "p-volumes",
      volumes > MAX_VOLUMES_DETALHADOS,
      `Acima de ${MAX_VOLUMES_DETALHADOS} volumes, solicite a cotação corporativa`,
    );

    // volumes: aponta exatamente qual campo de qual volume está faltando
    if (volumes >= 1 && volumes <= MAX_VOLUMES_DETALHADOS) {
      const cDims = camposDims();
      const cPesos = camposPesoVol();
      const ruins = [];
      medidas.forEach((m, i) => {
        if (!medidaOk(m)) ruins.push(cDims[i]);
        if (cPesos[i] && !(pesosVol[i] > 0)) ruins.push(cPesos[i]);
      });
      if (ruins.length) {
        ruins.forEach((c) => c.setAttribute("aria-invalid", "true"));
        campoDims.classList.add("tem-erro");
        const nomes = [...new Set(ruins.map((c) => c.dataset.volume))];
        const lista =
          nomes.slice(0, 4).join(", ") + (nomes.length > 4 ? "…" : "");
        $("#e-p-dims").textContent =
          cDims.length === 1
            ? "Informe A x L x P, ex.: 40 x 30 x 30"
            : `Preencha medidas e peso do${nomes.length > 1 ? "s volumes" : " volume"} ${lista}`;
        erros.push(ruins[0].id);
      }
    }
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
    estado.volumes = volumes;
    estado.medidas = medidas;
    if (pesosVol.length) {
      estado.pesos = pesosVol;
      // o total passa a ser exatamente a soma dos volumes
      estado.peso = Math.round(pesosVol.reduce((t, v) => t + v, 0) * 100) / 100;
    } else {
      estado.pesos = [peso];
      estado.peso = peso;
    }
    estado.nf = nf;
    estado.tipo = $("#p-tipo").value;

    campoDims.classList.remove("pendente");
    dialog.close();
    renderTudo(true);
    atualizarMapa();
    salvarNaUrl();
  });

  // grava os parâmetros na URL: recarregar a página mantém a cotação e não reabre o modal
  function salvarNaUrl() {
    const q = new URLSearchParams({
      o: soDigitos(estado.origem.cep),
      d: soDigitos(estado.destino.cep),
      p: String(estado.peso),
      v: String(estado.volumes),
      nf: String(estado.nf),
      t: estado.tipo,
      m: estado.medidas.map((m) => m.join("x")).join("-"),
    });
    if (estado.volumes > 1) q.set("w", estado.pesos.join("-"));
    history.replaceState(null, "", `${location.pathname}?${q}`);
  }

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
    // m=40x30x30-50x40x30 (uma medida por volume, já salva antes)
    const medidas = (q.get("m") || "")
      .split("-")
      .filter(Boolean)
      .map((m) => m.split("x").map(Number));
    const medidasOk =
      volumes >= 1 &&
      medidas.length === volumes &&
      medidas.every((m) => m.length === 3 && m.every((v) => v > 0));
    // w=5-3 (peso de cada volume, já salvo antes)
    const pesos = (q.get("w") || "").split("-").filter(Boolean).map(Number);
    const pesosOk =
      volumes > 1 && pesos.length === volumes && pesos.every((v) => v > 0);
    return {
      medidas: medidasOk ? medidas : null,
      pesos: pesosOk ? pesos : null,
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
      // a página inicial não pede dimensões: começa sem elas (vale o peso real) e pede no modal
      estado.medidas = ini.medidas || [];
      estado.pesos = ini.pesos || [];
      if (ini.pesos)
        estado.peso =
          Math.round(ini.pesos.reduce((t, v) => t + v, 0) * 100) / 100;
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
    // veio da página inicial (sem medidas/pesos por volume): já abre o modal pedindo o que falta
    const faltaDetalhe =
      ini && (!ini.medidas || (estado.volumes > 1 && !ini.pesos));
    if (faltaDetalhe) abrirModal(true);
  }
  iniciar();
})();
