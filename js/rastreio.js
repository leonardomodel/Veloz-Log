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
    coleta: { trilha: "Solicitar Coleta", url: "/portal-coleta.html#cl-historico", texto: "Voltar às coletas" },
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
  else naoEncontrado();

  // "Falar com atendimento": WhatsApp já com o código da carga
  const atendimento = $(".rt-suporte-btn");
  if (atendimento) {
    const cod = manifesto ? window.VelozManifestos.codigo(manifesto) : codigo;
    atendimento.dataset.whatsapp = cod
      ? `Olá! Preciso de ajuda com a entrega de código ${cod}.`
      : "Olá! Preciso de ajuda para rastrear uma entrega.";
  }

  /* ---------- comprovante de entrega (POD): ver e baixar ----------
     Só para pedidos entregues. A janela mostra o canhoto assinado e os dados da baixa;
     "Baixar PDF" imprime só a janela (o navegador oferece "Salvar como PDF"). */
  function prepararComprovante(m) {
    const acoes = $('[data-rt="comprovante"]');
    const janela = $("#rt-pod");
    if (!acoes || !janela || !m.pod) return;
    acoes.hidden = false;

    const p = m.pod;
    const cod = window.VelozManifestos.codigo(m);
    const [, dia, mes, ano, hora] = /(\d{2})\/(\d{2})\/(\d{4}) às (\d{2}:\d{2}:\d{2})/.exec(p.carimbo) || [];
    const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const dataCarimbo = dia ? `${dia} ${MESES[Number(mes) - 1]} ${ano}` : p.carimbo;
    const linha = (dt, dd) => `<div><dt>${esc(dt)}</dt><dd>${esc(dd)}</dd></div>`;

    $("#rt-pod-titulo").textContent = cod;
    // canhoto no MESMO padrão do Portal (Manifestos & CTEs → Comprovante Digital)
    const [d2, m2, a2] = dia ? [dia, MESES[Number(mes) - 1], ano] : ["", "", ""];
    $("#rt-pod-corpo").innerHTML = `
      <div class="gs-pod-secao-topo">
        <h3 class="rt-pod-sub">Digitalização do Canhoto Assinado</h3>
        <span class="gs-autenticado">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
          Autenticado
        </span>
      </div>
      <div class="gs-canhoto-moldura" role="img" aria-label="Canhoto assinado por ${esc(p.recebedor)} em ${esc(p.carimbo)}">
        <div class="gs-canhoto">
          <div class="gs-canhoto-topo">
            <span class="gs-canhoto-marca">VELOZLOG<small>Gestão de Cargas</small></span>
            <span class="gs-canhoto-doc">
              <b>COMPROVANTE DE ENTREGA - VELOZLOG</b>
              <span>Nº NF: ${esc(m.nf)}</span> <span>Data: ${dia ? `${dia}/${mes}/${ano}` : ""}</span>
            </span>
          </div>
          <div class="gs-canhoto-linha">Cliente: ${esc(m.dest || `${m.cidade} (${m.uf})`)}</div>
          <div class="gs-canhoto-linha">Destinatário: Recebido por ${esc(p.recebedor)}</div>
          <div class="gs-canhoto-assinatura">Entregue por: <i>${esc(p.entregador || "Equipe VelozLog")}</i></div>
          <div class="gs-canhoto-rodape">
            <span class="gs-carimbo-retangulo">ENTREGUE EM:<b>${esc(dataCarimbo)}</b>VELOZLOG - LOGÍSTICA</span>
            <span class="gs-carimbo-conferente">${esc(p.conferente || "")}</span>
            <span class="gs-carimbo-redondo">RECEBIDO<br>${esc(d2)} ${esc(m2)}<br>${esc(a2)}</span>
          </div>
          <div class="gs-canhoto-vols">Volumes: ${esc(m.vols || "—")} • Peso: ${m.kg ? esc(m.kg.toLocaleString("pt-BR")) : "—"} kg • ${esc(m.pedido || "")}</div>
        </div>
        <span class="gs-blockchain">Registro Imutável Blockchain <b>${esc(p.registro)}</b></span>
        <button type="button" class="gs-zoom" data-pod-zoom aria-pressed="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4M11 8v6M8 11h6" /></svg>
          <span>Zoom</span>
        </button>
      </div>
      <dl class="rt-pod-dados">
        ${linha("Data e hora da entrega", dia ? `${dia}/${mes}/${ano.slice(2)} • ${hora}` : p.carimbo)}
        ${linha("Recebedor", p.recebedor)}
        ${linha("Documento", p.doc)}
        ${linha("Local da baixa", p.local)}
        ${linha("Coordenadas (GPS)", `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)} (± ${p.raio} m)`)}
        ${linha("Origem", ORIGEM.nome)}
        ${linha("Destino", `${m.cidade} (${m.uf})`)}
        ${linha("Volumes e peso", `${m.vols || "—"} vol. • ${m.kg ? m.kg.toLocaleString("pt-BR") : "—"} kg`)}
        ${linha("Registro do comprovante", p.registro)}
      </dl>
      <p class="rt-pod-nota">Comprovante digital autenticado: assinatura, data, hora e posição GPS registradas pelo aplicativo do motorista no momento da entrega.</p>`;

    const abrir = () => {
      if (typeof janela.showModal === "function") {
        if (!janela.open) janela.showModal();
      } else janela.setAttribute("open", "");
    };
    const fechar = () => (typeof janela.close === "function" ? janela.close() : janela.removeAttribute("open"));

    function baixar() {
      const estavaAberta = janela.open;
      abrir();
      document.body.classList.add("rt-imprimindo");
      const titulo = document.title;
      document.title = `Comprovante-Entrega-${cod}`; // nome sugerido para o PDF
      window.print();
      document.title = titulo;
      document.body.classList.remove("rt-imprimindo");
      if (!estavaAberta) fechar();
    }

    document.addEventListener("click", (e) => {
      const zoom = e.target.closest("[data-pod-zoom]");
      if (zoom) {
        // amplia o canhoto (igual ao portal)
        const ampliado = zoom.closest(".gs-canhoto-moldura").classList.toggle("ampliado");
        zoom.setAttribute("aria-pressed", String(ampliado));
        zoom.querySelector("span").textContent = ampliado ? "Reduzir" : "Zoom";
      } else if (e.target.closest("[data-pod-ver]")) abrir();
      else if (e.target.closest("[data-pod-baixar]")) baixar();
      else if (e.target.closest("[data-pod-fechar]")) fechar();
      else if (e.target === janela) fechar(); // clique no fundo escuro
    });
  }

  // sem código, ou código que não existe: não mostra dados de exemplo
  function naoEncontrado() {
    document.title = "Rastreio não encontrado | VelozLog";
    const texto = codigo
      ? `Não encontramos nenhuma carga com o código <strong>${esc(codigo)}</strong>. Confira o código no seu CT-e ou no e-mail de despacho (formato VLZ-000000-UF) ou o protocolo da coleta (COL-0000-0000) e tente de novo.`
      : "Nenhum código informado. Volte e digite o código de rastreio ou o número do CT-e.";
    const resumo = $(".rt-resumo");
    if (resumo)
      resumo.innerHTML = `
        <div class="rt-resumo-topo">
          <div>
            <span class="rt-rotulo">Código de rastreamento</span>
            <strong class="rt-codigo">${esc(codigo || "—")}</strong>
          </div>
          <div class="rt-tags"><span class="rt-tag" data-situacao="ocorrencia"><i></i> Não encontrado</span></div>
        </div>
        <p class="rt-subtitulo">${texto}</p>`;
    // histórico e informações seriam de exemplo: some com eles (fica só o suporte)
    const historico = $(".rt-historico");
    if (historico) historico.hidden = true;
    const info = $(".rt-info");
    if (info) info.hidden = true;
    definir("codigo", codigo || "—");
  }

  function preencher(m) {
    const info = window.VelozManifestos.situacao(m); // etiqueta, % e etapa
    const destino = `${m.cidade} (${m.uf})`;
    const entregaHoje = m.status === "entrega";
    ORIGEM = window.VelozManifestos.origem(m);

    document.title = `${window.VelozManifestos.codigo(m)} — ${destino} | VelozLog`;

    // ocorrência do cliente AINDA ABERTA (em análise / aguardando cliente).
    // Depois de tratada, quem manda é a situação da carga (m já vem com ela aplicada).
    const comOcorrenciaCliente = !!(
      window.VelozManifestos.ocorrenciaAberta && window.VelozManifestos.ocorrenciaAberta(m.cte)
    );

    // etiqueta de status (com ocorrência do cliente: "Ocorrência registrada", em vermelho)
    const etiqueta = $('[data-rt="status"]');
    etiqueta.innerHTML = `<i></i> ${esc(comOcorrenciaCliente ? "Ocorrência registrada" : info.tag)}`;
    etiqueta.dataset.situacao = comOcorrenciaCliente ? "ocorrencia" : m.status; // cor (rastreio.css)

    // rota e previsão
    definir("origem", ORIGEM.nome);
    definir("origem-sub", ORIGEM.sub);
    definir("destino", destino);
    definir("destino-sub", ESTADOS[m.uf] || m.uf);
    // entregue: só a data (ano com 2 dígitos) e a hora, numa linha — ex.: 24/11/26 • 14:28
    const pod = m.status === "entregue" && m.pod && /(\d{2})\/(\d{2})\/\d{2}(\d{2}) às (\d{2}:\d{2})/.exec(m.pod.carimbo);
    if (pod) {
      definir("previsao-rotulo", m.devolvido ? "Devolvido em" : "Entregue em");
      definir("previsao", `${pod[1]}/${pod[2]}/${pod[3]} • ${pod[4]}`);
      $$('[data-rt="previsao"]').forEach((el) => el.classList.add("rt-uma-linha"));
      prepararComprovante(m);
    } else {
      // ocorrência em tratamento: mostra só a fase (Despacho, Nova tentativa de entrega…)
      if (m.emTratamento) definir("previsao-rotulo", "Situação da entrega");
      if (m.rotuloPrevisao) definir("previsao-rotulo", m.rotuloPrevisao); // coleta
      definir("previsao", m.eta);
    }
    definir("previsao-nota", m.obs);
    // sem descrição (ex.: fases do tratamento): some com a linha de baixo
    $$('[data-rt="previsao-nota"]').forEach((el) => (el.hidden = !m.obs));
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
    // coleta (protocolo COL-…): etapas próprias da coleta
    const nomesEtapas = m.etapas
      ? [...m.etapas]
      : [
          m.status === "coleta" ? "Aguardando coleta" : "Coleta realizada",
          "No centro de distribuição",
          ocorrencia ? "Ocorrência na entrega" : entregaHoje ? "Saiu para entrega" : "Em trânsito",
          "Entregue",
        ];
    // etapa marcada com alerta: a atual (ou a última, se já entregue) quando há ocorrência
    // registrada pelo cliente; senão, a atual quando a própria carga está em ocorrência
    const etapaAlerta = comOcorrenciaCliente
      ? Math.min(info.etapa, nomesEtapas.length - 1)
      : ocorrencia
        ? info.etapa
        : -1;
    if (comOcorrenciaCliente) nomesEtapas[etapaAlerta] = "Ocorrência registrada";
    // ocorrência em tratamento: a etapa atual ganha o nome da nova fase
    // (ex.: "Em despacho (nova tentativa)", "Saiu para entrega (nova tentativa)")
    else if (m.etapaNome && info.etapa < nomesEtapas.length) nomesEtapas[info.etapa] = m.etapaNome;
    if (m.devolvido) nomesEtapas[nomesEtapas.length - 1] = "Devolvido ao remetente";

    // ícone da etapa: ✓ nas já alcançadas (inclusive a atual) · alerta na etapa com ocorrência
    // · número só nas que ainda vão acontecer
    const iconeEtapa = (i) =>
      i === etapaAlerta ? ALERTA : i <= info.etapa ? "✓" : String(i + 1).padStart(2, "0");

    $('[data-rt="etapas"]').innerHTML = nomesEtapas
      .map((nome, i) => {
        let classe = i < info.etapa ? " rt-feita" : i === info.etapa ? " rt-atual" : "";
        if (i === etapaAlerta) classe += " rt-ocorrencia";
        return `<li class="rt-etapa${classe}"><span class="rt-etapa-icone">${iconeEtapa(i)}</span> ${esc(nome)}</li>`;
      })
      .join("");

    // a barra acompanha as ETAPAS (não o % do trajeto): termina na etapa atual
    // e só fica cheia quando a carga for entregue
    // entregue: barra verde (rastreio.css)
    barra.classList.toggle("rt-barra-entregue", m.status === "entregue");
    const ajustarBarra = () => {
      if (info.etapa >= nomesEtapas.length) {
        barra.style.width = "100%";
        return;
      }
      const itens = [...$$('[data-rt="etapas"] .rt-etapa')];
      const atual = itens[info.etapa];
      const trilho = $(".rt-barra");
      const t = trilho && trilho.getBoundingClientRect();
      if (!atual || !t || !t.width) return;
      let pct;
      if (atual.offsetTop !== itens[0].offsetTop) {
        // etapas quebradas em 2 linhas (celular): proporção pela posição da etapa
        pct = ((info.etapa + 0.5) / nomesEtapas.length) * 100;
      } else {
        // fim do texto da etapa atual, com uma pequena folga
        const faixa = document.createRange();
        faixa.selectNodeContents(atual);
        pct = ((faixa.getBoundingClientRect().right - t.left + 8) / t.width) * 100;
      }
      barra.style.width = Math.min(100, Math.max(4, pct)) + "%";
    };
    ajustarBarra();
    // a fonte do site pode chegar depois e mudar a largura do texto: mede de novo
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarBarra);
    let timerBarra = null;
    window.addEventListener("resize", () => {
      clearTimeout(timerBarra);
      timerBarra = setTimeout(ajustarBarra, 120);
    });

    // histórico (mais recentes primeiro) — o evento atual usa o mesmo ícone da etapa atual;
    // ocorrências anteriores (tipo "ocorrencia") ganham o ícone de alerta
    // movimentações da operação: sempre da carga ORIGINAL (o tratamento da
    // ocorrência entra abaixo, como eventos próprios, sem duplicar a entrega)
    const original = m.original || m;
    const eventos = historico(original, destino);
    // o evento que representa a situação atual da carga
    const eventoAtual = eventos[0];

    // data e hora de cada movimentação (ts, em ms). Sem horário real nos dados de
    // demonstração: distribui do despacho (08:00) até a movimentação mais recente —
    // a entrega (comprovante) ou hoje de manhã, nunca no futuro.
    if (!eventos.some((ev) => ev.quando)) {
      const datas = window.VelozManifestos.datas;
      const agora = Date.now();
      const emDia = (n, h, min) => {
        const d = datas.dia(n);
        d.setHours(h, min, 0, 0);
        return d.getTime();
      };
      const pod = original.pod && /(\d{2})\/(\d{2})\/(\d{4}) às (\d{2}):(\d{2})/.exec(original.pod.carimbo);
      let recente = pod
        ? new Date(+pod[3], +pod[2] - 1, +pod[1], +pod[4], +pod[5]).getTime()
        : emDia(0, 7, 40);
      // com ocorrência do cliente, a operação parou antes do 1º registro dela
      const primeiraOc = Math.min(
        ...(window.VelozManifestos.ocorrenciasCliente ? window.VelozManifestos.ocorrenciasCliente(m.cte) : []).map((o) => o.criada),
        agora,
      );
      recente = Math.min(recente, agora - 40 * 60000, primeiraOc - 20 * 60000);
      let antigo = Math.min(emDia(Math.min(original.dias || 0, 0), 8, 0), recente - 60 * 60000);
      const passo = eventos.length > 1 ? (recente - antigo) / (eventos.length - 1) : 0;
      eventos.forEach((ev, i) => (ev.ts = Math.round(recente - passo * i)));
    }
    const dataHora = (ms) => {
      const d = new Date(ms);
      return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    };
    // "Agora" só nos primeiros 30 minutos; depois, a data e a hora
    const quandoDe = (ev) =>
      ev.ts ? (Date.now() - ev.ts < 30 * 60000 ? "Agora" : dataHora(ev.ts)) : ev.quando || "Concluído";
    // ocorrências registradas pelo cliente no portal: são o fato mais recente,
    // então entram no TOPO (mais recentes primeiro), acima da situação atual
    const doCliente = window.VelozManifestos.ocorrenciasCliente
      ? window.VelozManifestos.ocorrenciasCliente(m.cte)
      : [];
    if (doCliente.length) {
      const VM = window.VelozManifestos;
      const daOcorrencia = [];
      doCliente.forEach((o) => {
        // o registro feito pelo cliente
        daOcorrencia.push({
          titulo: `Ocorrência registrada pelo cliente: ${o.tipo}`,
          local: `Protocolo ${o.protocolo}`,
          texto: o.descricao,
          ts: o.criada, // data e hora em que o cliente lançou
          tipo: "ocorrencia",
          doCliente: true,
        });
        // cada passo do tratamento (pendência solucionada, nova tentativa, entrega…)
        (o.historico || []).forEach((h) => {
          const fase = VM.ESTADOS_OC[h.estado] ? VM.ESTADOS_OC[h.estado].fase : "aberta";
          const recebido = h.recebedor ? `Recebido por ${h.recebedor}${h.doc ? ` (doc. ${h.doc})` : ""}.` : "";
          daOcorrencia.push({
            titulo: (VM.EVENTOS_OC && VM.EVENTOS_OC[h.estado]) || h.estado,
            local: `Protocolo ${o.protocolo} • ${VM.ESTADOS_OC[h.estado] ? VM.ESTADOS_OC[h.estado].rotulo : ""}`,
            texto: [h.obs, recebido].filter(Boolean).join(" ") || "Atualização registrada pela Torre de Controle.",
            ts: h.ts,
            // fases abertas (análise / aguardando cliente) seguem em alerta; as demais são avanço normal
            tipo: fase === "aberta" ? "ocorrencia" : "andamento",
            doCliente: true,
          });
        });
      });
      daOcorrencia.sort((a, b) => b.ts - a.ts); // mais recentes primeiro
      eventos.unshift(...daOcorrencia);
    }

    const listaHistorico = $('[data-rt="historico"]');
    listaHistorico.innerHTML = eventos
      .map((ev, i) => {
        // destaque só na movimentação MAIS RECENTE (a 1ª da lista); as outras ficam normais
        const destaque = i === 0;
        const ehOcorrencia = ev.tipo === "ocorrencia" || (ev === eventoAtual && ocorrencia);
        const classes = [
          "rt-evento",
          destaque && "rt-evento-atual",
          destaque && ehOcorrencia && "rt-evento-ocorrencia",
          !destaque && ehOcorrencia && "rt-evento-alerta",
        ]
          .filter(Boolean)
          .join(" ");
        const icone = ehOcorrencia ? ALERTA : "✓";
        // entregue: a última movimentação mostra "Finalizado" (com a data no texto do comprovante)
        const status = destaque && ev === eventoAtual && info.etapa === 4 && !ev.ts ? "Finalizado" : quandoDe(ev);
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
    // coleta: veículo, motorista, volumes e ponto de coleta (m.info)
    $('[data-rt="info"]').innerHTML = (m.info || [
      ["Modal", "Rodoviário"],
      ["Modalidade", m.mod],
      ["CT-e", `CTE-${m.cte}`],
      ["Nota fiscal", `NF ${m.nf}`],
      ["Origem", ORIGEM.nome],
      ["Destino", destino],
      ["Proteção da carga", "Seguro incluso"],
    ])
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
    // cópia: as ocorrências do cliente entram na lista sem alterar os dados originais
    if (Array.isArray(m.eventos) && m.eventos.length) return [...m.eventos];

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
