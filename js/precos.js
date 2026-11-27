/* VelozLog — tabela de preços e prazos (fonte única)
   Usada pela cotação (frete.js) e pela Tabela de Preços Referencial (tabela-precos.js).
   Mudou um número aqui → muda na cotação e no PDF da tabela ao mesmo tempo. */
(() => {
  "use strict";

  /* ----- TAXAS E DESCONTOS ----- */
  const FATOR_CUBAGEM = 300; // kg por m³ (padrão rodoviário)
  const GRIS_POR_MIL = 1; // 0,1% do valor da NF
  const SEGURO_POR_MIL = 3; // 0,3% do valor da NF
  const DESCONTO_PERCENTUAL = 5; // desconto corporativo
  const DESCONTO_PIX_PERCENTUAL = 1.5; // extra para pagamento via PIX (sobre o valor já com desconto corporativo)
  // true: cada volume paga pelo maior entre o SEU peso real e o SEU peso cubado (padrão de courier/expresso)
  // false: compara só os totais da carga (peso total x cubagem total)
  const CUBAGEM_POR_VOLUME = true;

  /* ----- TABELA DE PREÇOS (referência de mercado) -----
     Fracionada: faixas de peso de uma tabela real de transportadora para ~700 km
     (até 30 kg ≈ R$ 60 · 50 kg ≈ R$ 72 · 70 kg ≈ R$ 88 · 100 kg ≈ R$ 102 · excedente ≈ R$ 1,02/kg),
     corrigidas pela distância. Express = fracionada x 2,1 (mesma proporção SEDEX x PAC).
     Dedicado: preço por km do veículo que comporta a carga (referência: média nacional
     de R$ 8,72/km para caminhão pesado, Edenred/IFR ago/2026; veículos leves custam menos).
     Quando a VelozLog tiver a tabela própria, é só trocar os números aqui. */
  const KM_REFERENCIA = 700; // distância em que as faixas abaixo valem 1,0
  const KM_PADRAO = 400; // usado até o mapa calcular a distância real
  const FAIXAS_FRACIONADO = [
    { ate: 30, valor: 60 },
    { ate: 50, valor: 72 },
    { ate: 70, valor: 88 },
    { ate: 100, valor: 102 },
  ];
  const EXCEDENTE_POR_KG = 1.02; // acima de 100 kg
  const PEDAGIO_FRACAO = 1.2; // R$ por fração de 100 kg a cada 100 km
  const DESPACHO = 12; // taxa de despacho por conhecimento (CT-e)
  const VEICULOS = [
    // kg e m³ máximos; R$/km; mínimo da viagem; pedágio por km (eixos)
    {
      nome: "Utilitário Fiorino",
      kg: 600,
      m3: 3,
      porKm: 2.6,
      minimo: 280,
      pedagioKm: 0.12,
    },
    { nome: "VUC", kg: 3000, m3: 20, porKm: 4.2, minimo: 450, pedagioKm: 0.18 },
    {
      nome: "Caminhão Toco",
      kg: 6000,
      m3: 40,
      porKm: 5.8,
      minimo: 700,
      pedagioKm: 0.3,
    },
    {
      nome: "Caminhão Truck",
      kg: 12000,
      m3: 55,
      porKm: 7.2,
      minimo: 900,
      pedagioKm: 0.45,
    },
    {
      nome: "Carreta",
      kg: 30000,
      m3: 90,
      porKm: 8.72,
      minimo: 1400,
      pedagioKm: 0.75,
    },
  ];
  const MODALIDADES = {
    express: {
      nome: "Express",
      tipo: "fracionado",
      multiplicador: 2.1,
      minimo: 85,
    },
    fracionada: {
      nome: "Fracionada",
      tipo: "fracionado",
      multiplicador: 1,
      minimo: 45,
    },
    dedicado: { nome: "Dedicado", tipo: "veiculo" },
  };

  /* ----- PRAZOS (dias úteis, sem feriados) -----
     Fracionada: 1 dia de coleta/consolidação + 1 dia a cada 500 km (faixa "X a X+1").
     Express: linha direta, 1 dia útil a cada 700 km.
     Dedicado: veículo sem paradas; até 350 km entrega no mesmo dia,
     depois 1 dia corrido a cada 650 km (jornada do motorista, Lei 13.103). */
  const PRAZO = {
    corteColeta: { hora: 14, min: 30 }, // depois disso a coleta vai para o próximo dia útil
    fracionadaKmDia: 500,
    expressKmDia: 700,
    dedicadoMesmoDiaKm: 350,
    dedicadoKmDia: 650,
  };

  /* ----- CÁLCULOS BÁSICOS ----- */
  // faixas mais baratas perto, mais caras longe (nunca abaixo de 60% da tabela)
  const fatorDistancia = (km) =>
    Math.max(0.6, 0.55 + 0.45 * (km / KM_REFERENCIA));

  function fretePesoBase(peso) {
    const faixa = FAIXAS_FRACIONADO.find((f) => peso <= f.ate);
    if (faixa) return faixa.valor;
    const ultima = FAIXAS_FRACIONADO[FAIXAS_FRACIONADO.length - 1];
    return ultima.valor + (peso - ultima.ate) * EXCEDENTE_POR_KG;
  }

  // menor veículo que comporta o peso tributável e o volume da carga
  function veiculoPara(peso, m3) {
    return (
      VEICULOS.find((v) => peso <= v.kg && m3 <= v.m3) ||
      VEICULOS[VEICULOS.length - 1]
    );
  }

  // dias de viagem por modalidade (sem datas de calendário)
  const diasExpress = (km) => Math.max(1, Math.ceil(km / PRAZO.expressKmDia));
  const diasFracionada = (km) => 1 + Math.ceil(km / PRAZO.fracionadaKmDia);
  const diasDedicado = (km) =>
    km <= PRAZO.dedicadoMesmoDiaKm ? 0 : Math.ceil(km / PRAZO.dedicadoKmDia);

  window.VelozPrecos = Object.freeze({
    FATOR_CUBAGEM,
    GRIS_POR_MIL,
    SEGURO_POR_MIL,
    DESCONTO_PERCENTUAL,
    DESCONTO_PIX_PERCENTUAL,
    CUBAGEM_POR_VOLUME,
    KM_REFERENCIA,
    KM_PADRAO,
    FAIXAS_FRACIONADO,
    EXCEDENTE_POR_KG,
    PEDAGIO_FRACAO,
    DESPACHO,
    VEICULOS,
    MODALIDADES,
    PRAZO,
    fatorDistancia,
    fretePesoBase,
    veiculoPara,
    diasExpress,
    diasFracionada,
    diasDedicado,
  });
})();
