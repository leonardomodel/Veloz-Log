/* VelozLog — base comum das telas do Portal B2B (portal.html, portal-manifestos.html…)
   Menu lateral e topo vêm de /partials (portal-lateral, portal-topo) pelo layout.js.
   Aqui ficam os comportamentos dessas partes, todos por "delegação" no document:
   funcionam mesmo que o menu chegue um instante depois do resto da página.
   • menu da conta (Ir para o site / Sair) · aviso rápido (toast) · módulos "em breve"
   Uso nas telas:  window.VelozPortal.avisar("Título", "Texto") */
(() => {
  "use strict";

  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------- aviso rápido (toast) ---------- */
  const toast = document.createElement("div");
  toast.className = "pt-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.hidden = true;
  document.body.appendChild(toast);
  let timerToast = null;

  function avisar(titulo, texto) {
    toast.innerHTML = `<strong>${esc(titulo)}</strong>${esc(texto)}`;
    toast.hidden = false;
    toast.style.animation = "none";
    void toast.offsetWidth; // reinicia a animação de entrada
    toast.style.animation = "";
    clearTimeout(timerToast);
    timerToast = setTimeout(() => (toast.hidden = true), 3800);
  }

  /* ---------- menu da conta ---------- */
  function abrirMenuConta(abrir) {
    const botao = document.getElementById("pt-conta-botao");
    const menu = document.getElementById("pt-conta-menu");
    if (!botao || !menu) return;
    menu.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
  }

  document.addEventListener("click", (e) => {
    const menu = document.getElementById("pt-conta-menu");

    // abre/fecha pelo botão da conta
    if (e.target.closest("#pt-conta-botao")) {
      abrirMenuConta(menu && menu.hidden);
      return;
    }
    // clique fora fecha
    if (menu && !menu.hidden && !menu.contains(e.target)) abrirMenuConta(false);

    // sair do portal
    if (e.target.closest("#pt-sair")) {
      try {
        sessionStorage.removeItem("velozlog:sessao");
      } catch {
        /* ignora */
      }
      location.href = "/login.html";
      return;
    }

    // módulos ainda em implantação
    const emBreve = e.target.closest("[data-em-breve]");
    if (emBreve) {
      e.preventDefault();
      avisar(
        emBreve.dataset.emBreve,
        "Módulo em implantação. Por enquanto, fale com a Torre Dedicada ABC pelo WhatsApp ou Ramal 9099.",
      );
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") abrirMenuConta(false);
  });

  /* =========================================================
     CENTRAL DE NOTIFICAÇÕES (sino do topo, em todas as telas do portal)
     Os avisos são montados a partir dos dados do portal (/js/manifestos.js):
     ocorrências tratadas, saídas para entrega, ocorrências da operação, entregas com
     comprovante, coleta a caminho, fatura a vencer e alerta da telemetria.
     "Lida" fica guardado neste navegador. Clicar leva à tela certa.
     ========================================================= */
  const CHAVE_LIDAS = "velozlog:notificacoes-lidas";
  const lerLidas = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(CHAVE_LIDAS) || "[]"));
    } catch {
      return new Set();
    }
  };
  const gravarLidas = (lidas) => {
    try {
      localStorage.setItem(CHAVE_LIDAS, JSON.stringify([...lidas].slice(-300)));
    } catch {
      /* sem armazenamento: só não lembra */
    }
  };

  const ICONES_NOT = {
    alerta: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h0" />',
    entrega: '<path d="M2 6h12v10H2z" /><path d="M14 9h4l3 3.5V16h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" />',
    ok: '<circle cx="12" cy="12" r="9" /><path d="M8.5 12l2.5 2.5 4.5-5" />',
    coleta: '<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M12 8v8M8 12h8" />',
    fatura: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" />',
    gps: '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" />',
    andamento: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />',
  };

  // "agora" · "há 12 min" · "há 3 h" · "ontem 16:40" · "24/11 14:28"
  function quando(ms) {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    if (min < 6 * 60) return `há ${Math.round(min / 60)} h`;
    const d = new Date(ms);
    const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dias = Math.round((hoje - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (dias === 0) return `hoje ${hm}`;
    if (dias === 1) return `ontem ${hm}`;
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hm}`;
  }

  function montarNotificacoes() {
    const D = window.VelozManifestos;
    if (!D) return [];
    const agora = Date.now();
    const hojeAs = (h, m) => {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return Math.min(d.getTime(), agora - 5 * 60000); // nunca no futuro
    };
    const lista = [];

    // 1) ocorrências registradas pelo cliente: a última atualização de cada uma
    (D.ocorrenciasCliente ? D.ocorrenciasCliente() : []).forEach((o) => {
      const ult = o.historico[o.historico.length - 1];
      const fase = D.ESTADOS_OC[o.estado].fase;
      lista.push({
        id: `oc:${o.protocolo}:${o.estado}`,
        tipo: fase === "aberta" ? "alerta" : fase === "encerrada" ? "ok" : "andamento",
        titulo: ult ? `Ocorrência ${o.protocolo} atualizada` : `Ocorrência ${o.protocolo} registrada`,
        texto: `${o.codigo} • ${o.status}${ult && ult.obs ? ` — ${ult.obs}` : ` — ${o.tipo}`}`,
        ts: ult ? ult.ts : o.criada,
        href: `/portal-manifestos.html?busca=${encodeURIComponent(o.protocolo)}`,
      });
    });

    // 2) cargas da operação (situação atual, com ocorrências tratadas aplicadas)
    const cargas = D.todos.map(D.efetivo);
    cargas
      .filter((m) => m.status === "entrega")
      .forEach((m, i) =>
        lista.push({
          id: `entrega:${m.cte}`,
          tipo: "entrega",
          titulo: `${D.codigo(m)} saiu para entrega`,
          texto: `${m.cidade}/${m.uf} • previsão ${String(m.eta).toLowerCase()}`,
          ts: hojeAs(7, 30) - i * 9 * 60000,
          href: `/rastreio.html?codigo=${encodeURIComponent(D.codigo(m))}&de=portal`,
        }),
      );
    cargas
      .filter((m) => m.status === "ocorrencia")
      .forEach((m, i) =>
        lista.push({
          id: `ocorrencia-op:${m.cte}`,
          tipo: "alerta",
          titulo: `Ocorrência na entrega: ${D.codigo(m)}`,
          texto: `${m.rotulo} • ${m.prev}`,
          ts: hojeAs(9, 10) - i * 47 * 60000,
          href: `/rastreio.html?codigo=${encodeURIComponent(D.codigo(m))}&de=portal`,
        }),
      );
    // entregas com comprovante dos últimos 3 dias
    cargas
      .filter((m) => m.status === "entregue" && m.pod)
      .forEach((m) => {
        const p = /(\d{2})\/(\d{2})\/(\d{4}) às (\d{2}):(\d{2})/.exec(m.pod.carimbo);
        if (!p) return;
        const ts = new Date(+p[3], +p[2] - 1, +p[1], +p[4], +p[5]).getTime();
        if (agora - ts > 3 * 86400000) return;
        lista.push({
          id: `pod:${m.cte}:${ts}`,
          tipo: "ok",
          titulo: `${D.codigo(m)} entregue`,
          texto: `Recebido por ${m.pod.recebedor} • comprovante (POD) disponível`,
          ts,
          href: `/portal-manifestos.html?pod=${encodeURIComponent(D.codigo(m))}`,
        });
      });

    // 3) coletas a caminho
    (D.coletas ? D.coletas() : [])
      .filter((c) => c.status === "caminho")
      .forEach((c) =>
        lista.push({
          id: `coleta:${c.protocolo}:caminho`,
          tipo: "coleta",
          titulo: `Coleta ${c.protocolo}: motorista a caminho`,
          texto: `${c.veiculo} • ${c.origem}`,
          ts: Math.min(c.criada + 50 * 60000, agora - 2 * 60000),
          href: `/rastreio.html?codigo=${encodeURIComponent(c.protocolo)}&de=portal`,
        }),
      );

    // 4) fatura em aberto (a mesma da tela de Faturas) e alerta da telemetria
    const ano = new Date().getFullYear();
    lista.push({
      id: `fatura:${ano}-1102`,
      tipo: "fatura",
      titulo: `Fatura #FAT-${ano}-1102 a vencer`,
      texto: `R$ 42.850,00 • vencimento 28/11 via DDA`,
      ts: hojeAs(6, 0),
      href: "/portal-faturas.html",
    });
    const alerta = (D.frota || []).find((v) => v.alerta);
    if (alerta)
      lista.push({
        id: `gps:${alerta.placa}`,
        tipo: "gps",
        titulo: `Alerta de rota: ${alerta.placa}`,
        texto: "BR-116 • tráfego lento na altura de Registro (SP)",
        ts: agora - 12 * 60000,
        href: "/portal-telemetria.html",
      });

    return lista.sort((a, b) => b.ts - a.ts).slice(0, 15);
  }

  let painelNot = null;
  let soNaoLidas = false;

  function criarPainel(botao) {
    const caixa = document.createElement("div");
    caixa.className = "pt-not";
    caixa.id = "pt-notificacoes";
    caixa.setAttribute("role", "dialog");
    caixa.setAttribute("aria-label", "Central de notificações");
    caixa.hidden = true;
    caixa.innerHTML = `
      <header class="pt-not-topo">
        <strong>Notificações <span class="pt-not-qtd" data-not-qtd></span></strong>
        <button type="button" class="pt-not-link" data-not-todas>Marcar todas como lidas</button>
      </header>
      <div class="pt-not-filtros" role="group" aria-label="Filtrar notificações">
        <button type="button" data-not-filtro="todas" aria-pressed="true">Todas</button>
        <button type="button" data-not-filtro="naolidas" aria-pressed="false">Não lidas</button>
      </div>
      <ul class="pt-not-lista" data-not-lista></ul>`;
    // fica ao lado do sino (o topo é posicionado; ver portal.css)
    botao.parentElement.appendChild(caixa);
    return caixa;
  }

  function desenharNotificacoes() {
    const botao = document.getElementById("pt-sino");
    if (!botao) return;
    const lidas = lerLidas();
    const todas = montarNotificacoes();
    const naoLidas = todas.filter((n) => !lidas.has(n.id));

    // número no sino
    const marca = botao.querySelector("i");
    if (marca) {
      marca.textContent = naoLidas.length > 9 ? "9+" : naoLidas.length || "";
      marca.hidden = naoLidas.length === 0;
    }
    botao.setAttribute(
      "aria-label",
      naoLidas.length ? `Notificações (${naoLidas.length} não lidas)` : "Notificações",
    );
    if (!painelNot) return;

    painelNot.querySelector("[data-not-qtd]").textContent = naoLidas.length ? `${naoLidas.length} não lidas` : "";
    const mostrar = soNaoLidas ? naoLidas : todas;
    painelNot.querySelector("[data-not-lista]").innerHTML = mostrar.length
      ? mostrar
          .map(
            (n) => `<li>
              <a class="pt-not-item pt-not-${n.tipo}${lidas.has(n.id) ? "" : " pt-not-nova"}" href="${esc(n.href)}" data-not-id="${esc(n.id)}">
                <span class="pt-not-icone"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES_NOT[n.tipo]}</svg></span>
                <span class="pt-not-texto">
                  <strong>${esc(n.titulo)}</strong>
                  <small>${esc(n.texto)}</small>
                  <em>${esc(quando(n.ts))}</em>
                </span>
              </a>
            </li>`,
          )
          .join("")
      : `<li class="pt-not-vazio">${soNaoLidas ? "Tudo em dia: nenhuma notificação não lida." : "Nenhuma notificação por enquanto."}</li>`;
    painelNot.querySelectorAll("[data-not-filtro]").forEach((b) =>
      b.setAttribute("aria-pressed", String((b.dataset.notFiltro === "naolidas") === soNaoLidas)),
    );
  }

  function abrirNotificacoes(abrir) {
    const botao = document.getElementById("pt-sino");
    if (!botao) return;
    // o topo pode ter sido trocado (versão nova do partial): recria o painel junto dele
    if (painelNot && !painelNot.isConnected) painelNot = null;
    if (!painelNot) painelNot = criarPainel(botao);
    painelNot.hidden = !abrir;
    botao.setAttribute("aria-expanded", String(abrir));
    if (abrir) desenharNotificacoes();
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#pt-sino")) {
      abrirNotificacoes(!painelNot || painelNot.hidden);
      return;
    }
    if (!painelNot || painelNot.hidden) return;

    const item = e.target.closest("[data-not-id]");
    if (item) {
      const lidas = lerLidas();
      lidas.add(item.dataset.notId);
      gravarLidas(lidas); // e segue o link
      return;
    }
    if (e.target.closest("[data-not-todas]")) {
      const lidas = lerLidas();
      montarNotificacoes().forEach((n) => lidas.add(n.id));
      gravarLidas(lidas);
      desenharNotificacoes();
      return;
    }
    const filtro = e.target.closest("[data-not-filtro]");
    if (filtro) {
      soNaoLidas = filtro.dataset.notFiltro === "naolidas";
      desenharNotificacoes();
      return;
    }
    // clique fora fecha
    if (!painelNot.contains(e.target)) abrirNotificacoes(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && painelNot && !painelNot.hidden) {
      abrirNotificacoes(false);
      const botao = document.getElementById("pt-sino");
      if (botao) botao.focus();
    }
  });

  // número no sino assim que o topo carregar, e sempre que uma ocorrência mudar
  document.addEventListener("layout:pronto", desenharNotificacoes);
  document.addEventListener("vl:ocorrencias", desenharNotificacoes);
  if (document.getElementById("pt-sino")) setTimeout(desenharNotificacoes, 0);

  window.VelozPortal = { avisar, esc };
})();
