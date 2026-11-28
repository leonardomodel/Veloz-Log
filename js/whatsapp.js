/* VelozLog — botões "Falar no WhatsApp"
   Uso no HTML:  <a href="#" data-whatsapp>Falar no WhatsApp</a>
                 (opcional) data-whatsapp="Mensagem que já vem escrita"

   • Celular: abre direto o app do WhatsApp na conversa da VelozLog.
   • Computador: pergunta onde abrir — no aplicativo do WhatsApp ou no navegador (WhatsApp Web).
     A escolha fica lembrada: nas próximas vezes abre direto (dá para trocar no próprio menu).
   • Sem JavaScript: o link continua funcionando (página oficial do WhatsApp). */
(() => {
  "use strict";

  /* ======== CONFIGURAÇÃO ========
     Número da VelozLog com DDI + DDD, só dígitos (ex.: 55 41 99999-9999 → "5541999999999"). */
  const NUMERO = "5541999999999"; // ⚠️ TROCAR pelo WhatsApp real da empresa
  const MENSAGEM_PADRAO =
    "Olá! Vim pelo site da VelozLog e quero falar com um especialista sobre uma operação sob medida para a minha empresa.";
  const CHAVE_ESCOLHA = "velozlog:whatsapp-destino"; // "app" | "web"

  const ehCelular = () =>
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); // iPad novo

  const consulta = (texto) =>
    `phone=${NUMERO}&text=${encodeURIComponent(texto)}`;
  const links = (texto) => ({
    oficial: `https://api.whatsapp.com/send?${consulta(texto)}`, // celular abre o app
    app: `whatsapp://send?${consulta(texto)}`, // WhatsApp para Windows/Mac
    web: `https://web.whatsapp.com/send?${consulta(texto)}`, // WhatsApp Web
  });

  function lembrar(valor) {
    try {
      if (valor) localStorage.setItem(CHAVE_ESCOLHA, valor);
      else localStorage.removeItem(CHAVE_ESCOLHA);
    } catch {
      /* navegador sem armazenamento: só não lembra */
    }
  }
  function escolhaSalva() {
    try {
      return localStorage.getItem(CHAVE_ESCOLHA);
    } catch {
      return null;
    }
  }

  function abrir(destino, texto, botao) {
    const l = links(texto);
    if (destino !== "app") {
      window.open(l.web, "_blank", "noopener");
      return;
    }
    // se o app não estiver instalado nada acontece: percebemos (a página não perde o foco)
    // e oferecemos o WhatsApp Web, esquecendo a escolha "app"
    let saiu = false;
    const marcar = () => (saiu = true);
    window.addEventListener("blur", marcar, { once: true });
    document.addEventListener("visibilitychange", marcar, { once: true });
    location.href = l.app;
    setTimeout(() => {
      window.removeEventListener("blur", marcar);
      document.removeEventListener("visibilitychange", marcar);
      if (!saiu && document.hasFocus() && botao) {
        lembrar(null);
        mostrarMenu(
          botao,
          texto,
          "Não encontramos o aplicativo. Que tal o WhatsApp Web?",
        );
      }
    }, 2500);
  }

  /* ---------- menu "abrir no app / no navegador" (computador) ---------- */
  const CSS = `
    .wa-menu{position:fixed;z-index:9999;width:280px;padding:8px;border-radius:14px;background:#fff;
      box-shadow:0 18px 50px rgba(15,23,42,.28);font-family:inherit;animation:wa-entra .15s ease}
    @keyframes wa-entra{from{opacity:0;transform:translateY(6px)}}
    .wa-menu p{margin:4px 8px 8px;font-size:12px;font-weight:600;color:#64748b}
    .wa-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:10px;border:0;border-radius:10px;
      background:none;font:inherit;font-size:14px;font-weight:600;color:#0e2a5c;text-align:left;cursor:pointer}
    .wa-menu button:hover,.wa-menu button:focus-visible{background:#f4f7fb;outline:0}
    .wa-menu button small{display:block;font-size:11.5px;font-weight:500;color:#64748b}
    .wa-menu svg{flex-shrink:0;width:30px;height:30px;padding:6px;border-radius:8px;background:#e7f7ec;
      fill:none;stroke:#16a34a;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .wa-menu label{display:flex;align-items:center;gap:6px;margin:6px 8px 2px;font-size:11.5px;color:#64748b;cursor:pointer}
  `;
  let menuAberto = null;

  function fecharMenu() {
    if (!menuAberto) return;
    menuAberto.remove();
    menuAberto = null;
    document.removeEventListener("pointerdown", foraDoMenu, true);
    document.removeEventListener("keydown", escMenu);
  }
  const foraDoMenu = (e) => {
    if (menuAberto && !menuAberto.contains(e.target)) fecharMenu();
  };
  const escMenu = (e) => {
    if (e.key === "Escape") fecharMenu();
  };

  function mostrarMenu(botao, texto, aviso) {
    fecharMenu();
    if (!document.getElementById("wa-menu-css")) {
      const s = document.createElement("style");
      s.id = "wa-menu-css";
      s.textContent = CSS;
      document.head.appendChild(s);
    }
    const menu = document.createElement("div");
    menu.className = "wa-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <p>${aviso || "Onde você quer abrir a conversa?"}</p>
      <button type="button" role="menuitem" data-destino="app">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
        <span>Aplicativo do WhatsApp<small>Instalado no computador</small></span>
      </button>
      <button type="button" role="menuitem" data-destino="web">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
        <span>WhatsApp Web<small>Abre numa nova aba do navegador</small></span>
      </button>
      <label><input type="checkbox" checked> Lembrar minha escolha</label>`;
    document.body.appendChild(menu);
    menuAberto = menu;

    // posiciona abaixo do botão (ou acima, se não couber)
    const r = botao.getBoundingClientRect();
    const alt = menu.offsetHeight;
    const top =
      r.bottom + 8 + alt > innerHeight ? r.top - alt - 8 : r.bottom + 8;
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - 140),
      innerWidth - 288,
    );
    menu.style.top = `${Math.max(8, top)}px`;
    menu.style.left = `${left}px`;

    menu.addEventListener("click", (e) => {
      const opcao = e.target.closest("[data-destino]");
      if (!opcao) return;
      const destino = opcao.dataset.destino;
      lembrar(menu.querySelector("input").checked ? destino : null);
      fecharMenu();
      abrir(destino, texto, botao);
    });
    setTimeout(() => {
      document.addEventListener("pointerdown", foraDoMenu, true);
      document.addEventListener("keydown", escMenu);
    });
    menu.querySelector("button").focus();
  }

  /* ---------- ligar os botões ---------- */
  function iniciar() {
    document.querySelectorAll("a[data-whatsapp]").forEach((a) => {
      const texto = a.dataset.whatsapp || MENSAGEM_PADRAO;
      a.href = links(texto).oficial; // funciona mesmo sem este script
      a.target = "_blank";
      a.rel = "noopener";
    });

    document.addEventListener("click", (e) => {
      const a = e.target.closest("[data-whatsapp]");
      if (!a) return;
      const texto = a.dataset.whatsapp || MENSAGEM_PADRAO;
      if (ehCelular()) {
        // link: segue o link (o celular abre direto o app) · botão: abre o mesmo link
        if (a.tagName !== "A") window.open(links(texto).oficial, "_blank", "noopener");
        else a.href = links(texto).oficial; // a mensagem pode ter mudado depois de carregar
        return;
      }
      e.preventDefault();
      conversar(texto, a, e.shiftKey);
    });
  }

  // abre a conversa (pergunta app ou navegador no computador; lembra a escolha)
  function conversar(texto, botao, perguntar = false) {
    texto = texto || MENSAGEM_PADRAO;
    if (ehCelular()) {
      window.open(links(texto).oficial, "_blank", "noopener");
      return;
    }
    const salva = escolhaSalva();
    // Shift + clique sempre mostra o menu (para trocar a escolha lembrada)
    if (salva && !perguntar) abrir(salva, texto, botao);
    else mostrarMenu(botao, texto);
  }

  // único lugar com o número: as outras páginas (cotação, portal) usam daqui
  window.VelozWhatsApp = Object.freeze({
    NUMERO,
    link: (texto) => links(texto || MENSAGEM_PADRAO).oficial,
    conversar,
  });

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
