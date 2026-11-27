/* VelozLog — Portal B2B (portal.html), tela após o login.
   Dados de DEMONSTRAÇÃO (ainda não há API): manifestos, indicadores e avisos.
   • Tabela "Monitoramento em Tempo Real": busca por CT-e, NF-e ou cidade + paginação
   • Botão de sincronizar (SEFAZ & Siga-Route) e "Há X min" atualizando sozinho
   • Menu da conta (Sair) · contadores dos indicadores · aviso nos módulos em implantação */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const POR_PAGINA = 5;

  /* ---------- manifestos (demonstração) ----------
     A lista fica em /js/manifestos.js: a mesma que a página de rastreio usa */
  const MANIFESTOS = (window.VelozManifestos && window.VelozManifestos.lista) || [];

  const ICONE_STATUS = {
    entrega:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6h12v10H2z" /><path d="M14 9h4l3 3.5V16h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></svg>',
    transito:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22v-8M12 14L6 4M12 14l6-10" /><path d="M6 4h0M18 4h0" /></svg>',
    hub: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="3.5" r="1.8" /><circle cx="12" cy="20.5" r="1.8" /><circle cx="3.5" cy="12" r="1.8" /><circle cx="20.5" cy="12" r="1.8" /><path d="M12 5.3v4.2M12 14.5v4.2M5.3 12h4.2M14.5 12h4.2" /></svg>',
    coleta:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>',
  };
  const ICONE_ALVO =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>';

  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const norm = (t) =>
    String(t)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // tira os acentos: "florianopolis" acha "Florianópolis"
      .toLowerCase();

  /* ---------- tabela + busca + paginação ---------- */
  const corpo = $("#pt-linhas");
  const busca = $("#pt-busca");
  let pagina = 1;
  let lista = MANIFESTOS;

  function linha(m) {
    const codigo = `CTE-${m.cte}`;
    return `<tr class="pt-entrando">
      <td class="pt-cte"><strong>${codigo}</strong><small>NF ${esc(m.nf)}</small></td>
      <td class="pt-destino"><strong>${esc(m.cidade)} / ${esc(m.uf)}</strong><small>De: Ind. ABC (Campinas SP)</small></td>
      <td><span class="pt-modalidade">${esc(m.mod)}</span></td>
      <td><span class="pt-status pt-status-${m.status}">${ICONE_STATUS[m.status]}${esc(m.rotulo)}</span></td>
      <td class="pt-eta${m.hoje ? " hoje" : ""}"><strong>${esc(m.eta)}</strong><small>${esc(m.obs)}</small></td>
      <td><a class="pt-rastrear" href="/rastreio.html?codigo=${codigo}&de=portal" aria-label="Rastrear ${codigo}" title="Rastrear ${codigo}">${ICONE_ALVO}</a></td>
    </tr>`;
  }

  function render() {
    const total = lista.length;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    pagina = Math.min(pagina, paginas);
    const inicio = (pagina - 1) * POR_PAGINA;
    const itens = lista.slice(inicio, inicio + POR_PAGINA);

    corpo.innerHTML = itens.length
      ? itens.map(linha).join("")
      : `<tr class="pt-vazio"><td colspan="6">Nenhum manifesto encontrado para “${esc(busca.value.trim())}”.</td></tr>`;

    $("#pt-contagem").textContent = `${total} ${total === 1 ? "remessa" : "remessas"}`;
    $("#pt-mostrando").textContent = busca.value.trim()
      ? `Mostrando ${itens.length} de ${total} resultado${total === 1 ? "" : "s"} da busca`
      : `Mostrando ${itens.length} de ${total} manifestos em trânsito`;

    $("#pt-paginas").innerHTML = Array.from({ length: paginas }, (_, i) => {
      const n = i + 1;
      return `<button type="button" data-pagina="${n}"${n === pagina ? ' aria-current="page"' : ""} aria-label="Página ${n}">${n}</button>`;
    }).join("");
    $("#pt-anterior").disabled = pagina === 1;
    $("#pt-proximo").disabled = pagina === paginas;
  }

  busca.addEventListener("input", () => {
    const termo = norm(busca.value.trim());
    lista = !termo
      ? MANIFESTOS
      : MANIFESTOS.filter((m) =>
          norm(`cte-${m.cte} ${m.cte} ${m.nf} ${m.nf.replace(".", "")} ${m.cidade} ${m.uf}`).includes(termo),
        );
    pagina = 1;
    render();
  });

  $("#pt-paginas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pagina]");
    if (!b) return;
    pagina = Number(b.dataset.pagina);
    render();
  });
  $("#pt-anterior").addEventListener("click", () => {
    pagina--;
    render();
  });
  $("#pt-proximo").addEventListener("click", () => {
    pagina++;
    render();
  });

  render();

  /* ---------- sincronização SEFAZ & Siga-Route ---------- */
  const horaSync = $("#pt-sync-hora");
  const haSync = $("#pt-sync-ha");
  const botaoSync = $("#pt-sync-botao");
  let ultimaSync = Date.now() - 2 * 60 * 1000; // "há 2 min" ao abrir

  const relogio = (d) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  function atualizarHa() {
    const min = Math.floor((Date.now() - ultimaSync) / 60000);
    haSync.textContent = min < 1 ? "(Agora)" : `(Há ${min} min)`;
  }

  horaSync.textContent = relogio(new Date(ultimaSync));
  atualizarHa();
  setInterval(atualizarHa, 30000);

  botaoSync.addEventListener("click", () => {
    if (botaoSync.classList.contains("girando")) return;
    botaoSync.classList.add("girando");
    haSync.textContent = "(Sincronizando…)";
    setTimeout(() => {
      ultimaSync = Date.now();
      horaSync.textContent = relogio(new Date(ultimaSync));
      atualizarHa();
      botaoSync.classList.remove("girando");
      avisar("Sincronização concluída", "SEFAZ e Siga-Route atualizados com sucesso.");
    }, 1400);
  });

  /* ---------- contadores dos indicadores ---------- */
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".pt-contador").forEach((el) => {
      const final = Number(el.dataset.valor);
      const digitos = Number(el.dataset.digitos || 0);
      const formatar = (v) =>
        el.hasAttribute("data-milhar")
          ? Math.round(v).toLocaleString("pt-BR")
          : String(Math.round(v)).padStart(digitos, "0");
      const inicio = performance.now();
      const DURACAO = 1400;
      el.textContent = formatar(0);
      const passo = (agora) => {
        const t = Math.min((agora - inicio) / DURACAO, 1);
        el.textContent = formatar(final * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
  }

  /* ---------- menu da conta (Sair) ---------- */
  const botaoConta = $("#pt-conta-botao");
  const menuConta = $("#pt-conta-menu");

  function abrirMenu(abrir) {
    menuConta.hidden = !abrir;
    botaoConta.setAttribute("aria-expanded", String(abrir));
  }
  botaoConta.addEventListener("click", (e) => {
    e.stopPropagation();
    abrirMenu(menuConta.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!menuConta.hidden && !menuConta.contains(e.target)) abrirMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") abrirMenu(false);
  });

  $("#pt-sair").addEventListener("click", () => {
    try {
      sessionStorage.removeItem("velozlog:sessao");
    } catch {
      /* ignora */
    }
    location.href = "/login.html";
  });

  /* ---------- aviso rápido (módulos em implantação) ---------- */
  const toast = $("#pt-toast");
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

  document.addEventListener("click", (e) => {
    const alvo = e.target.closest("[data-em-breve]");
    if (!alvo) return;
    e.preventDefault();
    avisar(
      alvo.dataset.emBreve,
      "Módulo em implantação. Por enquanto, fale com a Torre Dedicada ABC pelo WhatsApp ou Ramal 9099.",
    );
  });
})();
