/* VelozLog — manifestos do Portal B2B (dados de DEMONSTRAÇÃO, FONTE ÚNICA)
   Usado pela home (card de rastreio), pelo rastreio (rastreio.js), e por todas as telas
   do portal: Visão Geral (portal.js), Manifestos (gestao.js), Telemetria e Faturas.
   Todos os números do portal (em trânsito, entregas, ocorrências, canhotos…) são
   CONTADOS a partir desta lista — assim uma tela nunca contradiz a outra.
   Quando houver API, troque estas listas pela resposta do servidor.

   CÓDIGO DE RASTREIO:  VLZ-{número do CT-e}-{UF de origem}   ex.: VLZ-894012-SP
   Para usar a UF de DESTINO, troque UF_DO_CODIGO para "destino".

   DATAS: são relativas a HOJE (dia(-3) = três dias atrás), então a demonstração
   nunca fica com datas antigas.

   status: coleta | hub | transito | entrega | ocorrencia | entregue
   grupo (filtros e totais): coleta | transito (hub, transito, entrega) | ocorrencia | entregue */
(() => {
  "use strict";

  const UF_DO_CODIGO = "origem"; // "origem" | "destino"

  /* ---------- datas relativas a hoje ---------- */
  const HOJE = new Date();
  HOJE.setHours(0, 0, 0, 0);
  const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const dia = (n) => {
    const d = new Date(HOJE);
    d.setDate(d.getDate() + n);
    return d;
  };
  const dois = (v) => String(v).padStart(2, "0");
  const ddmm = (n) => `${dois(dia(n).getDate())}/${dois(dia(n).getMonth() + 1)}`; // 19/05
  const dataNum = (n) => `${ddmm(n)}/${dia(n).getFullYear()}`; // 19/05/2026
  const curta = (n) => `${dois(dia(n).getDate())} ${MES[dia(n).getMonth()]}`; // 19 Mai
  const longa = (n) => `${curta(n)} ${dia(n).getFullYear()}`; // 19 Mai 2026

  // hubs de saída (origem) — sem hub informado, sai da planta + Hub SP-01 em Campinas
  const HUBS = {
    "Hub SP-01": { nome: "Campinas (Hub SP-01)", sub: "Ind. ABC • Campinas • SP", uf: "SP" },
    "Hub Campinas": { nome: "Campinas (Hub Campinas)", sub: "Ind. ABC • Campinas • SP", uf: "SP" },
    "Hub Paulínia": { nome: "Paulínia (Hub Paulínia)", sub: "Ind. ABC • Paulínia • SP", uf: "SP" },
  };
  const ORIGEM_PADRAO = { nome: "Campinas (Hub SP-01)", sub: "Ind. ABC • Campinas • SP", uf: "SP" };

  const origem = (m) => HUBS[m.hub] || ORIGEM_PADRAO;

  // código de rastreio do pedido: VLZ-{CT-e}-{UF}
  const codigo = (m) =>
    `VLZ-${m.cte}-${UF_DO_CODIGO === "destino" ? m.uf : origem(m).uf}`;

  // situação por status: etiqueta, % do trajeto e etapa atual
  // (0 coleta · 1 hub · 2 trânsito · 3 entregue · 4 concluído) — home e rastreio
  const SITUACOES = {
    coleta: { tag: "Aguardando Coleta", progresso: 8, etapa: 0 },
    hub: { tag: "No Centro de Distribuição", progresso: 38, etapa: 1 },
    transito: { tag: "Em Trânsito", progresso: 65, etapa: 2 },
    entrega: { tag: "Saiu para Entrega", progresso: 90, etapa: 2 },
    ocorrencia: { tag: "Ocorrência na Entrega", progresso: 85, etapa: 2 },
    entregue: { tag: "Entregue", progresso: 100, etapa: 4 },
  };
  // m.tag: etiqueta própria (ex.: "Pendência solucionada", vinda do tratamento da ocorrência)
  const situacao = (m) => {
    const s = SITUACOES[m.status] || SITUACOES.transito;
    return m.tag ? { ...s, tag: m.tag } : s;
  };

  // grupo usado nos filtros e nos totais (hub e "saiu p/ entrega" ainda estão em rota)
  const grupo = (m) =>
    m.status === "entregue" || m.status === "coleta" || m.status === "ocorrencia" ? m.status : "transito";

  const tipoDaModalidade = (mod) =>
    /express/i.test(mod) ? "expresso" : /fracion/i.test(mod) ? "fracionada" : "lotacao";

  /* ---------- 1) cargas em movimento (monitoramento, telemetria) ---------- */
  const LISTA = [
    { cte: "894012", nf: "049.201", cidade: "Curitiba", uf: "PR", mod: "Express 24h", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 15:45", hoje: true, obs: "Rota Urbana PR-01", local: "Rota Urbana PR-01 • Curitiba", dest: "Distribuidora Sulmetais Ltda", bairro: "Polo CIC", vols: 32, kg: 1180, dias: -1 },
    { cte: "894008", nf: "049.198", cidade: "Porto Alegre", uf: "RS", mod: "Fracionada B2B", status: "transito", rotulo: "Em Trânsito BR-101", eta: "Amanhã, 09:00", obs: "Posto Fiscal Garuva OK", local: "BR-101 KM 12 • Garuva (SC)", dest: "Gaúcha Chapas e Perfis", bairro: "Navegantes", vols: 54, kg: 2240, dias: -1 },
    { cte: "893985", nf: "049.176", cidade: "Belo Horizonte", uf: "MG", mod: "Lotação Fechada", status: "hub", rotulo: "Transferência HUB SP", eta: "Hoje, 22:30", obs: "Cross-docking Ativo", local: "HUB SP-01 • Cross-docking", dest: "Estruturas Minas Gerais S.A.", bairro: "Cidade Industrial", vols: 180, kg: 9600, dias: -1 },
    { cte: "893970", nf: "049.162", cidade: "Joinville", uf: "SC", mod: "Fracionada B2B", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 17:10", hoje: true, obs: "Motorista: Carlos E.", local: "Distrito Industrial • Joinville", dest: "Compressores Joinville Ltda", bairro: "Distrito Industrial", vols: 26, kg: 870, dias: -1 },
    { cte: "893910", nf: "049.140", cidade: "Caxias do Sul", uf: "RS", mod: "Carga Pesada", status: "transito", rotulo: "Em Trânsito BR-116", eta: "Amanhã, 14:00", obs: "Sem retenções", local: "BR-116 KM 84 • Campina Grande do Sul (PR)", dest: "Serra Gaúcha Implementos", bairro: "Distrito Industrial", vols: 140, kg: 11200, dias: -1 },
    { cte: "893892", nf: "049.133", cidade: "Florianópolis", uf: "SC", mod: "Express 24h", status: "transito", rotulo: "Em Trânsito BR-101", eta: "Hoje, 19:20", hoje: true, obs: "Pedágio Palhoça OK", local: "BR-101 KM 216 • Palhoça (SC)", dest: "Hidráulica Floripa Comércio", bairro: "Saco Grande", vols: 18, kg: 460, dias: -1 },
    { cte: "893877", nf: "049.127", cidade: "Ribeirão Preto", uf: "SP", mod: "Fracionada B2B", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 16:05", hoje: true, obs: "Motorista: Ana P.", local: "Av. Pres. Vargas • Ribeirão Preto", dest: "Agroindustrial Mogiana", bairro: "Jardim Califórnia", vols: 40, kg: 1520, dias: -1 },
    { cte: "893861", nf: "049.120", cidade: "Londrina", uf: "PR", mod: "Lotação Fechada", status: "transito", rotulo: "Em Trânsito BR-369", eta: "Amanhã, 08:30", obs: "Sem retenções", local: "BR-369 KM 140 • Ourinhos (SP)", dest: "Agro Peças Londrina Ltda", bairro: "Gleba Palhano", vols: 210, kg: 12400, dias: -1 },
    { cte: "893850", nf: "049.114", cidade: "Rio de Janeiro", uf: "RJ", mod: "Express 24h", status: "hub", rotulo: "Transferência HUB RJ", eta: "Amanhã, 10:15", obs: "Cross-docking Ativo", local: "HUB RJ-02 • Cross-docking", dest: "Fluminense Válvulas Industriais", bairro: "Caju", vols: 22, kg: 690, dias: -1 },
    { cte: "893842", nf: "049.109", cidade: "Uberlândia", uf: "MG", mod: "Carga Pesada", status: "transito", rotulo: "Em Trânsito BR-050", eta: "Amanhã, 16:40", obs: "Escolta liberada", local: "BR-050 KM 32 • Delta (MG)", dest: "Triângulo Siderurgia", bairro: "Distrito Industrial", vols: 96, kg: 14800, dias: -2 },
    { cte: "893831", nf: "049.101", cidade: "Blumenau", uf: "SC", mod: "Fracionada B2B", status: "transito", rotulo: "Em Trânsito BR-470", eta: "Amanhã, 11:20", obs: "Sem retenções", local: "BR-470 KM 18 • Navegantes (SC)", dest: "Têxtil Vale do Itajaí", bairro: "Itoupava", vols: 64, kg: 2980, dias: -1 },
    { cte: "893825", nf: "049.098", cidade: "São José dos Campos", uf: "SP", mod: "Express 24h", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 14:50", hoje: true, obs: "Motorista: Rafael T.", local: "Via Dutra KM 147 • São José dos Campos", dest: "Aeroparts Vale do Paraíba", bairro: "Eugênio de Melo", vols: 12, kg: 340, dias: -1 },
    { cte: "893818", nf: "049.092", cidade: "Maringá", uf: "PR", mod: "Fracionada B2B", status: "coleta", rotulo: "Aguardando Coleta", eta: "Amanhã, 18:00", obs: "Janela 13:00–15:00", local: "Planta Ind. ABC • Campinas (SP)", dest: "Ortomed Distribuidora", bairro: "Zona 7", vols: 10, kg: 260, dias: 0 },
    { cte: "893806", nf: "049.087", cidade: "Pelotas", uf: "RS", mod: "Lotação Fechada", status: "transito", rotulo: "Em Trânsito BR-116", eta: "Em 2 dias, 09:30", obs: "Sem retenções", local: "BR-116 KM 230 • Mafra (SC)", dest: "Pelotas Máquinas Agrícolas", bairro: "Fragata", vols: 150, kg: 10200, dias: -2 },
    { cte: "893799", nf: "049.081", cidade: "Juiz de Fora", uf: "MG", mod: "Fracionada B2B", status: "hub", rotulo: "Transferência HUB SP", eta: "Amanhã, 20:10", obs: "Cross-docking Ativo", local: "HUB SP-01 • Cross-docking", dest: "Mantiqueira Ferragens", bairro: "Benfica", vols: 30, kg: 1100, dias: -1 },
    { cte: "893785", nf: "049.074", cidade: "Chapecó", uf: "SC", mod: "Carga Pesada", status: "transito", rotulo: "Em Trânsito BR-282", eta: "Em 2 dias, 13:00", obs: "Balança Lages OK", local: "BR-282 KM 221 • Lages (SC)", dest: "Oeste Catarinense Agroindústria", bairro: "Efapi", vols: 120, kg: 13500, dias: -2 },
    { cte: "893771", nf: "049.066", cidade: "Santos", uf: "SP", mod: "Express 24h", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 18:25", hoje: true, obs: "Motorista: Diego M.", local: "Av. Portuária • Santos", dest: "Construtora Atlântica S.A.", bairro: "Alemoa", vols: 20, kg: 780, dias: -1 },
    { cte: "893760", nf: "049.059", cidade: "Ponta Grossa", uf: "PR", mod: "Fracionada B2B", status: "transito", rotulo: "Em Trânsito BR-376", eta: "Amanhã, 12:45", obs: "Sem retenções", local: "BR-376 KM 503 • Tibagi (PR)", dest: "Metalúrgica Paraná Aços", bairro: "Distrito Industrial", vols: 44, kg: 1960, dias: -1 },
  ];

  // completa os campos que a tela de Manifestos usa (série, chave, pedido, despacho…)
  LISTA.forEach((m, i) => {
    m.serie = "Série 1";
    m.chave = `3524 ${dois(dia(m.dias).getMonth() + 1)}11 ${m.cte.slice(0, 4)} ${m.cte.slice(2)}`.slice(0, 19);
    m.pedido = `#ORD-${m.cte.slice(1)}-${m.uf}`;
    m.hub = i % 3 === 2 ? "Hub Campinas" : "Hub SP-01";
    m.despacho = m.dias === 0 ? "Hoje" : longa(m.dias);
    m.despachoHora = m.status === "coleta" ? m.obs : `${dois(6 + (i % 12))}:${i % 2 ? "30" : "10"} (${m.hub})`;
    m.modTipo = tipoDaModalidade(m.mod);
    m.prev = m.eta;
    m.prevNota = m.obs;
  });

  /* ---------- 2) cargas da gestão (entregues, ocorrências, coletas…) ---------- */
  const CARGAS = [
    {
      cte: "0089241", serie: "Série 1", chave: "5224 0419 8831 0029", nf: "457891", vols: 48, kg: 1420,
      dest: "Distribuidora Sulmetais Ltda", cidade: "Curitiba", uf: "PR", bairro: "Polo CIC", pedido: "#ORD-99120-PR",
      dias: -4, despacho: longa(-4), despachoHora: "06:40 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "entregue", rotulo: "Entregue c/ POD",
      prev: longa(-3), prevNota: "Entregue 14:28", eta: `Entregue em ${ddmm(-3)}, 14:28`, obs: "Comprovante digital (POD) autenticado", local: "Polo CIC • Doca 03",
      pod: { recebedor: "Marcos Vinícius de Abreu", doc: "28.199.304-X", carimbo: `${dataNum(-3)} às 14:28:11`, lat: -25.502941, lng: -49.32481, raio: 4, local: "Curitiba / PR • Polo CIC - Doca 03", registro: "#VL-772910", entregador: "Roberto Silva", conferente: "Carlos Mendes" },
    },
    {
      cte: "0089304", serie: "Série 1", chave: "3524 0511 7720 0019", nf: "458012", vols: 120, kg: 4890,
      dest: "Eletromecânica Joinville S.A.", cidade: "Joinville", uf: "SC", bairro: "Distrito Industrial", pedido: "#ORD-99155-SC",
      dias: -3, despacho: longa(-3), despachoHora: "19:15 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Carga Fracionada", modTipo: "fracionada", status: "transito", rotulo: "Em Trânsito (BR-101)",
      prev: "Hoje, 17:40", prevNota: "Previsão de chegada", eta: "Hoje, 17:40", obs: "Posto Fiscal Garuva OK", local: "BR-101 KM 34 • Garuva (SC)",
    },
    {
      cte: "0089115", serie: "Série 2", chave: "4124 0519 2200 4821", nf: "457640", vols: 14, kg: 620,
      dest: "Montagens Industriais Rio Preto", cidade: "S. José do Rio Preto", uf: "SP", bairro: "Distrito Industrial", pedido: "#ORD-98842-RP",
      dias: -5, despacho: longa(-5), despachoHora: "10:00 (Hub Campinas)", hub: "Hub Campinas",
      mod: "Expresso Rodoviário", modTipo: "expresso", status: "ocorrencia", rotulo: "Doca Fechada (Reentrega)",
      prev: "Reentrega amanhã", prevNota: `1ª tentativa ${curta(-1)}`, eta: "Reentrega amanhã", obs: `Doca fechada na 1ª tentativa (${curta(-1)})`, local: "Base Rio Preto • Doca 2",
    },
    {
      cte: "0088990", serie: "Série 1", chave: "3524 0501 9912 3445", nf: "456988", vols: 320, kg: 8100,
      dest: "Usimetal S/A Mineração", cidade: "Belo Horizonte", uf: "MG", bairro: "Hub Contagem", pedido: "#ORD-97551-MG",
      dias: -7, despacho: longa(-7), despachoHora: "21:00 (Hub Paulínia)", hub: "Hub Paulínia",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "entregue", rotulo: "Entregue c/ POD",
      prev: longa(-5), prevNota: "Entregue 09:12", eta: `Entregue em ${ddmm(-5)}, 09:12`, obs: "Comprovante digital (POD) autenticado", local: "CD Usimetal • Doca 07",
      pod: { recebedor: "Juliana Costa Ramos", doc: "MG-14.552.870", carimbo: `${dataNum(-5)} às 09:12:47`, lat: -19.9317, lng: -44.0536, raio: 6, local: "Contagem / MG • CD Usimetal - Doca 07", registro: "#VL-771844", entregador: "Anderson Lima", conferente: "Juliana Ramos" },
    },
    {
      cte: "0089332", serie: "Minuta", chave: "3524 0520 9011 8832", nf: "458105", vols: 60, kg: 2100,
      dest: "TecnoSteel Equipamentos Brasil", cidade: "Porto Alegre", uf: "RS", bairro: "4º Distrito", pedido: "#ORD-99210-RS",
      dias: 0, despacho: "Hoje", despachoHora: "Janela das 14h às 18h", hub: "Hub SP-01",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "coleta", rotulo: "Aguardando Coleta",
      prev: longa(3), prevNota: "SLA 72h", eta: longa(3), obs: "Janela de coleta 14h–18h", local: "Planta Ind. ABC • Campinas (SP)",
    },
    {
      cte: "0089287", serie: "Série 1", chave: "3524 0510 4410 7765", nf: "457902", vols: 36, kg: 940,
      dest: "Agro Peças Londrina Ltda", cidade: "Londrina", uf: "PR", bairro: "Gleba Palhano", pedido: "#ORD-99133-PR",
      dias: -4, despacho: longa(-4), despachoHora: "14:10 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Carga Fracionada", modTipo: "fracionada", status: "entregue", rotulo: "Entregue c/ POD",
      prev: longa(-2), prevNota: "Entregue 10:05", eta: `Entregue em ${ddmm(-2)}, 10:05`, obs: "Comprovante digital (POD) autenticado", local: "Gleba Palhano • Portaria 1",
      pod: { recebedor: "Paulo Henrique Duarte", doc: "34.118.902-7", carimbo: `${dataNum(-2)} às 10:05:33`, lat: -23.3045, lng: -51.1696, raio: 5, local: "Londrina / PR • Gleba Palhano - Portaria 1", registro: "#VL-772233", entregador: "Marcelo Souza", conferente: "Paulo Duarte" },
    },
    {
      cte: "0089298", serie: "Série 1", chave: "3524 0512 6620 1180", nf: "457955", vols: 210, kg: 6350,
      dest: "Vale Sul Laminados S.A.", cidade: "Caxias do Sul", uf: "RS", bairro: "Distrito Industrial", pedido: "#ORD-99148-RS",
      dias: -3, despacho: longa(-3), despachoHora: "08:30 (Hub Paulínia)", hub: "Hub Paulínia",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "transito", rotulo: "Em Trânsito (BR-116)",
      prev: "Amanhã, 11:00", prevNota: "Previsão de chegada", eta: "Amanhã, 11:00", obs: "Sem retenções", local: "BR-116 KM 84 • Campina Grande do Sul (PR)",
    },
    {
      cte: "0089250", serie: "Série 1", chave: "3524 0509 1180 2241", nf: "457866", vols: 22, kg: 410,
      dest: "Hidráulica Floripa Comércio", cidade: "Florianópolis", uf: "SC", bairro: "Saco Grande", pedido: "#ORD-99126-SC",
      dias: -4, despacho: longa(-4), despachoHora: "11:45 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Expresso Rodoviário", modTipo: "expresso", status: "entregue", rotulo: "Entregue c/ POD",
      prev: longa(-3), prevNota: "Entregue 16:52", eta: `Entregue em ${ddmm(-3)}, 16:52`, obs: "Comprovante digital (POD) autenticado", local: "Saco Grande • Recebimento",
      pod: { recebedor: "Fernanda Lopes Martins", doc: "6.552.019", carimbo: `${dataNum(-3)} às 16:52:08`, lat: -27.5536, lng: -48.4981, raio: 3, local: "Florianópolis / SC • Saco Grande - Recebimento", registro: "#VL-772871", entregador: "Thiago Ramos", conferente: "Fernanda Martins" },
    },
    {
      cte: "0089266", serie: "Série 2", chave: "4124 0511 3307 9954", nf: "457881", vols: 8, kg: 180,
      dest: "Ortomed Distribuidora", cidade: "Maringá", uf: "PR", bairro: "Zona 7", pedido: "#ORD-99131-PR",
      dias: -4, despacho: longa(-4), despachoHora: "16:20 (Hub Campinas)", hub: "Hub Campinas",
      mod: "Expresso Rodoviário", modTipo: "expresso", status: "ocorrencia", rotulo: "Destinatário Ausente",
      prev: "Reentrega amanhã", prevNota: "Agendada c/ cliente", eta: "Reentrega amanhã", obs: "Destinatário ausente na 1ª tentativa", local: "Base Maringá • Doca 1",
    },
    {
      cte: "0089319", serie: "Série 1", chave: "3524 0518 8890 4410", nf: "458077", vols: 75, kg: 2980,
      dest: "Metalúrgica Paraná Aços", cidade: "Ponta Grossa", uf: "PR", bairro: "Distrito Industrial", pedido: "#ORD-99188-PR",
      dias: -2, despacho: longa(-2), despachoHora: "07:15 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Carga Fracionada", modTipo: "fracionada", status: "transito", rotulo: "Em Trânsito (BR-376)",
      prev: "Hoje, 19:30", prevNota: "Previsão de chegada", eta: "Hoje, 19:30", obs: "Sem retenções", local: "BR-376 KM 503 • Tibagi (PR)",
    },
    {
      cte: "0089201", serie: "Série 1", chave: "3524 0505 7712 0036", nf: "457712", vols: 140, kg: 5220,
      dest: "Construtora Atlântica S.A.", cidade: "Santos", uf: "SP", bairro: "Alemoa", pedido: "#ORD-99098-SP",
      dias: -5, despacho: longa(-5), despachoHora: "05:50 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "entregue", rotulo: "Entregue c/ POD",
      prev: longa(-5), prevNota: "Entregue 15:40", eta: `Entregue em ${ddmm(-5)}, 15:40`, obs: "Comprovante digital (POD) autenticado", local: "Alemoa • Pátio 4",
      pod: { recebedor: "Ricardo Almeida Prado", doc: "41.220.775-2", carimbo: `${dataNum(-5)} às 15:40:19`, lat: -23.9318, lng: -46.3505, raio: 8, local: "Santos / SP • Alemoa - Pátio 4", registro: "#VL-771992", entregador: "Diego Moraes", conferente: "Ricardo Prado" },
    },
    {
      cte: "0089340", serie: "Minuta", chave: "3524 0521 2219 6604", nf: "458130", vols: 18, kg: 540,
      dest: "Química Fina Paulínia", cidade: "Paulínia", uf: "SP", bairro: "Polo Petroquímico", pedido: "#ORD-99230-SP",
      dias: 0, despacho: "Hoje", despachoHora: "Janela das 9h às 12h", hub: "Hub Campinas",
      mod: "Carga Fracionada", modTipo: "fracionada", status: "coleta", rotulo: "Aguardando Coleta",
      prev: longa(2), prevNota: "SLA 48h", eta: longa(2), obs: "Janela de coleta 9h–12h", local: "Planta Ind. ABC • Campinas (SP)",
    },
    {
      // viagem longa com várias ocorrências — mostra o histórico em rolagem (rastreio)
      cte: "0089377", serie: "Série 1", chave: "3524 0522 4471 9908", nf: "458201", vols: 96, kg: 7340,
      dest: "Norte Atacadista de Ferragens", cidade: "Belém", uf: "PA", bairro: "Distrito de Icoaraci", pedido: "#ORD-99251-PA",
      dias: -8, despacho: longa(-8), despachoHora: "22:10 (Hub Paulínia)", hub: "Hub Paulínia",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "ocorrencia", rotulo: "Recebimento Fechado",
      prev: `Reentrega ${curta(1)}`, prevNota: "3ª tentativa agendada", eta: `Reentrega ${curta(1)}, 08:00`,
      obs: "Recebimento fechado na 2ª tentativa", local: "Base Belém • Doca 5",
      // histórico próprio (mais recente primeiro). tipo "ocorrencia" = ícone de alerta
      eventos: [
        { titulo: "Ocorrência: Recebimento fechado (2ª tentativa)", local: "Base Belém • Doca 5 (PA)", texto: `Portaria informou expediente encerrado. 3ª tentativa agendada com o cliente para ${ddmm(1)} às 08:00.`, quando: `${ddmm(0)} 17:40`, tipo: "ocorrencia" },
        { titulo: "Saiu para entrega (2ª tentativa)", local: "Base Belém (PA)", texto: "Carga roteirizada com prioridade e motorista dedicado.", quando: `${ddmm(0)} 13:15` },
        { titulo: "Ocorrência: Divergência de endereço na NF-e", local: "Distrito de Icoaraci • Belém (PA)", texto: "Número do galpão divergente na NF-e. Endereço correto confirmado com o cliente por telefone.", quando: `${ddmm(-1)} 16:05`, tipo: "ocorrencia" },
        { titulo: "Saiu para entrega (1ª tentativa)", local: "Base Belém (PA)", texto: "Motorista: Jefferson A. • Placa QTA-4G21.", quando: `${ddmm(-1)} 09:30` },
        { titulo: "Chegada à base de destino", local: "Belém (PA)", texto: "Carga conferida, sem avarias, e roteirizada para a entrega final.", quando: `${ddmm(-2)} 22:48` },
        { titulo: "Ocorrência: Retenção na barreira fiscal", local: "Posto Fiscal de Imperatriz (MA)", texto: "Conferência documental da SEFAZ-MA. Carga liberada após 3h40 sem pendências.", quando: `${ddmm(-3)} 14:20`, tipo: "ocorrencia" },
        { titulo: "Em trânsito", local: "BR-010 KM 1.256 • Imperatriz (MA)", texto: "Telemetria normal, velocidade média de 72 km/h.", quando: `${ddmm(-3)} 06:10` },
        { titulo: "Ocorrência: Desvio por obras na pista", local: "BR-153 KM 412 • Uruaçu (GO)", texto: "Pista interditada pelo DNIT. Rota alternativa autorizada pela torre de controle (+46 km).", quando: `${ddmm(-4)} 11:35`, tipo: "ocorrencia" },
        { titulo: "Parada obrigatória de descanso", local: "Anápolis (GO)", texto: "Descanso do motorista conforme a Lei 13.103 (11h). Carga monitorada no pátio.", quando: `${ddmm(-5)} 21:00` },
        { titulo: "Em trânsito", local: "BR-050 KM 32 • Delta (MG)", texto: "Sem retenções. Telemetria e sensores de baú normais.", quando: `${ddmm(-5)} 08:45` },
        { titulo: "Saída do centro de distribuição", local: "Paulínia (Hub Paulínia)", texto: "Carga lacrada (lacre nº 448210) e liberada para a viagem.", quando: `${ddmm(-7)} 05:30` },
        { titulo: "Carga recebida no hub", local: "Paulínia (Hub Paulínia)", texto: "Conferência de peso e cubagem finalizada no centro de distribuição.", quando: `${ddmm(-8)} 23:15` },
        { titulo: "Coleta realizada", local: "Ind. ABC • Paulínia • SP", texto: "Mercadoria da NF 458201 coletada e integrada à operação.", quando: `${ddmm(-8)} 18:40` },
      ],
    },
  ];

  /* ---------- 3) entregas anteriores do período (todas com canhoto/POD) ----------
     São os mesmos canhotos do "Repositório de Canhotos" da tela de Faturas. */
  const HISTORICO = [
    { cte: "0088402", nf: "456402", dest: "Mendes Usinagem de Precisão", cidade: "Campinas", uf: "SP", bairro: "Techno Park", mod: "Carga Fracionada", vols: 16, kg: 520, d: -6, hora: "14:38:12", recebedor: "Carlos Eduardo Mendes de Oliveira", doc: "RG 28.910.442-X SP", lat: -22.9056, lng: -47.0608 },
    { cte: "0088398", nf: "456398", dest: "Paulista Componentes Elétricos", cidade: "São Paulo", uf: "SP", bairro: "Barra Funda", mod: "Expresso Rodoviário", vols: 9, kg: 210, d: -7, hora: "11:15:40", recebedor: "Mariana Fagundes Guimarães", doc: "CPF ***.482.908-**", lat: -23.5505, lng: -46.6333 },
    { cte: "0088370", nf: "456370", dest: "Jundiaí Embalagens Industriais", cidade: "Jundiaí", uf: "SP", bairro: "Distrito Industrial", mod: "Carga Fracionada", vols: 34, kg: 1240, d: -8, hora: "16:52:03", recebedor: "Roberto Alencar (Almoxarifado)", doc: "Matrícula Funcional nº 4491", lat: -23.1857, lng: -46.8978 },
    { cte: "0088355", nf: "456355", dest: "Distribuidora Sulmetais Ltda", cidade: "Curitiba", uf: "PR", bairro: "Polo CIC", mod: "Lotação Dedicada", vols: 88, kg: 6100, d: -9, hora: "10:04:51", recebedor: "Juliana Prado Siqueira", doc: "RG 41.220.118-3 SP", lat: -25.4284, lng: -49.2733 },
    { cte: "0088341", nf: "456341", dest: "Compressores Joinville Ltda", cidade: "Joinville", uf: "SC", bairro: "Distrito Industrial", mod: "Carga Fracionada", vols: 28, kg: 960, d: -10, hora: "15:27:09", recebedor: "Anderson Luiz Tavares", doc: "CPF ***.117.640-**", lat: -26.3045, lng: -48.8487 },
    { cte: "0088322", nf: "456322", dest: "Agroindustrial Mogiana", cidade: "Ribeirão Preto", uf: "SP", bairro: "Jardim Califórnia", mod: "Expresso Rodoviário", vols: 12, kg: 380, d: -13, hora: "09:41:33", recebedor: "Patrícia Nogueira (Recebimento)", doc: "Matrícula Funcional nº 1187", lat: -21.1775, lng: -47.8103 },
    { cte: "0088317", nf: "456317", dest: "Aeroparts Vale do Paraíba", cidade: "São José dos Campos", uf: "SP", bairro: "Eugênio de Melo", mod: "Expresso Rodoviário", vols: 6, kg: 150, d: -14, hora: "13:12:45", recebedor: "Fábio Henrique Costa", doc: "RG 19.554.301-7 SP", lat: -23.1791, lng: -45.8872 },
    { cte: "0088304", nf: "456304", dest: "Gaúcha Chapas e Perfis", cidade: "Porto Alegre", uf: "RS", bairro: "Navegantes", mod: "Lotação Dedicada", vols: 110, kg: 8800, d: -15, hora: "17:55:20", recebedor: "Sandra Regina Lopes", doc: "CPF ***.903.215-**", lat: -30.0346, lng: -51.2177 },
    { cte: "0088296", nf: "456296", dest: "Estruturas Minas Gerais S.A.", cidade: "Belo Horizonte", uf: "MG", bairro: "Cidade Industrial", mod: "Lotação Dedicada", vols: 140, kg: 9900, d: -16, hora: "08:47:16", recebedor: "Marcelo Antunes Ribeiro", doc: "Matrícula Funcional nº 2210", lat: -19.9167, lng: -43.9345 },
  ].map((h, i) => {
    const hm = h.hora.slice(0, 5);
    return {
      cte: h.cte, serie: "Série 1", chave: `3524 ${dois(dia(h.d).getMonth() + 1)}${dois(dia(h.d).getDate())} ${h.cte.slice(0, 4)} ${h.cte.slice(3)}`.slice(0, 19),
      nf: h.nf, vols: h.vols, kg: h.kg, dest: h.dest, cidade: h.cidade, uf: h.uf, bairro: h.bairro, pedido: `#ORD-${h.cte.slice(2)}-${h.uf}`,
      dias: h.d - 1, despacho: longa(h.d - 1), despachoHora: `${dois(6 + (i % 4))}:20 (Hub SP-01)`, hub: "Hub SP-01",
      mod: h.mod, modTipo: tipoDaModalidade(h.mod), status: "entregue", rotulo: "Entregue c/ POD",
      prev: longa(h.d), prevNota: `Entregue ${hm}`, eta: `Entregue em ${ddmm(h.d)}, ${hm}`, obs: "Comprovante digital (POD) autenticado", local: `${h.bairro} • Recebimento`,
      pod: { recebedor: h.recebedor, doc: h.doc, carimbo: `${dataNum(h.d)} às ${h.hora}`, lat: h.lat, lng: h.lng, raio: 3 + (i % 5), local: `${h.cidade} / ${h.uf} • ${h.bairro}`, registro: `#VL-${h.cte.slice(1)}`, entregador: "Equipe VelozLog", conferente: h.recebedor.split(" (")[0] },
    };
  });

  /* ---------- lista única e totais ---------- */
  const TODOS = [...LISTA, ...CARGAS, ...HISTORICO];

  // totais de uma lista (padrão: todos). A tela de Manifestos recalcula pelo período.
  function totais(lista = TODOS) {
    const conta = (g) => lista.filter((m) => grupo(m) === g).length;
    const entregas = conta("entregue");
    const comPod = lista.filter((m) => grupo(m) === "entregue" && m.pod).length;
    return {
      envios: lista.length,
      novos: lista.filter((m) => m.dias >= -1).length, // despachados nas últimas 24h
      emRota: conta("transito"),
      entregas,
      pctPod: entregas ? `${Math.round((comPod / entregas) * 100)}%` : "—",
      ocorrencias: conta("ocorrencia"),
      coletas: conta("coleta"),
      saiuEntrega: lista.filter((m) => m.status === "entrega").length,
    };
  }

  // coletas agendadas pelo cliente na tela "Solicitar Coleta" (guardadas no navegador)
  const CHAVE_COLETAS = "velozlog:coletas";
  function coletasSolicitadas() {
    try {
      const lista = JSON.parse(localStorage.getItem(CHAVE_COLETAS) || "[]");
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  }

  /* =========================================================
     OCORRÊNCIAS DO CLIENTE (Manifestos & CTEs → Registrar / Tratar)
     Ciclo: análise → (aguardando cliente) → pendência solucionada → nova tentativa:
     despacho → em rota → saiu para entrega → entregue. Desvios: devolução ou cancelamento.
     Cada etapa muda a SITUAÇÃO da carga (ver efetivo()), e com ela o rastreio,
     o card da home, a tabela de Manifestos e a Visão Geral.
     ========================================================= */
  const ESTADOS_OC = {
    analise: { rotulo: "Em análise pela Torre", fase: "aberta", proximos: ["aguardando", "solucionada", "despacho", "devolucao", "cancelada"] },
    aguardando: { rotulo: "Aguardando retorno do cliente", fase: "aberta", proximos: ["solucionada", "devolucao", "cancelada"] },
    solucionada: { rotulo: "Pendência solucionada", fase: "andamento", proximos: ["despacho", "devolucao"] },
    despacho: { rotulo: "Nova tentativa: em despacho", fase: "andamento", proximos: ["rota"] },
    rota: { rotulo: "Nova tentativa: em rota", fase: "andamento", proximos: ["saiu"] },
    saiu: { rotulo: "Nova tentativa: saiu para entrega", fase: "andamento", proximos: ["entregue", "analise"] },
    entregue: { rotulo: "Resolvida • Entregue", fase: "encerrada", proximos: [] },
    devolucao: { rotulo: "Em devolução ao remetente", fase: "andamento", proximos: ["devolvido"] },
    devolvido: { rotulo: "Resolvida • Devolvido ao remetente", fase: "encerrada", proximos: [] },
    cancelada: { rotulo: "Cancelada", fase: "encerrada", proximos: [] },
  };
  // texto de cada ação na janela "Tratar Ocorrência"
  const ACOES_OC = {
    analise: "Nova tentativa sem sucesso (reabrir ocorrência)",
    aguardando: "Aguardar retorno do cliente (pendência com o cliente)",
    solucionada: "Marcar pendência como solucionada",
    despacho: "Colocar para despacho (nova tentativa de entrega)",
    rota: "Carga em rota (nova tentativa)",
    saiu: "Saiu para entrega (nova tentativa)",
    entregue: "Confirmar entrega",
    devolucao: "Devolver ao remetente",
    devolvido: "Confirmar devolução recebida",
    cancelada: "Cancelar ocorrência (registrada por engano)",
  };
  // título do evento no histórico do rastreio
  const EVENTOS_OC = {
    analise: "Ocorrência reaberta: nova tentativa sem sucesso",
    aguardando: "Ocorrência: aguardando retorno do cliente",
    solucionada: "Pendência solucionada",
    despacho: "Nova tentativa: carga em despacho",
    rota: "Nova tentativa: em rota para o destino",
    saiu: "Nova tentativa: saiu para entrega",
    entregue: "Entrega realizada (nova tentativa)",
    devolucao: "Carga em devolução ao remetente",
    devolvido: "Devolvido ao remetente",
    cancelada: "Ocorrência cancelada",
  };

  const CHAVE_OCORRENCIAS = "velozlog:ocorrencias";
  // completa ocorrências antigas (antes do tratamento existir)
  const normalizar = (o) => {
    const estado = ESTADOS_OC[o.estado] ? o.estado : "analise";
    return { ...o, estado, status: ESTADOS_OC[estado].rotulo, historico: Array.isArray(o.historico) ? o.historico : [] };
  };
  // mais recentes primeiro · cte: só as daquela carga
  function ocorrenciasCliente(cte) {
    try {
      const lista = JSON.parse(localStorage.getItem(CHAVE_OCORRENCIAS) || "[]");
      if (!Array.isArray(lista)) return [];
      const todas = lista.map(normalizar);
      return cte ? todas.filter((o) => o.cte === cte) : todas;
    } catch {
      return [];
    }
  }
  function gravar(lista, detalhe) {
    localStorage.setItem(CHAVE_OCORRENCIAS, JSON.stringify(lista.slice(0, 50)));
    document.dispatchEvent(new CustomEvent("vl:ocorrencias", { detail: detalhe }));
  }
  function salvarOcorrencia(o) {
    const nova = normalizar({ ...o, estado: "analise", historico: [] });
    gravar([nova, ...ocorrenciasCliente()], nova);
    return nova;
  }
  // tratamento: muda a etapa e guarda no andamento (quem/quando/o quê)
  function atualizarOcorrencia(protocolo, estado, extra = {}) {
    if (!ESTADOS_OC[estado]) throw new Error("estado inválido: " + estado);
    const lista = ocorrenciasCliente();
    const o = lista.find((x) => x.protocolo === protocolo);
    if (!o) throw new Error("ocorrência não encontrada: " + protocolo);
    o.historico.push({ estado, ts: Date.now(), ...extra });
    o.estado = estado;
    o.status = ESTADOS_OC[estado].rotulo;
    gravar(lista, o);
    return o;
  }
  // ocorrência que manda na situação da carga: a mais recente que não foi cancelada
  const ocorrenciaVigente = (cte) => ocorrenciasCliente(cte).find((o) => o.estado !== "cancelada") || null;
  // ainda aberta (em análise / aguardando cliente)?
  const ocorrenciaAberta = (cte) => {
    const o = ocorrenciaVigente(cte);
    return o && ESTADOS_OC[o.estado].fase === "aberta" ? o : null;
  };

  // coordenadas aproximadas do destino (comprovante gerado na nova tentativa)
  const COORD = {
    "Curitiba": [-25.4284, -49.2733], "Porto Alegre": [-30.0346, -51.2177], "Belo Horizonte": [-19.9167, -43.9345],
    "Joinville": [-26.3045, -48.8487], "Caxias do Sul": [-29.1678, -51.1794], "Florianópolis": [-27.5954, -48.548],
    "Ribeirão Preto": [-21.1775, -47.8103], "Londrina": [-23.3045, -51.1696], "Rio de Janeiro": [-22.9068, -43.1729],
    "Uberlândia": [-18.9186, -48.2772], "Blumenau": [-26.9194, -49.0661], "São José dos Campos": [-23.1791, -45.8872],
    "Maringá": [-23.4205, -51.9333], "Pelotas": [-31.7654, -52.3376], "Juiz de Fora": [-21.7642, -43.3503],
    "Chapecó": [-27.1004, -52.6152], "Santos": [-23.9608, -46.3336], "Ponta Grossa": [-25.095, -50.1619],
    "Campinas": [-22.9056, -47.0608], "São Paulo": [-23.5505, -46.6333], "Belém": [-1.4558, -48.4902],
  };
  const doisD = (n) => String(n).padStart(2, "0");

  // SITUAÇÃO ATUAL da carga com a ocorrência aplicada (sem ocorrência, a própria carga).
  // .original guarda a carga como veio da operação (o rastreio usa para o histórico).
  function efetivo(m) {
    if (!m || m.original) return m;
    const o = ocorrenciaVigente(m.cte);
    if (!o || ESTADOS_OC[o.estado].fase === "aberta") return m;
    const ult = o.historico[o.historico.length - 1] || {};
    const quando = new Date(ult.ts || o.criada);
    const hm = `${doisD(quando.getHours())}:${doisD(quando.getMinutes())}`;
    const ddmmQ = `${doisD(quando.getDate())}/${doisD(quando.getMonth() + 1)}`;
    const base = { ...m, original: m, ocorrencia: o };
    const podDe = (local, coord) => ({
      recebedor: ult.recebedor || "Recebedor no destino",
      doc: ult.doc || "—",
      carimbo: `${ddmmQ}/${quando.getFullYear()} às ${hm}:${doisD(quando.getSeconds())}`,
      lat: coord[0],
      lng: coord[1],
      raio: 5,
      local,
      registro: `#VL-${m.cte.slice(-6)}R`,
      entregador: "Equipe VelozLog",
      conferente: (ult.recebedor || "").split(" (")[0],
    });
    switch (o.estado) {
      case "solucionada":
        return { ...base, status: "hub", tag: "Pendência solucionada", rotulo: "Pendência solucionada", etapaNome: "Pendência solucionada",
          eta: "Pendência solucionada", prev: "Nova tentativa", prevNota: "Pendência solucionada", obs: "", emTratamento: true };
      case "despacho":
        return { ...base, status: "hub", tag: "Nova tentativa: em despacho", rotulo: "Em despacho (nova tentativa)", etapaNome: "Em despacho (nova tentativa)",
          eta: "Despacho", prev: "Nova tentativa", prevNota: "Em despacho", obs: "", emTratamento: true };
      case "rota":
        return { ...base, status: "transito", tag: "Em rota (nova tentativa)", rotulo: "Em rota (nova tentativa)", etapaNome: "Em rota (nova tentativa)",
          eta: "Nova tentativa de entrega", prev: "Amanhã, até 18:00", prevNota: "Nova tentativa", obs: "", emTratamento: true };
      case "saiu":
        return { ...base, status: "entrega", tag: "Saiu para entrega (nova tentativa)", rotulo: "Saiu p/ Entrega (nova tentativa)", etapaNome: "Saiu para entrega (nova tentativa)",
          eta: "Saiu para entrega", prev: "Hoje, até 18:00", prevNota: "Nova tentativa", obs: "", emTratamento: true, hoje: true };
      case "devolucao":
        return { ...base, status: "transito", tag: "Em devolução ao remetente", rotulo: "Em devolução", etapaNome: "Em devolução ao remetente",
          eta: "Devolução ao remetente", prev: "Retorno ao remetente", prevNota: "Em devolução", obs: "", emTratamento: true };
      case "entregue":
        return { ...base, status: "entregue", tag: "Entregue", rotulo: "Entregue c/ POD (nova tentativa)",
          eta: `Entregue em ${ddmmQ}, ${hm}`, prev: `${ddmmQ}/${quando.getFullYear()}`, prevNota: `Entregue ${hm}`,
          obs: "Comprovante digital (POD) autenticado", local: `${m.bairro || m.cidade} • Recebimento`,
          pod: podDe(`${m.cidade} / ${m.uf} • ${m.bairro || "Recebimento"}`, COORD[m.cidade] || COORD["São Paulo"]) };
      case "devolvido": {
        const org = origem(m);
        return { ...base, status: "entregue", tag: "Devolvido ao remetente", rotulo: "Devolvido ao remetente", devolvido: true,
          eta: `Devolvido em ${ddmmQ}, ${hm}`, prev: `${ddmmQ}/${quando.getFullYear()}`, prevNota: `Devolvido ${hm}`,
          obs: "Devolução recebida pelo remetente", local: org.nome,
          pod: podDe(`${org.sub}`, COORD["Campinas"]) };
      }
      default:
        return m;
    }
  }

  // aceita o código de rastreio "VLZ-894012-SP" e também "CTE-894012" ou só "894012"
  function buscar(texto) {
    const numero = String(texto || "").replace(/\D/g, "");
    if (!numero) return null;
    // situação atual (com a ocorrência tratada aplicada)
    return efetivo(TODOS.find((m) => m.cte === numero) || null);
  }

  window.VelozManifestos = Object.freeze({
    lista: LISTA, // cargas em movimento (monitoramento / telemetria)
    cargas: TODOS, // tudo: a tela de Manifestos mostra esta
    todos: TODOS,
    totais: totais(TODOS.map(efetivo)),
    calcularTotais: totais,
    coletasSolicitadas,
    CHAVE_COLETAS,
    ocorrenciasCliente,
    salvarOcorrencia,
    atualizarOcorrencia,
    ocorrenciaVigente,
    ocorrenciaAberta,
    efetivo,
    ESTADOS_OC,
    ACOES_OC,
    EVENTOS_OC,
    grupo,
    datas: { dia, ddmm, dataNum, curta, longa },
    buscar,
    codigo,
    origem,
    situacao,
  });
})();
