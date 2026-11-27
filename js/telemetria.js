/* VelozLog — Telemetria de Rota (portal-telemetria.html) — dados de DEMONSTRAÇÃO
   • abas de região: trocam os veículos do mapa, a tabela e o corredor
   • clique no veículo (mapa ou "Ver Telemetria") abre o painel dele à direita
   • velocidade / RPM "ao vivo" (variação simulada) e atualização da tabela a cada 10 s
   • mapa: Leaflet + OpenStreetMap (o mesmo da cotação e da gestão, ver /js/leaflet.js)
   Quando houver API, troque FROTA pela resposta do servidor. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) =>
    String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const avisar = (t, m) => window.VelozPortal && window.VelozPortal.avisar(t, m);
  const milhar = (n) => Math.round(n).toLocaleString("pt-BR");

  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const INTERVALO_TABELA = 10; // s entre as atualizações automáticas da tabela
  const INTERVALO_AO_VIVO = 2000; // ms entre as leituras simuladas do veículo aberto

  /* ---------------- dados ---------------- */
  // situacao: rota (verde) · alerta (laranja) · hub (azul) — bolinha da tabela e do mapa
  const SENSORES_PADRAO = [
    { nome: "5ª Roda (Desengate)", valor: "Trancado / Seguro", ok: true, icone: "cadeado" },
    { nome: "Trava Eletromecânica Baú", valor: "Inviolada & Ativa", ok: true, icone: "escudo" },
    { nome: "Abertura de Cabine", valor: "Normal", icone: "porta" },
    { nome: "Botão de Pânico", valor: "Não Acionado", icone: "mao" },
  ];

  const FROTA = [
    // ---------- Sul & Sudeste ----------
    {
      regiao: "sul", placa: "GHR-9102", modelo: "Scania R450 6x2", ano: 2023, situacao: "alerta",
      motorista: "Marcos Vinicius", cat: "E", cte: "894012", serie: 1, carga: "Bobinas de Aço & Inox",
      de: "São Paulo (SP)", para: "Curitiba (PR)", via: "Rodovia Régis Bittencourt BR-116",
      vel: 78, limite: 80, rpm: 1250, freio: 8.4, odometro: 142810,
      proximo: "Posto Graal Petropen", previsao: "1h 45m",
      jornada: "2h 15m", parada: "1h 45m", posto: "Posto Rede Graal Petropen", fadiga: 56,
      pos: [-24.78, -48.33],
      passagens: [
        { nome: "Posto Fiscal Registro (SP)", status: "Liberado em 12 min" },
        { nome: "Abastecimento Posto Graal SP-116", status: "Liberado sem anomalia" },
      ],
      perfil: {
        trecho: "Registro (SP) até Curitiba (PR)",
        marcos: ["Km 440 (Registro)", "Km 490 (Cajati)", "Km 530 (Serra do Cafezal)"],
        atual: "Km 560",
        vel: [71, 74, 77, 76, 72, 74, 78, 79, 77, 75, 77, 79, 78],
        rpm: [11.8, 12.4, 13.1, 12.6, 11.2, 11.9, 12.8, 13.4, 12.9, 12.1, 12.6, 13.0, 12.5],
      },
    },
    {
      regiao: "sul", placa: "BRA-4E29", modelo: "Volvo FH 540 Globetrotter", ano: 2022, situacao: "rota",
      motorista: "Carlos Eduardo S.", cat: "E", cte: "894008", serie: 1, carga: "Chapas Laminadas a Frio",
      de: "Curitiba (PR)", para: "Porto Alegre (RS)", via: "BR-101 / BR-376",
      vel: 82, limite: 90, rpm: 1310, freio: 8.6, odometro: 98455,
      proximo: "CD Joinville SC", previsao: "45 min",
      jornada: "1h 05m", parada: "2h 55m", posto: "Posto Graal Garuva", fadiga: 27,
      pos: [-25.98, -48.86],
      passagens: [
        { nome: "Pedágio Garuva (SC)", status: "Sem Parar • 0 min" },
        { nome: "Posto Fiscal Garuva (SC)", status: "Liberado em 8 min" },
      ],
      perfil: {
        trecho: "Curitiba (PR) até Joinville (SC)",
        marcos: ["Km 0 (Curitiba)", "Km 40 (Tijucas do Sul)", "Km 80 (Guaratuba)"],
        atual: "Km 115",
        vel: [64, 70, 76, 80, 84, 83, 79, 81, 84, 85, 82, 80, 82],
        rpm: [12.2, 12.9, 13.5, 13.0, 13.6, 13.2, 12.4, 12.8, 13.5, 13.7, 13.1, 12.9, 13.1],
      },
    },
    {
      regiao: "sul", placa: "OLT-8812", modelo: "DAF XF 480 Super Space", ano: 2023, situacao: "rota",
      motorista: "Roberto Alcantara", cat: "E", cte: "893985", serie: 1, carga: "Perfis Estruturais",
      de: "Campinas (SP)", para: "Belo Horizonte (MG)", via: "Rodovia Fernão Dias BR-381",
      vel: 74, limite: 80, rpm: 1190, freio: 8.3, odometro: 76320,
      proximo: "Posto Fiscal Extrema MG", previsao: "32 min",
      jornada: "3h 10m", parada: "50m", posto: "Posto Fiscal Extrema", fadiga: 79,
      pos: [-23.08, -46.6],
      passagens: [
        { nome: "Pedágio Atibaia (SP)", status: "Sem Parar • 0 min" },
        { nome: "Balança Mairiporã (SP)", status: "Peso conforme" },
      ],
      perfil: {
        trecho: "Campinas (SP) até Extrema (MG)",
        marcos: ["Km 0 (Campinas)", "Km 40 (Jundiaí)", "Km 80 (Atibaia)"],
        atual: "Km 112",
        vel: [58, 66, 72, 75, 73, 70, 74, 76, 72, 71, 75, 76, 74],
        rpm: [11.0, 11.8, 12.4, 12.7, 12.2, 11.6, 12.1, 12.6, 11.9, 11.7, 12.3, 12.4, 11.9],
      },
    },
    {
      regiao: "sul", placa: "KLD-5530", modelo: "Mercedes Actros 2651", ano: 2021, situacao: "hub",
      motorista: "Fernando Dias Prado", cat: "E", cte: "893877", serie: 2, carga: "Contêiner 40' Reefer",
      de: "Santos (SP)", para: "Paulínia (SP)", via: "Sistema Anchieta-Imigrantes",
      vel: 68, limite: 80, rpm: 1420, freio: 8.9, odometro: 211604,
      proximo: "Hub Intermodal SP-01", previsao: "2h 10m",
      jornada: "40m", parada: "3h 20m", posto: "Hub Intermodal SP-01", fadiga: 17,
      pos: [-23.86, -46.47],
      passagens: [
        { nome: "Terminal Portuário Santos", status: "Contêiner liberado" },
        { nome: "Pedágio Riacho Grande (SP)", status: "Sem Parar • 0 min" },
      ],
      perfil: {
        trecho: "Santos (SP) até São Bernardo do Campo (SP)",
        marcos: ["Km 65 (Santos)", "Km 50 (Cubatão)", "Km 40 (Serra do Mar)"],
        atual: "Km 28",
        vel: [42, 50, 56, 61, 58, 54, 60, 64, 66, 63, 67, 69, 68],
        rpm: [15.2, 15.8, 16.4, 16.9, 16.2, 15.6, 16.1, 15.4, 14.8, 14.6, 14.5, 14.3, 14.2],
      },
    },
    // ---------- Centro-Oeste ----------
    {
      regiao: "centro", placa: "MTX-4417", modelo: "Scania R540 6x4", ano: 2024, situacao: "rota",
      motorista: "Juliano Ferraz", cat: "E", cte: "893842", serie: 1, carga: "Bobinas Galvanizadas",
      de: "Rondonópolis (MT)", para: "Uberlândia (MG)", via: "BR-364 / BR-365",
      vel: 79, limite: 80, rpm: 1280, freio: 8.5, odometro: 54210,
      proximo: "Posto Fiscal Jataí GO", previsao: "1h 20m",
      jornada: "1h 50m", parada: "2h 10m", posto: "Posto Jataí BR-364", fadiga: 46,
      pos: [-17.35, -52.4],
      passagens: [
        { nome: "Posto Fiscal Alto Araguaia (MT)", status: "Liberado em 15 min" },
        { nome: "Balança Mineiros (GO)", status: "Peso conforme" },
      ],
      perfil: {
        trecho: "Alto Araguaia (MT) até Jataí (GO)",
        marcos: ["Km 0 (Alto Araguaia)", "Km 45 (Mineiros)", "Km 90 (Serranópolis)"],
        atual: "Km 128",
        vel: [70, 74, 78, 80, 79, 77, 78, 80, 79, 78, 80, 79, 79],
        rpm: [12.1, 12.6, 13.0, 13.3, 13.1, 12.8, 12.9, 13.2, 13.0, 12.9, 13.2, 13.0, 12.8],
      },
    },
    {
      regiao: "centro", placa: "GOB-2290", modelo: "Volvo FH 460", ano: 2022, situacao: "rota",
      motorista: "Patrícia Moura", cat: "E", cte: "893831", serie: 1, carga: "Tubos de Aço Carbono",
      de: "Anápolis (GO)", para: "Brasília (DF)", via: "BR-060",
      vel: 76, limite: 80, rpm: 1220, freio: 8.2, odometro: 120774,
      proximo: "CD Brasília DF", previsao: "55 min",
      jornada: "1h 15m", parada: "2h 45m", posto: "CD Brasília", fadiga: 31,
      pos: [-16.12, -48.6],
      passagens: [
        { nome: "Pedágio Alexânia (GO)", status: "Sem Parar • 0 min" },
        { nome: "Posto Fiscal Anápolis (GO)", status: "Liberado em 6 min" },
      ],
      perfil: {
        trecho: "Anápolis (GO) até Brasília (DF)",
        marcos: ["Km 0 (Anápolis)", "Km 35 (Abadiânia)", "Km 70 (Alexânia)"],
        atual: "Km 96",
        vel: [55, 64, 72, 77, 78, 75, 76, 78, 77, 74, 76, 77, 76],
        rpm: [11.4, 12.0, 12.7, 12.9, 13.0, 12.5, 12.4, 12.8, 12.6, 12.1, 12.3, 12.4, 12.2],
      },
    },
    // ---------- Corredor Portos ----------
    {
      regiao: "portos", placa: "PRN-7730", modelo: "Scania R450 6x2", ano: 2023, situacao: "rota",
      motorista: "Diego Matsumoto", cat: "E", cte: "893861", serie: 1, carga: "Bobinas a Quente (Exportação)",
      de: "Curitiba (PR)", para: "Paranaguá (PR)", via: "BR-277",
      vel: 71, limite: 80, rpm: 1180, freio: 8.7, odometro: 88032,
      proximo: "Pátio de Triagem Paranaguá", previsao: "40 min",
      jornada: "1h 00m", parada: "3h 00m", posto: "Pátio de Triagem", fadiga: 25,
      pos: [-25.55, -48.82],
      passagens: [
        { nome: "Pedágio São José dos Pinhais (PR)", status: "Sem Parar • 0 min" },
        { nome: "Agendamento Porto Paranaguá", status: "Janela confirmada 16:00" },
      ],
      perfil: {
        trecho: "Curitiba (PR) até Paranaguá (PR)",
        marcos: ["Km 0 (Curitiba)", "Km 30 (Serra do Mar)", "Km 60 (Morretes)"],
        atual: "Km 84",
        vel: [62, 68, 60, 52, 48, 55, 63, 68, 72, 70, 73, 72, 71],
        rpm: [12.0, 12.6, 14.8, 15.6, 15.9, 14.2, 12.8, 12.2, 12.0, 11.8, 12.1, 12.0, 11.8],
      },
    },
    {
      regiao: "portos", placa: "SNT-1184", modelo: "Mercedes Actros 2548", ano: 2022, situacao: "hub",
      motorista: "Wagner Lopes", cat: "E", cte: "893825", serie: 2, carga: "Contêiner 20' Dry",
      de: "Paulínia (SP)", para: "Santos (SP)", via: "Rodovia dos Imigrantes",
      vel: 64, limite: 70, rpm: 1350, freio: 8.8, odometro: 176402,
      proximo: "Terminal Santos Brasil", previsao: "25 min",
      jornada: "2h 30m", parada: "1h 30m", posto: "Terminal Santos Brasil", fadiga: 63,
      pos: [-23.92, -46.38],
      passagens: [
        { nome: "Pedágio Piratininga (SP)", status: "Sem Parar • 0 min" },
        { nome: "Ecopátio Cubatão", status: "Triagem liberada" },
      ],
      perfil: {
        trecho: "São Bernardo do Campo (SP) até Santos (SP)",
        marcos: ["Km 20 (SBC)", "Km 40 (Serra do Mar)", "Km 55 (Cubatão)"],
        atual: "Km 63",
        vel: [72, 70, 62, 55, 52, 54, 58, 60, 62, 65, 63, 66, 64],
        rpm: [12.8, 12.6, 13.8, 14.6, 14.9, 14.4, 13.9, 13.5, 13.2, 13.0, 13.3, 13.6, 13.5],
      },
    },
    {
      regiao: "portos", placa: "ITJ-6602", modelo: "Volvo FH 540", ano: 2024, situacao: "rota",
      motorista: "Lucas Bernardi", cat: "E", cte: "893892", serie: 1, carga: "Laminados para Exportação",
      de: "Joinville (SC)", para: "Itajaí (SC)", via: "BR-101",
      vel: 80, limite: 90, rpm: 1260, freio: 8.5, odometro: 39518,
      proximo: "Porto de Itajaí", previsao: "35 min",
      jornada: "50m", parada: "3h 10m", posto: "Porto de Itajaí", fadiga: 21,
      pos: [-26.72, -48.68],
      passagens: [
        { nome: "Pedágio Araquari (SC)", status: "Sem Parar • 0 min" },
        { nome: "Posto Fiscal Itapema (SC)", status: "Liberado em 5 min" },
      ],
      perfil: {
        trecho: "Joinville (SC) até Itajaí (SC)",
        marcos: ["Km 0 (Joinville)", "Km 30 (Araquari)", "Km 60 (Barra Velha)"],
        atual: "Km 82",
        vel: [66, 73, 79, 82, 84, 81, 79, 82, 83, 80, 81, 82, 80],
        rpm: [12.3, 12.8, 13.2, 13.5, 13.7, 13.2, 12.9, 13.3, 13.4, 13.0, 13.1, 13.2, 12.9],
      },
    },
  ];

  const REGIOES = {
    sul: {
      titulo: "Corredor Sudeste-Sul (SP / PR / SC)",
      texto: "Posto Fiscal Registro SP com fluxo contínuo • Tempo médio de liberação: 14 min",
      pedagios: 9,
      nome: "Sul & Sudeste",
    },
    centro: {
      titulo: "Corredor Centro-Oeste (MT / GO / DF)",
      texto: "Balança de Mineiros GO operando normalmente • Tempo médio de liberação: 11 min",
      pedagios: 6,
      nome: "Centro-Oeste",
    },
    portos: {
      titulo: "Corredor Portos (Santos / Paranaguá / Itajaí)",
      texto: "Janelas de agendamento portuário confirmadas • Tempo médio de triagem: 18 min",
      pedagios: 7,
      nome: "Corredor Portos",
    },
  };

  const ICONES = {
    cadeado: '<rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />',
    escudo: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4.5" />',
    porta: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18" /><path d="M15 12h.01" />',
    mao: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10M12 10V4.5a1.5 1.5 0 0 1 3 0V10M15 10V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L3 15.5a1.5 1.5 0 0 1 2.3-2L9 16V11z" />',
    caminhao: '<path d="M2 6h12v10H2zM14 9h4l3 3.5V16h-7" /><circle cx="6" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" />',
    fone: '<path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" />',
    cadeadoP: '<rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />',
  };
  const svg = (nome) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;

  // código de rastreio do manifesto (VLZ-{CT-e}-{UF}) — liga o veículo à tela de rastreio
  function linkRastreio(v) {
    const dados = window.VelozManifestos;
    const m = dados && dados.buscar(v.cte);
    return m ? `/rastreio.html?codigo=${encodeURIComponent(dados.codigo(m))}&de=telemetria` : null;
  }

  /* ---------------- estado ---------------- */
  let regiao = "sul";
  let atual = FROTA[0];
  let leitura = { vel: atual.vel, rpm: atual.rpm }; // valores "ao vivo" do veículo aberto
  const veiculosDaRegiao = () => FROTA.filter((v) => v.regiao === regiao);

  /* ---------------- painel do veículo ---------------- */
  const campo = (nome) => $$(`[data-tl="${nome}"]`);
  const escrever = (nome, texto) => campo(nome).forEach((el) => (el.textContent = texto));

  function mostrarLeitura() {
    const v = atual;
    escrever("vel", leitura.vel);
    escrever("rpm", milhar(leitura.rpm));
    campo("vel-barra").forEach((el) => {
      el.style.width = `${Math.min(100, (leitura.vel / v.limite) * 100)}%`;
      el.classList.toggle("tl-acima", leitura.vel > v.limite);
    });
    // 2.400 RPM = barra cheia; até 1.500 é a faixa verde (econômica)
    campo("rpm-barra").forEach((el) => (el.style.width = `${Math.min(100, (leitura.rpm / 2400) * 100)}%`));
    escrever("faixa", leitura.rpm <= 1500 ? "Faixa Verde Econômica" : "Acima da Faixa Verde");
  }

  function preencherVeiculo(v) {
    escrever("placa", v.placa);
    escrever("modelo", `${v.modelo} • Ano ${v.ano}`);
    escrever("condutor", `${v.motorista} (Cat. ${v.cat})`);
    escrever("carga", v.carga);
    escrever("limite", v.limite);
    escrever("freio", v.freio.toFixed(1));
    escrever("odometro", milhar(v.odometro));

    const cte = $('[data-tl="cte"]');
    cte.textContent = `${v.cte.padStart(8, "0")} - Série ${v.serie}`;
    const link = linkRastreio(v);
    cte.href = link || "#";
    cte.title = link ? "Abrir o rastreio desta carga" : "";

    $('[data-tl="fadiga-texto"]').innerHTML =
      `Tempo ininterrupto ao volante: <b>${esc(v.jornada)}</b>. Parada técnica mandatória programada em <b class="tl-laranja">${esc(v.parada)}</b> no ${esc(v.posto)}.`;
    campo("fadiga-barra").forEach((el) => (el.style.width = `${v.fadiga}%`));
    campo("fadiga-barra").forEach((el) => el.classList.toggle("tl-atencao", v.fadiga >= 75));
    escrever("fadiga-selo", v.fadiga >= 75 ? "Atenção" : "Conforme");
    campo("fadiga-selo").forEach((el) => el.classList.toggle("tl-selo-laranja", v.fadiga >= 75));

    $("#tl-sensores").innerHTML = SENSORES_PADRAO.map(
      (s) => `<li>
        ${svg(s.icone)}
        <span>${esc(s.nome)}</span>
        <b class="${s.ok ? "tl-selo-verde" : ""}">${esc(s.valor)}</b>
      </li>`,
    ).join("");

    $("#tl-passagens").innerHTML = v.passagens
      .map((p) => `<li><span>${esc(p.nome)}</span><small>${esc(p.status)}</small></li>`)
      .join("");

    leitura = { vel: v.vel, rpm: v.rpm };
    mostrarLeitura();
    desenharGrafico(v);
    fecharConfirmacao();
  }

  /* ---------------- gráfico do perfil de velocidade ---------------- */
  const LARGURA = 600;
  const ALTURA = 150;
  const VEL_MAX = 100; // km/h no topo do gráfico
  const RPM_MAX = 26; // RPM x100 no topo (a curva de RPM fica na metade de baixo)

  // curva suave passando pelos pontos (Catmull-Rom → Bézier)
  function curva(pontos) {
    let d = `M${pontos[0][0]},${pontos[0][1]}`;
    for (let i = 0; i < pontos.length - 1; i++) {
      const p0 = pontos[i - 1] || pontos[i];
      const p1 = pontos[i];
      const p2 = pontos[i + 1];
      const p3 = pontos[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function pontosDe(valores, maximo) {
    const passo = LARGURA / (valores.length - 1);
    return valores.map((val, i) => [i * passo, ALTURA - (val / maximo) * ALTURA]);
  }

  function desenharGrafico(v) {
    const p = v.perfil;
    const vel = pontosDe(p.vel, VEL_MAX);
    const rpm = pontosDe(p.rpm, RPM_MAX);
    const linhaVel = curva(vel);
    const yLimite = ALTURA - (v.limite / VEL_MAX) * ALTURA;
    const ultimo = vel[vel.length - 1];

    $("#tl-perfil-trecho").textContent = `Trecho: ${p.trecho} • Limite da via: ${v.limite} km/h`;
    $("#tl-grafico").setAttribute(
      "aria-label",
      `Perfil de velocidade de ${v.placa}: entre ${Math.min(...p.vel)} e ${Math.max(...p.vel)} km/h, limite ${v.limite} km/h`,
    );
    $("#tl-grafico").innerHTML = `
      <svg viewBox="0 0 ${LARGURA} ${ALTURA}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="tl-degrade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f26a1b" stop-opacity="0.32" />
            <stop offset="100%" stop-color="#f26a1b" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <line class="tl-linha-limite" x1="0" x2="${LARGURA}" y1="${yLimite}" y2="${yLimite}" />
        <path class="tl-area" d="${linhaVel} L${LARGURA},${ALTURA} L0,${ALTURA} Z" />
        <path class="tl-curva-rpm" d="${curva(rpm)}" />
        <path class="tl-curva-vel" d="${linhaVel}" />
      </svg>
      <span class="tl-limite-rotulo" style="top: ${(yLimite / ALTURA) * 100}%">Limite ${v.limite} km/h</span>
      <span class="tl-posicao" style="left: ${(ultimo[0] / LARGURA) * 100}%; top: ${(ultimo[1] / ALTURA) * 100}%"></span>`;

    $("#tl-marcos").innerHTML =
      p.marcos.map((m) => `<li>${esc(m)}</li>`).join("") +
      `<li class="tl-marco-atual">${esc(p.atual)} (Posição Atual: <span data-tl="vel">${leitura.vel}</span> km/h)</li>`;
  }

  /* ---------------- tabela da frota ---------------- */
  const linhas = $("#tl-linhas");

  function montarTabela() {
    const lista = veiculosDaRegiao();
    linhas.innerHTML = lista
      .map((v) => {
        const sel = v === atual;
        return `<tr class="${sel ? "tl-selecionada" : ""}" data-placa="${esc(v.placa)}">
          <td>
            <div class="tl-placa">
              <i class="tl-bola tl-bola-${v.situacao}" aria-hidden="true"></i>
              <div><strong class="tl-mono">${esc(v.placa)}</strong><small>${esc(v.modelo)}</small></div>
            </div>
          </td>
          <td class="tl-rota"><strong>${esc(v.de)} → ${esc(v.para)}</strong><small>${esc(v.via)}</small></td>
          <td class="tl-motorista">${esc(v.motorista)}</td>
          <td><span class="tl-vel-media tl-mono" data-vel-media>${v.vel}<br>km/h</span></td>
          <td><span class="tl-travada">${svg("cadeadoP")} Travada</span></td>
          <td class="tl-proximo"><strong>${esc(v.proximo)}</strong><small>Previsão: ${esc(v.previsao)}</small></td>
          <td class="tl-acoes">
            <button type="button" class="tl-ver" data-ver="${esc(v.placa)}" aria-pressed="${sel}">Ver Telemetria</button>
            <button type="button" class="tl-fone" data-fone="${esc(v.placa)}" aria-label="Falar com o motorista de ${esc(v.placa)}">${svg("fone")}</button>
          </td>
        </tr>`;
      })
      .join("");

    $("#tl-exibindo").textContent =
      `Exibindo ${lista.length} carretas de alta prioridade corporativa com CTe ativo vinculado à Indústrias Metalúrgicas ABC`;
  }

  linhas.addEventListener("click", (e) => {
    const ver = e.target.closest("[data-ver]");
    if (ver) {
      selecionar(ver.dataset.ver, true);
      return;
    }
    const fone = e.target.closest("[data-fone]");
    if (fone) {
      const v = FROTA.find((x) => x.placa === fone.dataset.fone);
      avisar("Chamada para a cabine", `Conectando com ${v.motorista} (${v.placa}) pela Torre de Controle…`);
    }
  });

  /* ---------------- seleção ---------------- */
  function selecionar(placa, rolar = false) {
    const v = FROTA.find((x) => x.placa === placa);
    if (!v) return;
    atual = v;
    preencherVeiculo(v);
    $$("tr[data-placa]", linhas).forEach((tr) => {
      const sel = tr.dataset.placa === placa;
      tr.classList.toggle("tl-selecionada", sel);
      $(".tl-ver", tr).setAttribute("aria-pressed", sel);
    });
    atualizarMarcadores();
    if (mapa) mapa.panTo(v.pos, { animate: !reduzMovimento });

    if (rolar) {
      const painel = $("#tl-veiculo");
      // o painel some da tela quando a tabela está lá embaixo: leva o usuário até ele
      const topo = painel.getBoundingClientRect().top;
      if (topo < 0 || topo > window.innerHeight * 0.6) {
        const destino = window.scrollY + $("#tl-mapa-cartao").getBoundingClientRect().top - 90;
        window.scrollTo({ top: destino, behavior: reduzMovimento ? "auto" : "smooth" });
      }
      painel.classList.remove("tl-destaque");
      void painel.offsetWidth;
      painel.classList.add("tl-destaque");
    }
  }

  /* ---------------- mapa ---------------- */
  let mapa = null;
  let L = null;
  let marcadores = [];
  let mostrarCan = true; // "Camada CAN": velocidade ao lado da placa

  function iconeVeiculo(v) {
    const sel = v === atual;
    const vel = v === atual ? leitura.vel : v.vel;
    return L.divIcon({
      className: "",
      iconSize: [0, 0],
      html: `<div class="tl-marcador ${sel ? "tl-marcador-ativo" : ""}">
        <span class="tl-marcador-rotulo">
          ${sel ? '<i class="tl-bola tl-bola-rota"></i>' : ""}
          <b>${esc(v.placa)}</b>${mostrarCan ? `<em>${vel} km/h</em>` : ""}
        </span>
        <span class="tl-marcador-pino">${svg("caminhao")}</span>
      </div>`,
    });
  }

  function atualizarMarcadores() {
    if (!mapa) return;
    marcadores.forEach(({ v, marcador }) => {
      marcador.setIcon(iconeVeiculo(v));
      marcador.setZIndexOffset(v === atual ? 1000 : 0);
    });
  }

  function enquadrar(animar = true) {
    if (!mapa) return;
    const lista = veiculosDaRegiao();
    const limites = L.latLngBounds(lista.map((v) => v.pos));
    // espaço para os controles por cima do mapa (abas em cima, corredor embaixo)
    mapa.fitBounds(limites, {
      paddingTopLeft: [60, 150],
      paddingBottomRight: [60, 140],
      maxZoom: 9,
      animate: animar && !reduzMovimento,
    });
  }

  function montarMarcadores() {
    if (!mapa) return;
    marcadores.forEach(({ marcador }) => marcador.remove());
    marcadores = veiculosDaRegiao().map((v) => {
      const marcador = L.marker(v.pos, {
        icon: iconeVeiculo(v),
        title: `${v.placa} — ver telemetria`,
        alt: v.placa,
        riseOnHover: true,
      }).addTo(mapa);
      marcador.on("click", () => selecionar(v.placa));
      return { v, marcador };
    });
    atualizarMarcadores();
  }

  async function iniciarMapa() {
    try {
      L = await window.VelozLeaflet.carregar();
      mapa = L.map("tl-mapa", {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false, // a roda do mouse continua rolando a página
      });
      L.control.zoom({ position: "topright" }).addTo(mapa);
      L.control.attribution({ prefix: false, position: "bottomright" }).addTo(mapa);
      L.tileLayer(window.VelozLeaflet.TILES, {
        maxZoom: 18,
        attribution: window.VelozLeaflet.CREDITO,
      }).addTo(mapa);
      // roda do mouse só dá zoom depois de clicar no mapa
      mapa.on("click", () => mapa.scrollWheelZoom.enable());
      mapa.on("mouseout", () => mapa.scrollWheelZoom.disable());
      montarMarcadores();
      enquadrar(false);
    } catch (erro) {
      console.warn("[VelozLog] Mapa da telemetria indisponível.", erro);
      $("#tl-mapa-aviso").hidden = false;
    }
  }

  /* ---------------- abas de região ---------------- */
  const abas = $$("#tl-regioes [role=tab]");

  function trocarRegiao(nova) {
    if (nova === regiao) return;
    regiao = nova;
    abas.forEach((b) => {
      const ativa = b.dataset.regiao === nova;
      b.setAttribute("aria-selected", ativa);
      b.tabIndex = ativa ? 0 : -1;
    });
    const r = REGIOES[nova];
    $("#tl-corredor-titulo").textContent = r.titulo;
    $("#tl-corredor-texto").textContent = r.texto;
    $("#tl-pedagios").textContent = r.pedagios;

    atual = veiculosDaRegiao()[0];
    montarTabela();
    preencherVeiculo(atual);
    montarMarcadores();
    enquadrar();
  }

  abas.forEach((b) => b.addEventListener("click", () => trocarRegiao(b.dataset.regiao)));
  $("#tl-regioes").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = abas.findIndex((b) => b.getAttribute("aria-selected") === "true");
    const prox = abas[(i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length];
    trocarRegiao(prox.dataset.regiao);
    prox.focus();
  });

  /* ---------------- controles do mapa ---------------- */
  $("#tl-camada").addEventListener("click", (e) => {
    mostrarCan = !mostrarCan;
    e.currentTarget.setAttribute("aria-pressed", mostrarCan);
    atualizarMarcadores();
  });

  $("#tl-expandir").addEventListener("click", (e) => {
    const cartao = $("#tl-mapa-cartao");
    const expandido = cartao.classList.toggle("tl-expandido");
    e.currentTarget.setAttribute("aria-pressed", expandido);
    e.currentTarget.textContent = expandido ? "Recolher Radar" : "Expandir Radar";
    // o Leaflet precisa saber o tamanho novo quando a transição de altura termina
    setTimeout(() => {
      if (!mapa) return;
      mapa.invalidateSize();
      enquadrar();
    }, reduzMovimento ? 0 : 420);
  });

  /* ---------------- botões ---------------- */
  $("#tl-intervencao").addEventListener("click", () =>
    avisar(
      "Intervenção da Torre solicitada",
      `Um operador da Torre de Controle assumiu o acompanhamento de ${atual.placa} e entrará em contato com a cabine.`,
    ),
  );

  $("#tl-mais").addEventListener("click", () =>
    avisar(atual.placa, "Histórico completo do veículo e manutenção preventiva estarão disponíveis em breve."),
  );

  $("#tl-ligar").addEventListener("click", () =>
    avisar("Chamada para a cabine", `Conectando com ${atual.motorista} (${atual.placa}) pela Torre de Controle…`),
  );

  $('[data-tl="cte"]').addEventListener("click", (e) => {
    if (e.currentTarget.getAttribute("href") === "#") {
      e.preventDefault();
      avisar("CT-e sem rastreio", "Este CT-e ainda não está disponível no rastreio.");
    }
  });

  // comando remoto de trava: confirma dentro do próprio painel
  const confirmar = $("#tl-confirmar");
  function fecharConfirmacao() {
    confirmar.hidden = true;
  }
  $("#tl-trava").addEventListener("click", () => {
    confirmar.hidden = !confirmar.hidden;
    if (!confirmar.hidden) $("#tl-trava-enviar").focus();
  });
  $("#tl-trava-cancelar").addEventListener("click", fecharConfirmacao);
  $("#tl-trava-enviar").addEventListener("click", () => {
    fecharConfirmacao();
    avisar("Comando enviado", `Travamento remoto confirmado pelo módulo do baú de ${atual.placa}.`);
  });

  // relatório: planilha (CSV) da frota da região — abre no Excel com acentos
  $("#tl-relatorio").addEventListener("click", () => {
    const cab = ["Placa", "Veículo", "Motorista", "Origem", "Destino", "Via", "Velocidade (km/h)", "Limite (km/h)", "RPM", "Trava de Baú", "Próximo Ponto", "Previsão", "CT-e", "Código de rastreio"];
    const dados = window.VelozManifestos;
    const linhasCsv = veiculosDaRegiao().map((v) => {
      const m = dados && dados.buscar(v.cte);
      return [v.placa, `${v.modelo} ${v.ano}`, v.motorista, v.de, v.para, v.via, v === atual ? leitura.vel : v.vel, v.limite, v === atual ? leitura.rpm : v.rpm, "Travada", v.proximo, v.previsao, v.cte.padStart(8, "0"), m ? dados.codigo(m) : ""];
    });
    const csv = [cab, ...linhasCsv]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `telemetria-${regiao}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    avisar("Relatório gerado", `Telemetria de ${REGIOES[regiao].nome} exportada em planilha (CSV).`);
  });

  /* ---------------- "ao vivo" ---------------- */
  const entre = (n, min, max) => Math.max(min, Math.min(max, n));

  // leitura simulada do veículo aberto: varia pouco em torno da média dele
  setInterval(() => {
    if (document.hidden) return;
    const v = atual;
    const vel = entre(leitura.vel + Math.round(Math.random() * 4 - 2), v.vel - 4, Math.min(v.vel + 3, v.limite + 2));
    const rpm = entre(leitura.rpm + Math.round((Math.random() * 60 - 30) / 10) * 10, v.rpm - 90, v.rpm + 90);
    leitura = { vel, rpm };
    mostrarLeitura();
    atualizarMarcadores();
  }, INTERVALO_AO_VIVO);

  // contagem da tabela: a cada 10 s as velocidades médias são "recebidas" de novo
  let restante = INTERVALO_TABELA;
  const contagem = $("#tl-contagem");
  setInterval(() => {
    if (document.hidden) return;
    restante -= 1;
    if (restante <= 0) {
      restante = INTERVALO_TABELA;
      $$("tr[data-placa]", linhas).forEach((tr) => {
        const v = FROTA.find((x) => x.placa === tr.dataset.placa);
        const media = v === atual ? leitura.vel : entre(v.vel + Math.round(Math.random() * 4 - 2), v.vel - 3, v.vel + 3);
        const cel = $("[data-vel-media]", tr);
        cel.innerHTML = `${media}<br>km/h`;
        cel.classList.remove("tl-piscar");
        void cel.offsetWidth;
        cel.classList.add("tl-piscar");
      });
      $("#tl-latencia").textContent = `${220 + Math.round(Math.random() * 40)}ms`;
    }
    contagem.textContent = `${String(restante).padStart(2, "0")}s`;
  }, 1000);

  /* ---------------- início ---------------- */
  montarTabela();
  preencherVeiculo(atual);
  iniciarMapa();
})();
