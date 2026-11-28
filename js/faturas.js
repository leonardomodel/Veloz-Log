/* VelozLog — Faturas, Conciliação e Canhotos (portal-faturas.html) — dados de DEMONSTRAÇÃO
   • 3 abas: Faturas e Boletos · Repositório de Canhotos (POD) · Conciliação EDI
     (a aba aberta fica no endereço: ?aba=pod / ?aba=edi — o F5 volta nela)
   • faturas: busca (nº fatura, boleto, CT-e ou NF-e), ciclo, status e páginas de 5
   • janela única (<dialog>) para boleto DDA, quitação, espelho da fatura, canhoto e JSON
   • canhotos: ilustração em HTML; para usar a foto real, preencha "foto" em CANHOTOS
     (ex.: foto: "/img/canhotos/8402.jpg")
   Quando houver API, troque FATURAS e CANHOTOS pela resposta do servidor. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const avisar = (t, m) => window.VelozPortal && window.VelozPortal.avisar(t, m);
  const digitos = (t) => String(t).replace(/\D/g, "");
  const moeda = (n) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const reais = (n) => `R$ ${moeda(n)}`;

  const ANO = new Date().getFullYear();
  const HOJE = new Date();
  HOJE.setHours(0, 0, 0, 0);
  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const POR_PAGINA = 5;

  const dataDe = (ddmm) => {
    const [d, m] = ddmm.split("/").map(Number);
    return new Date(ANO, m - 1, d);
  };
  const dataBr = (ddmm) => `${ddmm}/${ANO}`;
  const diasAte = (ddmm) => Math.round((dataDe(ddmm) - HOJE) / 86400000);

  /* =========================================================
     DADOS
     ========================================================= */
  // mes = mês do período de apuração · q = quinzena (1 = dias 01–15, 2 = 16–fim)
  const FATURAS = [
    { num: "1102", boleto: "34191.75824", mes: 11, q: 1, ctes: 42, valor: 42850, irrf: 642.75, venc: "28/11", status: "aberto" },
    { num: "1002", boleto: "34191.43901", mes: 10, q: 2, ctes: 78, valor: 89400, irrf: 1341.0, venc: "15/11", status: "liquidado" },
    { num: "1001", boleto: "34191.11892", mes: 10, q: 1, ctes: 64, valor: 72150, irrf: 1082.25, venc: "30/10", status: "liquidado" },
    { num: "0902", boleto: "34191.09772", mes: 9, q: 2, ctes: 71, valor: 81300, irrf: 1219.5, venc: "15/10", status: "liquidado" },
    { num: "0901", boleto: "34191.08815", mes: 9, q: 1, ctes: 58, valor: 66480, irrf: 997.2, venc: "30/09", status: "liquidado" },
    { num: "0802", boleto: "34191.07320", mes: 8, q: 2, ctes: 69, valor: 78920, irrf: 1183.8, venc: "15/09", status: "liquidado" },
  ];

  const ultimoDia = (mes) => new Date(ANO, mes, 0).getDate();
  const periodo = (f) =>
    f.q === 1 ? `01 a 15 ${MESES[f.mes - 1]} / ${ANO}` : `16 a ${ultimoDia(f.mes)} ${MESES[f.mes - 1]} / ${ANO}`;
  const codigoFatura = (f) => `#FAT-${ANO}-${f.num}`;

  // CT-es de cada fatura: a mais recente traz os manifestos do portal (busca por CT-e/NF-e funciona)
  const CIDADES = ["Curitiba (PR)", "Porto Alegre (RS)", "Joinville (SC)", "Belo Horizonte (MG)", "Londrina (PR)", "Florianópolis (SC)", "Ribeirão Preto (SP)", "Uberlândia (MG)", "Blumenau (SC)", "Maringá (PR)"];
  const manifestos = (window.VelozManifestos && window.VelozManifestos.todos) || [];

  FATURAS.forEach((f, i) => {
    const base = 893700 - i * 900;
    const lista = [];
    if (i === 0)
      manifestos.slice(0, f.ctes).forEach((m) =>
        lista.push({ cte: m.cte, nf: m.nf, destino: `${m.cidade} (${m.uf})`, manifesto: m }),
      );
    for (let n = 0; lista.length < f.ctes; n++) {
      const num = String(base - n * 7);
      lista.push({
        cte: num,
        nf: `0${48 - i}.${String(900 - n * 3).padStart(3, "0")}`,
        destino: CIDADES[(n + i) % CIDADES.length],
      });
    }
    // valor de frete por CT-e (soma igual ao total da fatura)
    const pesos = lista.map((_, n) => 0.7 + ((n * 37 + i * 11) % 60) / 100);
    const soma = pesos.reduce((a, b) => a + b, 0);
    let acumulado = 0;
    lista.forEach((c, n) => {
      c.frete = n === lista.length - 1 ? +(f.valor - acumulado).toFixed(2) : +((f.valor * pesos[n]) / soma).toFixed(2);
      acumulado += c.frete;
    });
    f.lista = lista;
  });

  // canhotos = as entregas com comprovante (POD) da base única do portal (/js/manifestos.js):
  // os mesmos que aparecem em "Manifestos & CTEs" como "Entregue c/ POD"
  const CANHOTOS = manifestos
    .filter((m) => m.status === "entregue" && m.pod)
    .map((m) => {
      const [, dd, mm, hora] = /(\d{2})\/(\d{2})\/\d{4} às (\d{2}:\d{2}:\d{2})/.exec(m.pod.carimbo) || [];
      return {
        cte: m.cte,
        recebedor: m.pod.recebedor,
        doc: m.pod.doc,
        data: `${dd}/${mm}`,
        hora,
        lat: m.pod.lat,
        lng: m.pod.lng,
        cidade: `${m.cidade}/${m.uf}`,
        foto: null,
        manifesto: m,
        ordem: `${mm}${dd}${hora}`,
      };
    })
    .sort((a, b) => (a.ordem < b.ordem ? 1 : -1)); // mais recentes primeiro

  // números da tela contados dos dados (não ficam fixos no HTML)
  const definirTexto = (sel, texto) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = texto;
  };
  definirTexto("#fa-kpi-canhotos", CANHOTOS.length);
  definirTexto("#fa-ver-canhotos", `Ver todos os ${CANHOTOS.length} canhotos`);

  /* =========================================================
     ÍCONES
     ========================================================= */
  const I = {
    recibo: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" />',
    arquivo: '<rect x="4" y="4" width="16" height="5" rx="1" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" />',
    relogio: '<circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M5 3L2 6M19 3l3 3" />',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M8.5 15l2 2 4-4" />',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v7M14 20h3" />',
    escudo: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4.5" />',
    pdf: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5" /><path d="M8.5 16v-4h1.3a1.2 1.2 0 0 1 0 2.4H8.5M12.5 16v-4h1a2 2 0 0 1 0 4zM17 12h-1.5v4M15.5 14H17" />',
    olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />',
    chaves: '<path d="M8 4H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 4h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1" />',
    pino: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />',
    relogioP: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />',
    imprimir: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" /><rect x="6" y="14" width="12" height="7" rx="1" />',
    baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" />',
    lupa: '<circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4M11 8v6M8 11h6" />',
  };
  const svg = (nome) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[nome]}</svg>`;

  /* =========================================================
     ARQUIVOS (CSV, TXT, JSON)
     ========================================================= */
  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const csv = (linhas) =>
    "\uFEFF" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const area = document.createElement("textarea");
      area.value = texto;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  }

  /* =========================================================
     ABAS
     ========================================================= */
  const abas = $$("#fa-abas [role=tab]");

  function abrirAba(nome, focar = false) {
    abas.forEach((b) => {
      const ativa = b.dataset.aba === nome;
      b.setAttribute("aria-selected", ativa);
      b.tabIndex = ativa ? 0 : -1;
      $(`#${b.getAttribute("aria-controls")}`).hidden = !ativa;
      if (ativa && focar) b.focus();
    });
    const url = new URL(location.href);
    if (nome === "faturas") url.searchParams.delete("aba");
    else url.searchParams.set("aba", nome);
    history.replaceState(history.state, "", url);
  }

  abas.forEach((b) => b.addEventListener("click", () => abrirAba(b.dataset.aba)));
  $("#fa-abas").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = abas.findIndex((b) => b.getAttribute("aria-selected") === "true");
    const prox = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
    abrirAba(prox.dataset.aba, true);
  });
  document.addEventListener("click", (e) => {
    const ir = e.target.closest("[data-ir-aba]");
    if (!ir) return;
    abrirAba(ir.dataset.irAba);
    const topo = $("#fa-abas").getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: topo, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  /* =========================================================
     FATURAS
     ========================================================= */
  const filtro = { busca: "", ciclo: 11, status: "todos", pagina: 1 };

  // ciclo de um mês = faturas do período daquele mês e do anterior (a cobrança vence no mês seguinte)
  const selectMes = $("#fa-mes");
  selectMes.innerHTML =
    [11, 10, 9].map((m) => `<option value="${m}">${MESES_LONGOS[m - 1]} / ${ANO}</option>`).join("") +
    '<option value="todos">Todos os ciclos</option>';

  function situacao(f) {
    if (f.status === "liquidado") return "liquidado";
    const dias = diasAte(f.venc);
    if (dias < 0) return "vencida";
    if (dias === 0) return "hoje";
    return "aberto";
  }

  function noCiclo(f) {
    return filtro.ciclo === "todos" || f.mes === filtro.ciclo || f.mes === filtro.ciclo - 1;
  }

  function combina(f) {
    const q = filtro.busca.trim().toLowerCase();
    if (!q) return true;
    if (codigoFatura(f).toLowerCase().includes(q.replace(/^#?/, "#")) || codigoFatura(f).toLowerCase().includes(q)) return true;
    const d = digitos(q);
    if (d.length < 3) return false;
    return (
      digitos(f.boleto).includes(d) ||
      f.lista.some((c) => c.cte.includes(d) || digitos(c.nf).includes(d))
    );
  }

  function filtradas() {
    const base = FATURAS.filter((f) => noCiclo(f) && combina(f));
    const contagem = { aberto: 0, liquidado: 0, hoje: 0 };
    base.forEach((f) => {
      const s = situacao(f);
      if (s === "liquidado") contagem.liquidado++;
      else contagem.aberto++;
      if (s === "hoje") contagem.hoje++;
    });
    Object.entries(contagem).forEach(([k, v]) => $$(`[data-conta="${k}"]`).forEach((el) => (el.textContent = v)));
    $("#fa-aba-num").textContent = base.length;

    return base.filter((f) => {
      const s = situacao(f);
      if (filtro.status === "aberto") return s !== "liquidado";
      if (filtro.status === "liquidado") return s === "liquidado";
      if (filtro.status === "hoje") return s === "hoje";
      return true;
    });
  }

  function celulaVencimento(f) {
    const s = situacao(f);
    if (s === "liquidado")
      return `<div class="fa-venc">${svg("calendario")}<div><strong>${dataBr(f.venc)}</strong><small>Compensado</small></div></div>`;
    const dias = diasAte(f.venc);
    const texto = s === "vencida" ? `Vencida há ${-dias} dia${dias === -1 ? "" : "s"}` : s === "hoje" ? "Vence hoje" : `Em ${dias} dia${dias === 1 ? "" : "s"}`;
    return `<div class="fa-venc fa-venc-aberto">${svg("relogio")}<div><strong>${dataBr(f.venc)}</strong><small>${texto}</small></div></div>`;
  }

  const STATUS = {
    aberto: '<span class="fa-status fa-status-aberto"><i></i>Em Aberto</span>',
    hoje: '<span class="fa-status fa-status-aberto"><i></i>Vence Hoje</span>',
    vencida: '<span class="fa-status fa-status-vencida"><i></i>Vencida</span>',
    liquidado: '<span class="fa-status fa-status-liquidado"><i></i>Liquidado</span>',
  };

  function mostrarFaturas() {
    const lista = filtradas();
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    filtro.pagina = Math.min(filtro.pagina, paginas);
    const visiveis = lista.slice((filtro.pagina - 1) * POR_PAGINA, filtro.pagina * POR_PAGINA);

    $("#fa-linhas").innerHTML = visiveis.length
      ? visiveis
          .map((f) => {
            const s = situacao(f);
            const aberta = s !== "liquidado";
            const [inteiro, centavos] = moeda(f.valor).split(",");
            return `<tr class="${aberta ? "fa-linha-aberta" : ""}">
              <td>
                <div class="fa-fatura">
                  <span class="fa-fatura-icone">${svg(aberta ? "recibo" : "arquivo")}</span>
                  <div><strong>${esc(codigoFatura(f))}</strong><small class="fa-mono">Boleto Itaú nº ${esc(f.boleto)}</small></div>
                </div>
              </td>
              <td class="fa-periodo"><strong>${esc(periodo(f))}</strong><small>${f.q}ª Quinzena</small></td>
              <td class="fa-centro"><button type="button" class="fa-ctes" data-edi="${f.num}" title="Ver conciliação dos CT-es">${svg("arquivo")}${f.ctes} CTes</button></td>
              <td class="fa-direita fa-valor">
                <strong>R$ ${inteiro},${centavos}</strong>
                <small class="fa-mono">IRRF Retido: R$ ${moeda(f.irrf)}</small>
              </td>
              <td>${celulaVencimento(f)}</td>
              <td class="fa-centro">${STATUS[s]}</td>
              <td class="fa-direita">
                <div class="fa-acoes">
                  ${
                    aberta
                      ? `<button type="button" class="fa-acao fa-acao-laranja" data-boleto="${f.num}">${svg("qr")}Boleto DDA</button>`
                      : `<button type="button" class="fa-acao" data-quitacao="${f.num}">${svg("escudo")}Quitação</button>`
                  }
                  <button type="button" class="fa-acao-icone" data-espelho="${f.num}" aria-label="Espelho da fatura ${esc(codigoFatura(f))} (PDF)" title="Espelho da fatura (PDF)">${svg("pdf")}</button>
                </div>
              </td>
            </tr>`;
          })
          .join("")
      : `<tr class="fa-vazio-linha"><td colspan="7">Nenhuma fatura encontrada com esses filtros.</td></tr>`;

    $("#fa-exibindo").textContent = `Exibindo ${lista.length} registro${lista.length === 1 ? "" : "s"} auditado${lista.length === 1 ? "" : "s"}`;
    $("#fa-pagina").textContent = `Página ${filtro.pagina} de ${paginas}`;
    $("#fa-anterior").disabled = filtro.pagina <= 1;
    $("#fa-proxima").disabled = filtro.pagina >= paginas;
  }

  $("#fa-busca").addEventListener("input", (e) => {
    filtro.busca = e.target.value;
    filtro.pagina = 1;
    mostrarFaturas();
  });
  selectMes.addEventListener("change", () => {
    filtro.ciclo = selectMes.value === "todos" ? "todos" : Number(selectMes.value);
    filtro.pagina = 1;
    mostrarFaturas();
  });
  $("#fa-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-status]");
    if (!b) return;
    filtro.status = b.dataset.status;
    filtro.pagina = 1;
    $$("#fa-chips [data-status]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    mostrarFaturas();
  });
  $("#fa-anterior").addEventListener("click", () => {
    filtro.pagina--;
    mostrarFaturas();
  });
  $("#fa-proxima").addEventListener("click", () => {
    filtro.pagina++;
    mostrarFaturas();
  });

  const fatura = (num) => FATURAS.find((f) => f.num === num);

  $("#fa-linhas").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.boleto) abrirBoleto(fatura(b.dataset.boleto));
    else if (b.dataset.quitacao) abrirQuitacao(fatura(b.dataset.quitacao));
    else if (b.dataset.espelho) abrirEspelho(fatura(b.dataset.espelho));
    else if (b.dataset.edi) {
      $("#fa-edi-fatura").value = b.dataset.edi;
      mostrarEdi();
      abrirAba("edi");
    }
  });

  /* ---------- indicadores ---------- */
  function mostrarKpis() {
    const abertas = FATURAS.filter((f) => f.status === "aberto").sort((a, b) => dataDe(a.venc) - dataDe(b.venc));
    const total = abertas.reduce((s, f) => s + f.valor, 0);
    const [inteiro, centavos] = moeda(total).split(",");
    $("#fa-kpi-vencer").innerHTML = `R$ ${inteiro}<small>,${centavos}</small>`;
    $("#fa-kpi-proximo").textContent = abertas.length ? dataBr(abertas[0].venc) : "—";
    $("#fa-kpi-lotes").textContent = `${abertas.length} lote${abertas.length === 1 ? "" : "s"}`;
    // liquidadas nos últimos 30 dias (mesmas faturas da tabela)
    const pagas = FATURAS.filter((f) => f.status === "liquidado" && diasAte(f.venc) >= -30 && diasAte(f.venc) <= 0);
    const [i2, c2] = moeda(pagas.reduce((s, f) => s + f.valor, 0)).split(",");
    const kpiPagas = $("#fa-kpi-liquidadas");
    if (kpiPagas) kpiPagas.innerHTML = `R$ ${i2}<small>,${c2}</small>`;
  }

  /* ---------- botões do cabeçalho ---------- */
  const linhaDigitavel = (f) => {
    const valor = String(Math.round(f.valor * 100)).padStart(10, "0");
    const fator = String(9000 + Number(f.num)).slice(0, 4);
    return `${f.boleto} ${f.num.padStart(5, "0")}.94022${f.q} 6104${f.mes}.7300${f.q} 9 ${fator}${valor}`;
  };

  $("#fa-lote").addEventListener("click", () => {
    const abertas = FATURAS.filter((f) => situacao(f) !== "liquidado");
    if (!abertas.length) {
      avisar("Lote de boletos", "Não há boletos em aberto no momento.");
      return;
    }
    const texto = abertas
      .map((f) => `${codigoFatura(f)} | Vencimento ${dataBr(f.venc)} | ${reais(f.valor)}\r\n${linhaDigitavel(f)}`)
      .join("\r\n\r\n");
    baixar(`lote-boletos-velozlog-${ANO}.txt`, `VelozLog — Lote de boletos em aberto\r\n\r\n${texto}\r\n`, "text/plain;charset=utf-8");
    avisar("Lote de boletos", `${abertas.length} boleto${abertas.length === 1 ? "" : "s"} com linha digitável no arquivo baixado.`);
  });

  $("#fa-exportar").addEventListener("click", () => {
    const lista = filtradas();
    const linhas = [
      ["Fatura", "Boleto", "Período", "Quinzena", "CT-es", "Valor (R$)", "IRRF Retido (R$)", "Vencimento", "Status"],
      ...lista.map((f) => [codigoFatura(f), f.boleto, periodo(f), `${f.q}ª`, f.ctes, moeda(f.valor), moeda(f.irrf), dataBr(f.venc), situacao(f) === "liquidado" ? "Liquidado" : "Em Aberto"]),
    ];
    baixar(`faturas-velozlog-${new Date().toISOString().slice(0, 10)}.csv`, csv(linhas), "text/csv;charset=utf-8");
    avisar("Relatório exportado", "Planilha (CSV) pronta: abre direto no Excel com os acentos certos.");
  });

  /* =========================================================
     CANHOTOS
     ========================================================= */
  const ASSINATURAS = [
    "M4 30 C 12 4, 20 40, 28 18 S 42 6, 48 26 S 62 36, 70 14 S 88 24, 100 18",
    "M4 24 C 10 8, 18 8, 22 26 S 34 34, 40 14 S 52 4, 58 22 S 74 32, 84 16 L 100 20",
    "M4 22 Q 14 2, 20 22 T 36 22 T 52 18 Q 60 34, 70 16 S 90 10, 100 24",
  ];

  function arteCanhoto(c, i) {
    if (c.foto) return `<img class="fa-foto" src="${esc(c.foto)}" alt="Canhoto assinado do CT-e ${esc(c.cte)}" loading="lazy">`;
    return `<div class="fa-arte fa-arte-v${i % 3}" aria-hidden="true">
      <div class="fa-papel">
        <div class="fa-papel-topo"><b>VELOZ<em>LOG</em></b><span>Comprovante de Entrega • CT-e ${esc(c.cte)}</span></div>
        <div class="fa-papel-linhas"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="fa-papel-assinatura">
          <svg viewBox="0 0 104 40"><path d="${ASSINATURAS[i % 3]}" /></svg>
          <span>${esc(c.recebedor.split(" (")[0])}</span>
        </div>
        <span class="fa-papel-carimbo">Recebido<br>${esc(c.data)}/${ANO}</span>
        <div class="fa-papel-barras"></div>
      </div>
    </div>`;
  }

  const coord = (c) => `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;

  function cardCanhoto(c) {
    const i = CANHOTOS.indexOf(c);
    return `<article class="pt-cartao fa-card">
      <div class="fa-card-midia">
        ${arteCanhoto(c, i)}
        <span class="fa-validado"><i></i>Validado</span>
        <span class="fa-card-cte">CTe nº ${esc(c.cte)}</span>
      </div>
      <div class="fa-card-corpo">
        <small class="fa-card-rotulo">Destinatário &amp; Recebedor</small>
        <strong class="fa-card-nome">${esc(c.recebedor)}</strong>
        <span class="fa-card-doc fa-mono">Doc: ${esc(c.doc)}</span>
        <div class="fa-card-dados">
          <p>${svg("relogioP")}<span>${esc(dataBr(c.data))} às ${esc(c.hora)}</span></p>
          <p>${svg("pino")}<span class="fa-mono" title="${esc(coord(c))} (${esc(c.cidade)})">${esc(coord(c))} (${esc(c.cidade)})</span></p>
        </div>
        <div class="fa-card-botoes">
          <button type="button" class="fa-card-ver" data-canhoto="${i}">${svg("olho")}Ver em Alta Resolução</button>
          <button type="button" class="fa-card-json" data-json="${i}" aria-label="Metadados do canhoto ${esc(c.cte)} (JSON)" title="Metadados (JSON)">${svg("chaves")}</button>
        </div>
      </div>
    </article>`;
  }

  $("#fa-galeria").innerHTML = CANHOTOS.slice(0, 3).map(cardCanhoto).join("");

  let canhotosVisiveis = CANHOTOS;
  function mostrarRepositorio() {
    const q = $("#fa-pod-busca").value.trim().toLowerCase();
    const d = digitos(q);
    canhotosVisiveis = CANHOTOS.filter(
      (c) =>
        !q ||
        c.recebedor.toLowerCase().includes(q) ||
        c.cidade.toLowerCase().includes(q) ||
        (d.length >= 3 && digitos(c.cte).includes(d)),
    );
    $("#fa-pod-lista").innerHTML = canhotosVisiveis.map(cardCanhoto).join("");
    $("#fa-pod-vazio").hidden = canhotosVisiveis.length > 0;
    $("#fa-pod-total").textContent = q
      ? `${canhotosVisiveis.length} canhoto${canhotosVisiveis.length === 1 ? "" : "s"} encontrado${canhotosVisiveis.length === 1 ? "" : "s"}`
      : `${CANHOTOS.length} canhotos no repositório (últimos 30 dias)`;
  }
  $("#fa-pod-busca").addEventListener("input", mostrarRepositorio);

  const metadados = (c) => ({
    cte: c.cte,
    status: "VALIDADO",
    recebedor: { nome: c.recebedor, documento: c.doc },
    entrega: {
      data: dataBr(c.data),
      hora: c.hora,
      fuso: "America/Sao_Paulo",
      carimbo: "NTP.br sincronizado via GPS",
    },
    geolocalizacao: { latitude: c.lat, longitude: c.lng, cidade: c.cidade, raio_metros: 4, geofence: "validada" },
    assinatura: { tipo: "manuscrita digitalizada", formato: "PNG 300dpi" },
    registro: `#VL-${digitos(c.cte).slice(-6)}`,
  });

  $("#fa-pod-zip").addEventListener("click", () => {
    baixar(
      `canhotos-velozlog-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(canhotosVisiveis.map(metadados), null, 2),
      "application/json;charset=utf-8",
    );
    avisar("Metadados baixados", `${canhotosVisiveis.length} canhoto${canhotosVisiveis.length === 1 ? "" : "s"} no arquivo JSON.`);
  });

  document.addEventListener("click", (e) => {
    const ver = e.target.closest("[data-canhoto]");
    if (ver) abrirCanhoto(CANHOTOS[Number(ver.dataset.canhoto)]);
    const json = e.target.closest("[data-json]");
    if (json) abrirJson(CANHOTOS[Number(json.dataset.json)]);
  });

  /* =========================================================
     CONCILIAÇÃO EDI
     ========================================================= */
  const selectEdi = $("#fa-edi-fatura");
  selectEdi.innerHTML = FATURAS.map((f) => `<option value="${f.num}">${codigoFatura(f)} • ${periodo(f)}</option>`).join("");
  let ediTodos = false;
  const EDI_AMOSTRA = 10;

  function mostrarEdi() {
    const f = fatura(selectEdi.value);
    const dados = window.VelozManifestos;
    const lista = ediTodos ? f.lista : f.lista.slice(0, EDI_AMOSTRA);
    $("#fa-edi-arquivo").textContent = `DOCCOB_VLZ_${f.num}.txt`;
    $("#fa-edi-conciliados").textContent = `${f.ctes} de ${f.ctes}`;
    $("#fa-edi-linhas").innerHTML =
      lista
        .map((c) => {
          const link = c.manifesto && dados ? `/rastreio.html?codigo=${encodeURIComponent(dados.codigo(c.manifesto))}&de=faturas` : null;
          const rotulo = c.manifesto && dados ? dados.codigo(c.manifesto) : `CT-e ${c.cte}`;
          return `<tr>
            <td>${link ? `<a class="fa-link fa-mono" href="${link}">${esc(rotulo)}</a>` : `<span class="fa-mono">${esc(rotulo)}</span>`}</td>
            <td class="fa-mono">${esc(c.nf)}</td>
            <td>${esc(c.destino)}</td>
            <td class="fa-direita fa-mono">${reais(c.frete)}</td>
            <td class="fa-direita fa-mono">${reais(c.frete)}</td>
            <td class="fa-direita fa-mono fa-verde">R$ 0,00</td>
            <td class="fa-centro"><span class="fa-selo-ok">${svg("escudo")}Conciliado</span></td>
          </tr>`;
        })
        .join("") +
      (f.lista.length > EDI_AMOSTRA
        ? `<tr class="fa-edi-mais"><td colspan="7"><button type="button" id="fa-edi-todos">${
            ediTodos ? "Mostrar só a amostra" : `Mostrar todos os ${f.lista.length} CT-es`
          }</button></td></tr>`
        : "");
  }

  selectEdi.addEventListener("change", () => {
    ediTodos = false;
    mostrarEdi();
  });
  $("#fa-edi-linhas").addEventListener("click", (e) => {
    if (!e.target.closest("#fa-edi-todos")) return;
    ediTodos = !ediTodos;
    mostrarEdi();
  });
  $("#fa-disputa").addEventListener("click", () =>
    avisar("Abrir disputa", "Este espelho não tem divergências. Se precisar contestar um CT-e, a Torre Financeira atende no 0800 700 8900, ramal 9099."),
  );

  /* =========================================================
     JANELA (dialog)
     ========================================================= */
  const modal = $("#fa-modal");
  const corpo = $("#fa-modal-corpo");
  const pe = $("#fa-modal-pe");

  function abrirModal(titulo, html, botoes, classe = "") {
    $("#fa-modal-titulo").textContent = titulo;
    corpo.innerHTML = html;
    pe.innerHTML = botoes;
    modal.className = `fa-modal ${classe}`;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
    corpo.scrollTop = 0;
  }
  function fecharModal() {
    if (typeof modal.close === "function") modal.close();
    else modal.removeAttribute("open");
  }
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-fechar]")) fecharModal();
  });

  const BOTAO_FECHAR = '<button type="button" class="fa-btn fa-btn-claro" data-fechar>Fechar</button>';
  const BOTAO_IMPRIMIR = `<button type="button" class="fa-btn fa-btn-laranja" data-imprimir>${svg("imprimir")}Imprimir / Salvar PDF</button>`;

  pe.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-imprimir")) window.print();
    if (b.dataset.copiar) {
      await copiar(b.dataset.copiar);
      avisar("Copiado", b.dataset.aviso || "Texto copiado para a área de transferência.");
    }
    if (b.dataset.baixarJson) {
      const c = CANHOTOS[Number(b.dataset.baixarJson)];
      baixar(`canhoto-${digitos(c.cte)}.json`, JSON.stringify(metadados(c), null, 2), "application/json;charset=utf-8");
    }
  });

  const cabecalhoDoc = (titulo, sub) => `
    <div class="fa-doc-cabeca">
      <div class="fa-doc-marca"><img src="/img/icon.svg" alt="" width="30" height="32"><span><b>Veloz<em>Log</em></b><small>Transportes B2B</small></span></div>
      <div class="fa-doc-titulo"><strong>${esc(titulo)}</strong><small>${esc(sub)}</small></div>
    </div>`;

  function abrirBoleto(f) {
    const linha = linhaDigitavel(f);
    abrirModal(
      `Boleto DDA • ${codigoFatura(f)}`,
      `${cabecalhoDoc("Boleto Bancário (DDA)", "Itaú Unibanco S.A. • 341-7")}
      <dl class="fa-doc-grade">
        <div><dt>Beneficiário</dt><dd>VelozLog Transportes e Logística Ltda.</dd></div>
        <div><dt>Pagador</dt><dd>Indústrias Metalúrgicas ABC</dd></div>
        <div><dt>Vencimento</dt><dd class="fa-laranja">${dataBr(f.venc)}</dd></div>
        <div><dt>Valor do Documento</dt><dd>${reais(f.valor)}</dd></div>
        <div><dt>Nosso Número</dt><dd class="fa-mono">${esc(f.boleto)}</dd></div>
        <div><dt>Referência</dt><dd>${esc(periodo(f))} • ${f.ctes} CT-es</dd></div>
      </dl>
      <p class="fa-doc-rotulo">Linha digitável</p>
      <p class="fa-linha-digitavel fa-mono">${esc(linha)}</p>
      <div class="fa-barras" aria-hidden="true"></div>
      <p class="fa-doc-nota">${svg("escudo")}Boleto registrado na CIP e disponível no DDA do Itaú BBA: também aparece automaticamente no internet banking da sua empresa.</p>`,
      `${BOTAO_FECHAR}
       <button type="button" class="fa-btn fa-btn-claro" data-copiar="${esc(digitos(linha))}" data-aviso="Linha digitável copiada. É só colar no internet banking.">${svg("copiar")}Copiar linha digitável</button>
       ${BOTAO_IMPRIMIR}`,
    );
  }

  function abrirQuitacao(f) {
    const autenticacao = `${digitos(f.boleto)}${f.num}`.replace(/(\d{4})(?=\d)/g, "$1.");
    abrirModal(
      `Quitação • ${codigoFatura(f)}`,
      `${cabecalhoDoc("Comprovante de Quitação", "Baixa bancária conciliada")}
      <div class="fa-quitado">${svg("escudo")}<div><strong>Fatura liquidada</strong><small>Compensada em ${dataBr(f.venc)} via DDA Itaú BBA</small></div></div>
      <dl class="fa-doc-grade">
        <div><dt>Fatura</dt><dd>${esc(codigoFatura(f))}</dd></div>
        <div><dt>Período</dt><dd>${esc(periodo(f))}</dd></div>
        <div><dt>Valor Pago</dt><dd>${reais(f.valor)}</dd></div>
        <div><dt>IRRF Retido</dt><dd>${reais(f.irrf)}</dd></div>
        <div><dt>CT-es Quitados</dt><dd>${f.ctes}</dd></div>
        <div><dt>Data de Compensação</dt><dd>${dataBr(f.venc)}</dd></div>
      </dl>
      <p class="fa-doc-rotulo">Autenticação bancária</p>
      <p class="fa-linha-digitavel fa-mono">${esc(autenticacao)}</p>`,
      `${BOTAO_FECHAR}${BOTAO_IMPRIMIR}`,
    );
  }

  function abrirEspelho(f) {
    const AMOSTRA = 12;
    const linhas = f.lista
      .slice(0, AMOSTRA)
      .map((c) => `<tr><td class="fa-mono">${esc(c.cte)}</td><td class="fa-mono">${esc(c.nf)}</td><td>${esc(c.destino)}</td><td class="fa-direita fa-mono">${reais(c.frete)}</td></tr>`)
      .join("");
    abrirModal(
      `Espelho da Fatura • ${codigoFatura(f)}`,
      `${cabecalhoDoc(`Fatura ${codigoFatura(f)}`, `${periodo(f)} • ${f.q}ª Quinzena`)}
      <dl class="fa-doc-grade">
        <div><dt>Cliente</dt><dd>Indústrias Metalúrgicas ABC</dd></div>
        <div><dt>Vencimento</dt><dd>${dataBr(f.venc)}</dd></div>
        <div><dt>Boleto</dt><dd class="fa-mono">Itaú nº ${esc(f.boleto)}</dd></div>
        <div><dt>Situação</dt><dd>${situacao(f) === "liquidado" ? "Liquidada" : "Em aberto"}</dd></div>
      </dl>
      <div class="fa-rolagem">
        <table class="fa-doc-tabela">
          <thead><tr><th>CT-e</th><th>NF-e</th><th>Destino</th><th class="fa-direita">Frete</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
      ${f.lista.length > AMOSTRA ? `<p class="fa-doc-nota">… e mais ${f.lista.length - AMOSTRA} CT-es (lista completa no relatório e na Conciliação EDI).</p>` : ""}
      <dl class="fa-doc-totais">
        <div><dt>Valor bruto</dt><dd>${reais(f.valor)}</dd></div>
        <div><dt>IRRF retido (1,5%)</dt><dd>− ${reais(f.irrf)}</dd></div>
        <div class="fa-doc-total"><dt>Valor líquido</dt><dd>${reais(f.valor - f.irrf)}</dd></div>
      </dl>`,
      `${BOTAO_FECHAR}${BOTAO_IMPRIMIR}`,
      "fa-modal-largo",
    );
  }

  function abrirCanhoto(c) {
    const i = CANHOTOS.indexOf(c);
    abrirModal(
      `Canhoto Digital • CTe nº ${c.cte}`,
      `<div class="fa-canhoto-grande" id="fa-canhoto-grande">
        ${arteCanhoto(c, i)}
        <button type="button" class="fa-zoom" id="fa-zoom" aria-pressed="false">${svg("lupa")}<span>Zoom</span></button>
      </div>
      <dl class="fa-doc-grade">
        <div><dt>Recebedor</dt><dd>${esc(c.recebedor)}</dd></div>
        <div><dt>Documento</dt><dd class="fa-mono">${esc(c.doc)}</dd></div>
        <div><dt>Data e hora</dt><dd>${esc(dataBr(c.data))} às ${esc(c.hora)}</dd></div>
        <div><dt>Coordenadas</dt><dd class="fa-mono">${esc(coord(c))} (${esc(c.cidade)})</dd></div>
      </dl>`,
      `${BOTAO_FECHAR}
       <button type="button" class="fa-btn fa-btn-claro" data-baixar-json="${i}">${svg("chaves")}Metadados (JSON)</button>
       ${BOTAO_IMPRIMIR}`,
      "fa-modal-largo",
    );
    $("#fa-zoom").addEventListener("click", (e) => {
      const ativo = $("#fa-canhoto-grande").classList.toggle("fa-ampliado");
      e.currentTarget.setAttribute("aria-pressed", ativo);
      $("span", e.currentTarget).textContent = ativo ? "Reduzir" : "Zoom";
    });
  }

  function abrirJson(c) {
    const texto = JSON.stringify(metadados(c), null, 2);
    abrirModal(
      `Metadados • CTe nº ${c.cte}`,
      `<p class="fa-doc-nota">${svg("escudo")}Registro de auditoria do canhoto (integração via API / EDI).</p>
       <pre class="fa-json">${esc(texto)}</pre>`,
      `${BOTAO_FECHAR}
       <button type="button" class="fa-btn fa-btn-claro" data-copiar="${esc(texto)}" data-aviso="JSON copiado.">${svg("copiar")}Copiar</button>
       <button type="button" class="fa-btn fa-btn-laranja" data-baixar-json="${CANHOTOS.indexOf(c)}">${svg("baixar")}Baixar .json</button>`,
    );
  }

  /* =========================================================
     INÍCIO
     ========================================================= */
  mostrarKpis();
  mostrarFaturas();
  mostrarRepositorio();
  mostrarEdi();
  const abaInicial = new URLSearchParams(location.search).get("aba");
  if (abaInicial === "pod" || abaInicial === "edi") abrirAba(abaInicial);
})();
