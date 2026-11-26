/* VelozLog — formulários de cotação da página inicial.
   Vale para "Calcular Frete em 1 Minuto" (seção Cotação) e "Calcular Cotação Instantânea" (aba Simular Frete).
   Valida os campos do PRÓPRIO formulário e abre /frete.html já com os dados.
   Os campos são localizados pelo texto do rótulo, dentro do formulário do botão. */
(() => {
  "use strict";

  const soDigitos = (t) => String(t || "").replace(/\D/g, "");
  const norm = (t) =>
    String(t || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  // número digitado em pt-BR ("1.250,5", "45", "45,5", "R$ 15.000,00") → number
  function lerNumero(t) {
    let v = String(t || "").replace(/R\$|\s/g, "");
    if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  }

  /* ---------- botões de cotação e o formulário de cada um ---------- */
  const TEXTO_BOTAO = /calcular\s+(frete|cotacao)/;

  function ehBotao(el) {
    const b = el && el.closest && el.closest("button, a, input[type='submit']");
    return !!b && TEXTO_BOTAO.test(norm(b.textContent || b.value));
  }
  const botoes = () =>
    [...document.querySelectorAll("button, a, input[type='submit']")].filter(
      (b) => TEXTO_BOTAO.test(norm(b.textContent || b.value)),
    );

  function escopoDe(botao) {
    return (
      botao.closest("form") ||
      botao.closest("section") ||
      botao.parentElement ||
      document
    );
  }

  /* ---------- localizar os campos dentro do formulário ---------- */
  const CAMPOS = {
    origem: { rotulo: /cep.*origem/, marcador: /sao paulo/ },
    destino: { rotulo: /cep.*destino/, marcador: /curitiba/ },
    peso: { rotulo: /peso/, marcador: /ex:\s*45/ },
    volumes: { rotulo: /volumes|caixas/, marcador: /ex:\s*4\b/ },
    tipo: { rotulo: /tipo.*mercadoria/ },
    nf: { rotulo: /valor.*nf|valor.*carga/, marcador: /15\.000/ },
  };
  const OBRIGATORIOS = ["origem", "destino", "peso", "volumes"];

  function controleDoRotulo(label) {
    if (label.control) return label.control;
    const dentro = label.querySelector("input, select, textarea");
    if (dentro) return dentro;
    let el = label.nextElementSibling;
    while (el) {
      if (el.matches("input, select, textarea")) return el;
      const f = el.querySelector && el.querySelector("input, select, textarea");
      if (f) return f;
      el = el.nextElementSibling;
    }
    const pai = label.parentElement;
    return pai ? pai.querySelector("input, select, textarea") : null;
  }

  function achar(chave, escopo) {
    const { rotulo, marcador } = CAMPOS[chave];
    for (const l of escopo.querySelectorAll("label")) {
      if (rotulo.test(norm(l.textContent))) {
        const c = controleDoRotulo(l);
        if (c) return c;
      }
    }
    if (marcador) {
      for (const i of escopo.querySelectorAll("input")) {
        if (marcador.test(norm(i.placeholder))) return i;
      }
    }
    return null;
  }

  function camposDe(escopo) {
    const c = {};
    for (const k of Object.keys(CAMPOS)) c[k] = achar(k, escopo);
    return c;
  }

  /* ---------- tipo de mercadoria → valor usado na página de cotação ---------- */
  function tipoDoTexto(texto) {
    const t = norm(texto);
    if (/eletr/.test(t)) return "eletronicos";
    if (/aliment|perecivel/.test(t)) return "alimentos";
    if (/medic|saude|farmac/.test(t)) return "medicamentos";
    if (/vest|text|roupa|calcad/.test(t)) return "vestuario";
    if (/autopec|veicul|automot/.test(t)) return "autopecas";
    return "manufaturados";
  }

  /* ---------- máscaras ---------- */
  function mascarar(escopo) {
    const c = camposDe(escopo);
    const cep = (e) => {
      const d = soDigitos(e.target.value).slice(0, 8);
      e.target.value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    };
    [c.origem, c.destino].forEach((campo) => {
      if (!campo || campo.dataset.mascaraVl) return;
      campo.dataset.mascaraVl = "1";
      campo.setAttribute("inputmode", "numeric");
      campo.setAttribute("maxlength", "9");
      campo.addEventListener("input", cep);
    });
    if (c.nf && !c.nf.dataset.mascaraVl) {
      c.nf.dataset.mascaraVl = "1";
      c.nf.setAttribute("inputmode", "numeric");
      c.nf.addEventListener("input", (e) => {
        const d = soDigitos(e.target.value).slice(0, 12);
        e.target.value = d
          ? (parseInt(d, 10) / 100).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "";
      });
    }
    if (c.volumes && !c.volumes.dataset.mascaraVl) {
      c.volumes.dataset.mascaraVl = "1";
      c.volumes.addEventListener("input", (e) => {
        const d = soDigitos(e.target.value).slice(0, 5);
        if (e.target.value !== d) e.target.value = d;
      });
    }
  }

  /* ---------- erro no campo ---------- */
  function marcar(campo, mensagem) {
    if (!campo) return;
    campo.style.outline = "2px solid #dc2626";
    campo.style.outlineOffset = "1px";
    campo.setAttribute("aria-invalid", "true");
    campo.title = mensagem;
    const limpar = () => {
      campo.style.outline = "";
      campo.style.outlineOffset = "";
      campo.removeAttribute("aria-invalid");
      campo.removeAttribute("title");
      campo.removeEventListener("input", limpar);
      campo.removeEventListener("change", limpar);
    };
    campo.addEventListener("input", limpar);
    campo.addEventListener("change", limpar);
  }

  /* ---------- enviar ---------- */
  function calcular(escopo) {
    const c = camposDe(escopo);
    const faltando = OBRIGATORIOS.filter((k) => !c[k]);
    if (faltando.length)
      console.warn(
        "[VelozLog] Campos do formulário não encontrados:",
        faltando,
      );

    const cepO = soDigitos(c.origem && c.origem.value);
    const cepD = soDigitos(c.destino && c.destino.value);
    const peso = lerNumero(c.peso && c.peso.value);
    const volumes = parseInt(soDigitos(c.volumes && c.volumes.value), 10);
    const nf = c.nf ? lerNumero(c.nf.value) : null;

    let primeiro = null;
    const exigir = (ok, campo, msg) => {
      if (!ok) {
        marcar(campo, msg);
        if (!primeiro && campo) primeiro = campo;
      }
    };
    exigir(cepO.length === 8, c.origem, "Informe um CEP com 8 dígitos");
    exigir(cepD.length === 8, c.destino, "Informe um CEP com 8 dígitos");
    exigir(peso > 0, c.peso, "Informe o peso em kg");
    exigir(volumes >= 1, c.volumes, "Informe ao menos 1 volume");
    if (c.nf) exigir(nf > 0, c.nf, "Informe o valor da NF");
    if (primeiro) {
      primeiro.focus();
      return;
    }

    const q = new URLSearchParams({
      o: cepO,
      d: cepD,
      p: String(peso),
      v: String(volumes),
    });
    if (c.nf) q.set("nf", String(nf));
    if (c.tipo) {
      const op = c.tipo.options ? c.tipo.options[c.tipo.selectedIndex] : null;
      q.set("t", tipoDoTexto(op ? op.textContent : c.tipo.value));
    }
    location.href = "/frete.html?" + q.toString();
  }

  // captura o clique no botão e o envio do formulário (funciona mesmo com outros scripts na página)
  document.addEventListener(
    "click",
    (e) => {
      if (!ehBotao(e.target)) return;
      const botao = e.target.closest("button, a, input[type='submit']");
      e.preventDefault();
      e.stopImmediatePropagation();
      calcular(escopoDe(botao));
    },
    true,
  );
  document.addEventListener(
    "submit",
    (e) => {
      const botao = [
        ...e.target.querySelectorAll("button, input[type='submit']"),
      ].find((b) => TEXTO_BOTAO.test(norm(b.textContent || b.value)));
      if (!botao) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      calcular(escopoDe(botao));
    },
    true,
  );

  function iniciar() {
    const lista = botoes();
    lista.forEach((b) => mascarar(escopoDe(b)));
    console.info(
      "[VelozLog] cotacao-form.js ativo | formulários de cotação encontrados: " +
        lista.length,
    );
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
