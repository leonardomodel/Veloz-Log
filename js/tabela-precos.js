/* VelozLog — Tabela de Preços Referencial
   Monta a tabela a partir de /js/precos.js (os mesmos números da cotação) e:
   • mostra na página em qualquer elemento com  data-tabela-precos
   • baixa em PDF (A4) ao clicar em qualquer elemento com  data-tabela-pdf
   Precisa de /js/precos.js carregado antes. */
(() => {
  "use strict";

  const P = window.VelozPrecos;
  if (!P) {
    console.error(
      "tabela-precos.js: carregue /js/precos.js antes deste arquivo",
    );
    return;
  }

  /* ---------- formatação ---------- */
  const brl = (v) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const num = (v, casas = 0) =>
    v.toLocaleString("pt-BR", {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    });
  const pct = (porMil) => `${num(porMil / 10, 1)}%`;

  // faixas de distância da tabela (o preço usa o limite de cima de cada faixa)
  const DISTANCIAS = [
    { rotulo: "até 300 km", km: 300 },
    { rotulo: "301 a 600 km", km: 600 },
    { rotulo: "601 a 1.000 km", km: 1000 },
    { rotulo: "1.001 a 1.500 km", km: 1500 },
    { rotulo: "1.501 a 2.500 km", km: 2500 },
    { rotulo: "acima de 2.500 km", km: 3200 },
  ];

  function precoFracionado(peso, km, m) {
    return Math.max(
      m.minimo,
      P.fretePesoBase(peso) * P.fatorDistancia(km) * m.multiplicador,
    );
  }

  function tabelaFracionado(m) {
    const cab = DISTANCIAS.map((d) => `<th>${d.rotulo}</th>`).join("");
    const linhas = P.FAIXAS_FRACIONADO.map((f) => {
      const rotulo = `até ${f.ate} kg`;
      const cel = DISTANCIAS.map(
        (d) => `<td>${brl(precoFracionado(f.ate, d.km, m))}</td>`,
      ).join("");
      return `<tr><th>${rotulo}</th>${cel}</tr>`;
    }).join("");
    const excedente = DISTANCIAS.map(
      (d) =>
        `<td>${brl(P.EXCEDENTE_POR_KG * P.fatorDistancia(d.km) * m.multiplicador)}</td>`,
    ).join("");
    return `
      <table class="tp-tabela">
        <thead><tr><th>Peso tributável</th>${cab}</tr></thead>
        <tbody>
          ${linhas}
          <tr class="tp-excedente"><th>kg excedente (acima de ${P.FAIXAS_FRACIONADO.at(-1).ate} kg)</th>${excedente}</tr>
        </tbody>
      </table>`;
  }

  function tabelaDedicado() {
    const exemplos = [300, 1000];
    const linhas = P.VEICULOS.map((v) => {
      const ex = exemplos
        .map(
          (km) =>
            `<td>${brl(Math.max(v.minimo, km * v.porKm) + km * v.pedagioKm)}</td>`,
        )
        .join("");
      return `<tr>
        <th>${v.nome}</th>
        <td>até ${num(v.kg)} kg · ${num(v.m3)} m³</td>
        <td>${brl(v.porKm)}</td>
        <td>${brl(v.minimo)}</td>
        <td>${brl(v.pedagioKm)}</td>
        ${ex}
      </tr>`;
    }).join("");
    return `
      <table class="tp-tabela">
        <thead><tr>
          <th>Veículo</th><th>Capacidade</th><th>R$ / km</th><th>Mínimo da viagem</th><th>Pedágio / km</th>
          ${exemplos.map((km) => `<th>Exemplo ${num(km)} km*</th>`).join("")}
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>`;
  }

  function tabelaPrazos() {
    const linhas = DISTANCIAS.map((d) => {
      const ex = P.diasExpress(d.km);
      const fr = P.diasFracionada(d.km);
      const de = P.diasDedicado(d.km);
      return `<tr>
        <th>${d.rotulo}</th>
        <td>${ex === 1 ? "até 24h úteis" : `até ${ex} dias úteis`}</td>
        <td>${fr} a ${fr + 1} dias úteis</td>
        <td>${de === 0 ? "mesmo dia*" : `até ${de * 24}h`}</td>
      </tr>`;
    }).join("");
    return `
      <table class="tp-tabela">
        <thead><tr><th>Distância</th><th>Express</th><th>Fracionada</th><th>Dedicado</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>`;
  }

  function hoje() {
    const d = new Date();
    return {
      data: d.toLocaleDateString("pt-BR"),
      mes: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    };
  }

  /* ---------- documento completo ---------- */
  function montarHTML() {
    const { express, fracionada } = P.MODALIDADES;
    const h = hoje();
    const corte = `${P.PRAZO.corteColeta.hora}h${String(P.PRAZO.corteColeta.min).padStart(2, "0")}`;
    return `
<div class="tp">
  <style>
    .tp{font-family:"Plus Jakarta Sans","Segoe UI",Arial,sans-serif;color:#0f172a;font-size:9pt;line-height:1.4;background:#fff}
    .tp *{box-sizing:border-box}
    .tp-topo{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:3px solid #f26a1b}
    .tp-topo img{height:38px}
    .tp-doc{text-align:right}
    .tp-doc h1{margin:0;font-size:15pt;color:#0e2a5c}
    .tp-doc p{margin:2px 0 0;font-size:8pt;color:#64748b}
    .tp-intro{margin:12px 0 4px;padding:10px 12px;border-radius:8px;background:#eaf0fa;color:#0e2a5c;font-size:8.5pt}
    .tp-secao{margin-top:14px;break-inside:avoid;page-break-inside:avoid}
    .tp-secao h2{display:flex;align-items:baseline;gap:8px;margin:0 0 6px;font-size:11pt;color:#0e2a5c}
    .tp-secao h2 span{font-size:8pt;font-weight:600;color:#f26a1b}
    .tp-secao > p{margin:0 0 6px;font-size:8pt;color:#64748b}
    .tp-tabela{width:100%;border-collapse:collapse;font-size:8pt}
    .tp-tabela th,.tp-tabela td{padding:5px 6px;border:1px solid #e2e8f0;text-align:right;white-space:nowrap}
    .tp-tabela thead th{background:#0e2a5c;color:#fff;font-weight:700;text-align:center}
    .tp-tabela tbody th{text-align:left;background:#f4f7fb;font-weight:600;color:#0e2a5c}
    .tp-tabela tbody tr:nth-child(even) td{background:#fafbfd}
    .tp-excedente th,.tp-excedente td{color:#64748b;font-style:italic}
    .tp-taxas{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin:0;padding:0;list-style:none}
    .tp-taxas li{display:flex;justify-content:space-between;gap:8px;padding:5px 8px;border-radius:6px;background:#f4f7fb;font-size:8pt}
    .tp-taxas strong{color:#0e2a5c;white-space:nowrap}
    .tp-notas{margin:14px 0 0;padding:10px 12px 10px 26px;border:1px solid #fcd9c2;border-radius:8px;background:#fff1e8;font-size:7.5pt;color:#475569}
    .tp-notas li{margin:2px 0}
    .tp-rodape{display:flex;justify-content:space-between;gap:12px;margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:7.5pt;color:#64748b}
  </style>

  <header class="tp-topo">
    <img src="/img/logo.svg" alt="VelozLog Transportes &amp; Logística">
    <div class="tp-doc">
      <h1>Tabela de Preços Referencial</h1>
      <p>Vigência: ${h.mes} · Emitida em ${h.data}</p>
    </div>
  </header>

  <p class="tp-intro">
    Valores de <strong>frete peso por CT-e</strong>, já com o peso tributável (o maior entre o peso real e o cubado,
    ${num(P.FATOR_CUBAGEM)} kg/m³). Somam-se as taxas da seção 4. Para o valor exato da sua carga,
    use a cotação instantânea em <strong>velozlog.com.br/frete.html</strong>.
  </p>

  <section class="tp-secao">
    <h2>1. Carga Fracionada <span>Econômico · mínimo ${brl(fracionada.minimo)} por CT-e</span></h2>
    ${tabelaFracionado(fracionada)}
  </section>

  <section class="tp-secao">
    <h2>2. Express Rodoviário <span>Prioridade no despacho · mínimo ${brl(express.minimo)} por CT-e</span></h2>
    ${tabelaFracionado(express)}
  </section>

  <section class="tp-secao">
    <h2>3. Dedicado / Veículo Exclusivo <span>Saída direta, sem paradas</span></h2>
    <p>Cobrado por km do menor veículo que comporta a carga (peso tributável e volume em m³).</p>
    ${tabelaDedicado()}
  </section>

  <section class="tp-secao">
    <h2>4. Taxas e condições</h2>
    <ul class="tp-taxas">
      <li><span>GRIS (gerenciamento de risco)</span><strong>${pct(P.GRIS_POR_MIL)} do valor da NF</strong></li>
      <li><span>Seguro RCTR-C / RCF-DC (ad valorem)</span><strong>${pct(P.SEGURO_POR_MIL)} do valor da NF</strong></li>
      <li><span>Pedágio (Fracionada e Express)</span><strong>${brl(P.PEDAGIO_FRACAO)} por fração de 100 kg a cada 100 km</strong></li>
      <li><span>Taxa de despacho (Fracionada e Express)</span><strong>${brl(P.DESPACHO)} por CT-e</strong></li>
      <li><span>Desconto corporativo</span><strong>${num(P.DESCONTO_PERCENTUAL)}% sobre o frete</strong></li>
      <li><span>Pagamento via PIX</span><strong>+ ${num(P.DESCONTO_PIX_PERCENTUAL, 1)}% de desconto</strong></li>
    </ul>
  </section>

  <section class="tp-secao">
    <h2>5. Prazos de entrega referenciais <span>Coleta no mesmo dia para pedidos até ${corte}</span></h2>
    ${tabelaPrazos()}
  </section>

  <ul class="tp-notas">
    <li>Valores referenciais, sujeitos à confirmação na cotação. Peso e medidas são conferidos na coleta.</li>
    <li>Nas faixas de distância, o preço considera o limite superior de cada faixa; rotas mais curtas dentro da faixa podem sair mais baratas.</li>
    <li>* Dedicado: exemplos com frete + pedágio. "Mesmo dia" vale para rotas de até ${num(P.PRAZO.dedicadoMesmoDiaKm)} km com coleta até ${corte}.</li>
    <li>Prazos em dias úteis, contados a partir da coleta, sem considerar feriados. Impostos (ICMS/ISS) conforme a legislação de cada UF.</li>
    <li>Taxas especiais (TDE, TRT, agendamento, ajudante) são cotadas à parte quando aplicáveis.</li>
  </ul>

  <footer class="tp-rodape">
    <span><strong>VelozLog Transportes &amp; Logística</strong></span>
    <span>Central 24h: 0800 700 8900 · atendimento@velozlog.com.br</span>
  </footer>
</div>`;
  }

  /* ---------- PDF ---------- */
  const HTML2PDF_URL =
    "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js";
  let carregando = null;
  function carregarHtml2pdf() {
    if (window.html2pdf) return Promise.resolve();
    if (!carregando) {
      carregando = new Promise((ok, falha) => {
        const s = document.createElement("script");
        s.src = HTML2PDF_URL;
        s.onload = ok;
        s.onerror = () => {
          carregando = null;
          falha(new Error("Não carregou o html2pdf"));
        };
        document.head.appendChild(s);
      });
    }
    return carregando;
  }

  async function baixarPDF() {
    await carregarHtml2pdf();
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const folha = document.createElement("div");
    folha.style.width = "186mm"; // A4 (210mm) menos as margens laterais
    folha.innerHTML = montarHTML();
    const nome = `Tabela-de-Precos-VelozLog-${new Date().toISOString().slice(0, 7)}.pdf`;
    const pdf = await window
      .html2pdf()
      .set({
        margin: [10, 12, 14, 12],
        filename: nome,
        image: { type: "jpeg", quality: 0.95 },
        // scrollX/scrollY = 0: sem isso, com a página rolada (o botão fica lá
        // embaixo) o html2canvas captura uma área vazia e o PDF sai em branco
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".tp-secao", "tr"] },
      })
      .from(folha)
      .toPdf()
      .get("pdf");
    const total = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Página ${i} de ${total}`, 198, 289, { align: "right" });
    }
    pdf.save(nome);
  }

  /* ---------- ligar na página ---------- */
  function iniciar() {
    document
      .querySelectorAll("[data-tabela-precos]")
      .forEach((el) => (el.innerHTML = montarHTML()));

    document.addEventListener("click", async (e) => {
      const botao = e.target.closest("[data-tabela-pdf]");
      if (!botao) return;
      e.preventDefault();
      if (botao.getAttribute("aria-busy") === "true") return;
      const rotulo = botao.querySelector("[data-rotulo]") || null;
      const textoOriginal = rotulo ? rotulo.textContent : null;
      botao.setAttribute("aria-busy", "true");
      if (rotulo) rotulo.textContent = "Gerando PDF…";
      try {
        await baixarPDF();
      } catch (erro) {
        console.error("tabela-precos.js: não gerou o PDF", erro);
        // sem internet para a biblioteca de PDF: abre a página da tabela para imprimir
        location.href = "/tabela-precos.html";
      } finally {
        botao.removeAttribute("aria-busy");
        if (rotulo) rotulo.textContent = textoOriginal;
      }
    });
  }

  window.VelozTabela = { montarHTML, baixarPDF };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
