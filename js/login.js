/* VelozLog — Área do Cliente (login.html)
   • CNPJ ou e-mail: o CNPJ ganha máscara automática e tem os dígitos verificadores conferidos
   • Senha: botão do "olho" mostra/oculta
   • "Lembrar este terminal": guarda SÓ o CNPJ/e-mail neste navegador (nunca a senha)
   • Ainda não existe servidor de autenticação: em MODO_DEMONSTRACAO, CNPJ/e-mail e senha
     válidos abrem o Portal B2B (portal.html) com dados de exemplo. Quando houver API, troque autenticar(). */
(() => {
  "use strict";

  const CHAVE_LEMBRAR = "velozlog:login-usuario";
  const TELEFONE = "0800 700 8900";

  const $ = (s) => document.querySelector(s);
  const form = $("#lg-form");
  if (!form) return;

  const usuario = $("#lg-usuario");
  const senha = $("#lg-senha");
  const olho = $("#lg-olho");
  const lembrar = $("#lg-lembrar");
  const botao = $("#lg-entrar");
  const rotuloBotao = botao.querySelector("[data-rotulo]");
  const aviso = $("#lg-aviso");

  /* ---------- CNPJ / e-mail ---------- */
  const soDigitos = (t) => t.replace(/\D/g, "");
  const pareceCnpj = (t) => t !== "" && /^[\d.\-/\s]+$/.test(t);
  const emailValido = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);

  function formatarCnpj(d) {
    d = d.slice(0, 14);
    return d
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function cnpjValido(d) {
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const digito = (base) => {
      let soma = 0;
      let peso = base.length - 7;
      for (const n of base) {
        soma += Number(n) * peso--;
        if (peso < 2) peso = 9;
      }
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    const d1 = digito(d.slice(0, 12));
    const d2 = digito(d.slice(0, 12) + d1);
    return d.endsWith(`${d1}${d2}`);
  }

  usuario.addEventListener("input", () => {
    limparErro(usuario);
    esconderAviso();
    const v = usuario.value;
    if (pareceCnpj(v)) usuario.value = formatarCnpj(soDigitos(v));
  });

  senha.addEventListener("input", () => {
    limparErro(senha);
    esconderAviso();
  });

  /* ---------- mostrar / ocultar senha ---------- */
  olho.addEventListener("click", () => {
    const mostrar = senha.type === "password";
    senha.type = mostrar ? "text" : "password";
    olho.setAttribute("aria-pressed", String(mostrar));
    olho.setAttribute("aria-label", mostrar ? "Ocultar senha" : "Mostrar senha");
    senha.focus();
  });

  /* ---------- lembrar terminal ---------- */
  try {
    const salvo = localStorage.getItem(CHAVE_LEMBRAR);
    if (salvo) {
      usuario.value = salvo;
      lembrar.checked = true;
    }
  } catch {
    /* navegador sem armazenamento: só não lembra */
  }

  function guardarUsuario() {
    try {
      if (lembrar.checked) localStorage.setItem(CHAVE_LEMBRAR, usuario.value.trim());
      else localStorage.removeItem(CHAVE_LEMBRAR);
    } catch {
      /* ignora */
    }
  }

  /* ---------- erros e avisos ---------- */
  function marcarErro(campo, mensagem) {
    const bloco = campo.closest(".lg-campo");
    bloco.classList.remove("tem-erro");
    void bloco.offsetWidth; // reinicia a animação de "tremer"
    bloco.classList.add("tem-erro");
    campo.setAttribute("aria-invalid", "true");
    $(`#${campo.getAttribute("aria-describedby")}`).textContent = mensagem;
  }

  function limparErro(campo) {
    campo.closest(".lg-campo").classList.remove("tem-erro");
    campo.removeAttribute("aria-invalid");
    $(`#${campo.getAttribute("aria-describedby")}`).textContent = "";
  }

  function mostrarAviso(html) {
    aviso.innerHTML = html;
    aviso.hidden = false;
  }

  function esconderAviso() {
    aviso.hidden = true;
  }

  const avisoContato = (inicio) =>
    `${inicio} Fale com a Mesa de Operações B2B: <a href="tel:${soDigitos(TELEFONE)}">${TELEFONE}</a>.`;

  function validar() {
    const u = usuario.value.trim();
    let primeiroErro = null;

    if (!u) {
      marcarErro(usuario, "Informe o CNPJ ou o e-mail cadastrado.");
      primeiroErro = usuario;
    } else if (pareceCnpj(u)) {
      if (!cnpjValido(soDigitos(u))) {
        marcarErro(usuario, "CNPJ inválido. Confira os 14 números.");
        primeiroErro = usuario;
      }
    } else if (!emailValido(u)) {
      marcarErro(usuario, "E-mail inválido. Ex.: embarcador@empresa.com.br");
      primeiroErro = usuario;
    }

    if (!senha.value) {
      marcarErro(senha, "Informe a chave de acesso.");
      primeiroErro = primeiroErro || senha;
    } else if (senha.value.length < 6) {
      marcarErro(senha, "A chave de acesso tem no mínimo 6 caracteres.");
      primeiroErro = primeiroErro || senha;
    }

    if (primeiroErro) primeiroErro.focus();
    return !primeiroErro;
  }

  /* ---------- autenticação ----------
     Ainda sem servidor: em MODO_DEMONSTRACAO, qualquer CNPJ/e-mail e senha
     válidos entram no portal com os dados de exemplo. Com uma API, troque por
     um fetch e use MODO_DEMONSTRACAO = false. */
  const MODO_DEMONSTRACAO = true;
  const PAGINA_PORTAL = "/portal.html";

  // login pedido por outra tela (ex.: "Contratar Coleta Imediata" da cotação):
  // depois de entrar, vai direto para lá com os dados da carga (só destinos conhecidos)
  const DESTINOS = { coleta: "/portal-coleta.html" };
  const pedido = new URLSearchParams(location.search);
  const destino = DESTINOS[pedido.get("destino")] || null;
  function paginaDepoisDoLogin() {
    if (!destino) return PAGINA_PORTAL;
    const q = new URLSearchParams();
    ["v", "p"].forEach((k) => pedido.get(k) && q.set(k, pedido.get(k)));
    return q.toString() ? `${destino}?${q}` : destino;
  }
  if (destino) {
    const sub = $(".lg-sub");
    if (sub) sub.textContent = "Entre com o CNPJ ou e-mail da sua empresa para agendar a coleta da sua cotação.";
  }

  function autenticar(login) {
    return new Promise((ok) =>
      setTimeout(
        () => ok({ liberado: MODO_DEMONSTRACAO, login }),
        MODO_DEMONSTRACAO ? 900 : 1200,
      ),
    );
  }

  function abrirPortal(login) {
    try {
      // o portal só abre com esta marca de sessão (some ao fechar o navegador)
      sessionStorage.setItem(
        "velozlog:sessao",
        JSON.stringify({ login, desde: Date.now() }),
      );
    } catch {
      /* sem sessionStorage: o portal abre mesmo assim */
    }
    location.href = paginaDepoisDoLogin();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    esconderAviso();
    if (!validar()) return;

    guardarUsuario();
    botao.disabled = true;
    botao.classList.add("carregando");
    rotuloBotao.textContent = "Validando credenciais…";

    const resposta = await autenticar(usuario.value.trim(), senha.value);

    if (resposta.liberado) {
      rotuloBotao.textContent = "Acesso liberado…";
      abrirPortal(resposta.login);
      return;
    }

    botao.disabled = false;
    botao.classList.remove("carregando");
    rotuloBotao.textContent = "Acessar Área do Cliente";

    if (!resposta.liberado) {
      mostrarAviso(
        avisoContato(
          "<strong>Acesso ainda não liberado para este cadastro.</strong> O Portal do Embarcador está em implantação.",
        ),
      );
    }
  });

  /* ---------- certificado digital ---------- */
  $("#lg-certificado").addEventListener("click", () => {
    mostrarAviso(
      avisoContato(
        "<strong>Login por certificado digital (A1 ou A3) em breve.</strong> Por enquanto, use CNPJ ou e-mail e a chave de acesso.",
      ),
    );
  });
})();
