/* VelozLog — manifestos do Portal B2B (dados de DEMONSTRAÇÃO, fonte única)
   Usado pela home (card de rastreio), pelo portal (portal.js e gestao.js) e pelo
   rastreio (rastreio.js: /rastreio.html?codigo=VLZ-894012-SP).
   Quando houver API, troque esta lista pela resposta do servidor.

   CÓDIGO DE RASTREIO (o mesmo formato do exemplo da home, VLZ-849102-SP):
     VLZ-{número do CT-e}-{UF de origem}      ex.: CT-e 894012 saindo de SP → VLZ-894012-SP
   Para usar a UF de DESTINO, troque UF_DO_CODIGO para "destino".

   status: entrega | transito | hub | coleta
   hoje:   ETA de hoje (fica laranja no portal)
   local:  onde a carga está agora (linha "Telemetria em tempo real" do rastreio) */
(() => {
  "use strict";

  const UF_DO_CODIGO = "origem"; // "origem" | "destino"

  // hubs de saída (origem) — sem hub informado, sai da planta + Hub SP-01 em Campinas
  const HUBS = {
    "Hub SP-01": { nome: "São Paulo (Hub SP-01)", sub: "Ind. ABC • São Paulo • SP", uf: "SP" },
    "Hub Campinas": { nome: "Campinas (Hub Campinas)", sub: "Ind. ABC • Campinas • SP", uf: "SP" },
    "Hub Paulínia": { nome: "Paulínia (Hub Paulínia)", sub: "Ind. ABC • Paulínia • SP", uf: "SP" },
  };
  const ORIGEM_PADRAO = { nome: "Campinas (HUB SP-01)", sub: "Ind. ABC • Campinas • SP", uf: "SP" };

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
  const situacao = (m) => SITUACOES[m.status] || SITUACOES.transito;

  const LISTA = [
    { cte: "894012", nf: "049.201", cidade: "Curitiba", uf: "PR", mod: "Express 24h", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 15:45", hoje: true, obs: "Rota Urbana PR-01", local: "Rota Urbana PR-01 • Curitiba" },
    { cte: "894008", nf: "049.198", cidade: "Porto Alegre", uf: "RS", mod: "Fracionada B2B", status: "transito", rotulo: "Em Trânsito BR-101", eta: "Amanhã, 09:00", obs: "Posto Fiscal Garuva OK", local: "BR-101 KM 12 • Garuva (SC)" },
    { cte: "893985", nf: "049.176", cidade: "Belo Horizonte", uf: "MG", mod: "Lotação Fechada", status: "hub", rotulo: "Transferência HUB SP", eta: "Hoje, 22:30", obs: "Cross-docking Ativo", local: "HUB SP-01 • Cross-docking" },
    { cte: "893970", nf: "049.162", cidade: "Joinville", uf: "SC", mod: "Fracionada B2B", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 17:10", hoje: true, obs: "Motorista: Carlos E.", local: "Distrito Industrial • Joinville" },
    { cte: "893910", nf: "049.140", cidade: "Caxias do Sul", uf: "RS", mod: "Carga Pesada", status: "transito", rotulo: "Em Trânsito BR-116", eta: "Amanhã, 14:00", obs: "Sem retenções", local: "BR-116 KM 84 • Campina Grande do Sul (PR)" },
    { cte: "893892", nf: "049.133", cidade: "Florianópolis", uf: "SC", mod: "Express 24h", status: "transito", rotulo: "Em Trânsito BR-101", eta: "Hoje, 19:20", hoje: true, obs: "Pedágio Palhoça OK", local: "BR-101 KM 216 • Palhoça (SC)" },
    { cte: "893877", nf: "049.127", cidade: "Ribeirão Preto", uf: "SP", mod: "Fracionada B2B", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 16:05", hoje: true, obs: "Motorista: Ana P.", local: "Av. Pres. Vargas • Ribeirão Preto" },
    { cte: "893861", nf: "049.120", cidade: "Londrina", uf: "PR", mod: "Lotação Fechada", status: "transito", rotulo: "Em Trânsito BR-369", eta: "Amanhã, 08:30", obs: "Sem retenções", local: "BR-369 KM 140 • Ourinhos (SP)" },
    { cte: "893850", nf: "049.114", cidade: "Rio de Janeiro", uf: "RJ", mod: "Express 24h", status: "hub", rotulo: "Transferência HUB RJ", eta: "Amanhã, 10:15", obs: "Cross-docking Ativo", local: "HUB RJ-02 • Cross-docking" },
    { cte: "893842", nf: "049.109", cidade: "Uberlândia", uf: "MG", mod: "Carga Pesada", status: "transito", rotulo: "Em Trânsito BR-050", eta: "Amanhã, 16:40", obs: "Escolta liberada", local: "BR-050 KM 32 • Delta (MG)" },
    { cte: "893831", nf: "049.101", cidade: "Blumenau", uf: "SC", mod: "Fracionada B2B", status: "transito", rotulo: "Em Trânsito BR-470", eta: "Amanhã, 11:20", obs: "Sem retenções", local: "BR-470 KM 18 • Navegantes (SC)" },
    { cte: "893825", nf: "049.098", cidade: "São José dos Campos", uf: "SP", mod: "Express 24h", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 14:50", hoje: true, obs: "Motorista: Rafael T.", local: "Via Dutra KM 147 • São José dos Campos" },
    { cte: "893818", nf: "049.092", cidade: "Maringá", uf: "PR", mod: "Fracionada B2B", status: "coleta", rotulo: "Aguardando Coleta", eta: "Amanhã, 18:00", obs: "Janela 13:00–15:00", local: "Planta Ind. ABC • Campinas (SP)" },
    { cte: "893806", nf: "049.087", cidade: "Pelotas", uf: "RS", mod: "Lotação Fechada", status: "transito", rotulo: "Em Trânsito BR-116", eta: "Em 2 dias, 09:30", obs: "Sem retenções", local: "BR-116 KM 230 • Mafra (SC)" },
    { cte: "893799", nf: "049.081", cidade: "Juiz de Fora", uf: "MG", mod: "Fracionada B2B", status: "hub", rotulo: "Transferência HUB SP", eta: "Amanhã, 20:10", obs: "Cross-docking Ativo", local: "HUB SP-01 • Cross-docking" },
    { cte: "893785", nf: "049.074", cidade: "Chapecó", uf: "SC", mod: "Carga Pesada", status: "transito", rotulo: "Em Trânsito BR-282", eta: "Em 2 dias, 13:00", obs: "Balança Lages OK", local: "BR-282 KM 221 • Lages (SC)" },
    { cte: "893771", nf: "049.066", cidade: "Santos", uf: "SP", mod: "Express 24h", status: "entrega", rotulo: "Saiu p/ Entrega", eta: "Hoje, 18:25", hoje: true, obs: "Motorista: Diego M.", local: "Av. Portuária • Santos" },
    { cte: "893760", nf: "049.059", cidade: "Ponta Grossa", uf: "PR", mod: "Fracionada B2B", status: "transito", rotulo: "Em Trânsito BR-376", eta: "Amanhã, 12:45", obs: "Sem retenções", local: "BR-376 KM 503 • Tibagi (PR)" },
  ];

  /* ---------- Gestão de Envios, Cargas e Comprovantes (portal-manifestos.html) ----------
     status: entregue | transito | ocorrencia | coleta
     modTipo: lotacao | fracionada | expresso      pod: comprovante de entrega (só entregues)
     eta/obs/local/hub: usados também pela página de rastreio */
  const TOTAIS = { envios: 247, novos: 18, emRota: 38, entregas: 204, pctPod: "98.6%", ocorrencias: 5 };

  const CARGAS = [
    {
      cte: "0089241", serie: "Série 1", chave: "5224 0419 8831 0029", nf: "457891", vols: 48, kg: 1420,
      dest: "Distribuidora Sulmetais Ltda", cidade: "Curitiba", uf: "PR", bairro: "Polo CIC", pedido: "#ORD-99120-PR",
      despacho: "18 Mai 2024", despachoHora: "06:40 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "entregue", rotulo: "Entregue c/ POD",
      prev: "19 Mai 2024", prevNota: "Entregue 14:28", eta: "Entregue em 19/05, 14:28", obs: "Comprovante digital (POD) autenticado", local: "Polo CIC • Doca 03",
      pod: { recebedor: "Marcos Vinícius de Abreu", doc: "28.199.304-X", carimbo: "19/05/2024 às 14:28:11", lat: -25.502941, lng: -49.32481, raio: 4, local: "Curitiba / PR • Polo CIC - Doca 03", registro: "#VL-772910", entregador: "Roberto Silva", conferente: "Carlos Mendes" },
    },
    {
      cte: "0089304", serie: "Série 1", chave: "3524 0511 7720 0019", nf: "458012", vols: 120, kg: 4890,
      dest: "Eletromecânica Joinville S.A.", cidade: "Joinville", uf: "SC", bairro: "Distrito Industrial", pedido: "#ORD-99155-SC",
      despacho: "19 Mai 2024", despachoHora: "19:15 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Carga Fracionada", modTipo: "fracionada", status: "transito", rotulo: "Em Trânsito (BR-101)",
      prev: "Hoje, 17:40", prevNota: "Previsão de chegada", eta: "Hoje, 17:40", obs: "Posto Fiscal Garuva OK", local: "BR-101 KM 34 • Garuva (SC)",
    },
    {
      cte: "0089115", serie: "Série 2", chave: "4124 0519 2200 4821", nf: "457640", vols: 14, kg: 620,
      dest: "Montagens Industriais Rio Preto", cidade: "S. José do Rio Preto", uf: "SP", bairro: "Distrito Industrial", pedido: "#ORD-98842-RP",
      despacho: "17 Mai 2024", despachoHora: "10:00 (Hub Campinas)", hub: "Hub Campinas",
      mod: "Expresso Rodoviário", modTipo: "expresso", status: "ocorrencia", rotulo: "Doca Fechada (Reentrega)",
      prev: "Reentrega amanhã", prevNota: "1ª tentativa 18 Mai", eta: "Reentrega amanhã", obs: "Doca fechada na 1ª tentativa (18 Mai)", local: "Base Rio Preto • Doca 2",
    },
    {
      cte: "0088990", serie: "Série 1", chave: "3524 0501 9912 3445", nf: "456988", vols: 320, kg: 8100,
      dest: "Usimetal S/A Mineração", cidade: "Belo Horizonte", uf: "MG", bairro: "Hub Contagem", pedido: "#ORD-97551-MG",
      despacho: "15 Mai 2024", despachoHora: "21:00 (Hub Paulínia)", hub: "Hub Paulínia",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "entregue", rotulo: "Entregue c/ POD",
      prev: "17 Mai 2024", prevNota: "Entregue 09:12", eta: "Entregue em 17/05, 09:12", obs: "Comprovante digital (POD) autenticado", local: "CD Usimetal • Doca 07",
      pod: { recebedor: "Juliana Costa Ramos", doc: "MG-14.552.870", carimbo: "17/05/2024 às 09:12:47", lat: -19.9317, lng: -44.0536, raio: 6, local: "Contagem / MG • CD Usimetal - Doca 07", registro: "#VL-771844", entregador: "Anderson Lima", conferente: "Juliana Ramos" },
    },
    {
      cte: "0089332", serie: "Minuta", chave: "3524 0520 9011 8832", nf: "458105", vols: 60, kg: 2100,
      dest: "TecnoSteel Equipamentos Brasil", cidade: "Porto Alegre", uf: "RS", bairro: "4º Distrito", pedido: "#ORD-99210-RS",
      despacho: "Hoje", despachoHora: "Janela das 14h às 18h", hub: "Hub SP-01",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "coleta", rotulo: "Aguardando Coleta",
      prev: "23 Mai 2024", prevNota: "SLA 72h", eta: "23 Mai 2024", obs: "Janela de coleta 14h–18h", local: "Planta Ind. ABC • Campinas (SP)",
    },
    {
      cte: "0089287", serie: "Série 1", chave: "3524 0510 4410 7765", nf: "457902", vols: 36, kg: 940,
      dest: "Agro Peças Londrina Ltda", cidade: "Londrina", uf: "PR", bairro: "Gleba Palhano", pedido: "#ORD-99133-PR",
      despacho: "18 Mai 2024", despachoHora: "14:10 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Carga Fracionada", modTipo: "fracionada", status: "entregue", rotulo: "Entregue c/ POD",
      prev: "20 Mai 2024", prevNota: "Entregue 10:05", eta: "Entregue em 20/05, 10:05", obs: "Comprovante digital (POD) autenticado", local: "Gleba Palhano • Portaria 1",
      pod: { recebedor: "Paulo Henrique Duarte", doc: "34.118.902-7", carimbo: "20/05/2024 às 10:05:33", lat: -23.3045, lng: -51.1696, raio: 5, local: "Londrina / PR • Gleba Palhano - Portaria 1", registro: "#VL-772233", entregador: "Marcelo Souza", conferente: "Paulo Duarte" },
    },
    {
      cte: "0089298", serie: "Série 1", chave: "3524 0512 6620 1180", nf: "457955", vols: 210, kg: 6350,
      dest: "Vale Sul Laminados S.A.", cidade: "Caxias do Sul", uf: "RS", bairro: "Distrito Industrial", pedido: "#ORD-99148-RS",
      despacho: "19 Mai 2024", despachoHora: "08:30 (Hub Paulínia)", hub: "Hub Paulínia",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "transito", rotulo: "Em Trânsito (BR-116)",
      prev: "Amanhã, 11:00", prevNota: "Previsão de chegada", eta: "Amanhã, 11:00", obs: "Sem retenções", local: "BR-116 KM 84 • Campina Grande do Sul (PR)",
    },
    {
      cte: "0089250", serie: "Série 1", chave: "3524 0509 1180 2241", nf: "457866", vols: 22, kg: 410,
      dest: "Hidráulica Floripa Comércio", cidade: "Florianópolis", uf: "SC", bairro: "Saco Grande", pedido: "#ORD-99126-SC",
      despacho: "18 Mai 2024", despachoHora: "11:45 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Expresso Rodoviário", modTipo: "expresso", status: "entregue", rotulo: "Entregue c/ POD",
      prev: "19 Mai 2024", prevNota: "Entregue 16:52", eta: "Entregue em 19/05, 16:52", obs: "Comprovante digital (POD) autenticado", local: "Saco Grande • Recebimento",
      pod: { recebedor: "Fernanda Lopes Martins", doc: "6.552.019", carimbo: "19/05/2024 às 16:52:08", lat: -27.5536, lng: -48.4981, raio: 3, local: "Florianópolis / SC • Saco Grande - Recebimento", registro: "#VL-772871", entregador: "Thiago Ramos", conferente: "Fernanda Martins" },
    },
    {
      cte: "0089266", serie: "Série 2", chave: "4124 0511 3307 9954", nf: "457881", vols: 8, kg: 180,
      dest: "Ortomed Distribuidora", cidade: "Maringá", uf: "PR", bairro: "Zona 7", pedido: "#ORD-99131-PR",
      despacho: "18 Mai 2024", despachoHora: "16:20 (Hub Campinas)", hub: "Hub Campinas",
      mod: "Expresso Rodoviário", modTipo: "expresso", status: "ocorrencia", rotulo: "Destinatário Ausente",
      prev: "Reentrega amanhã", prevNota: "Agendada c/ cliente", eta: "Reentrega amanhã", obs: "Destinatário ausente na 1ª tentativa", local: "Base Maringá • Doca 1",
    },
    {
      cte: "0089319", serie: "Série 1", chave: "3524 0518 8890 4410", nf: "458077", vols: 75, kg: 2980,
      dest: "Metalúrgica Paraná Aços", cidade: "Ponta Grossa", uf: "PR", bairro: "Distrito Industrial", pedido: "#ORD-99188-PR",
      despacho: "20 Mai 2024", despachoHora: "07:15 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Carga Fracionada", modTipo: "fracionada", status: "transito", rotulo: "Em Trânsito (BR-376)",
      prev: "Hoje, 19:30", prevNota: "Previsão de chegada", eta: "Hoje, 19:30", obs: "Sem retenções", local: "BR-376 KM 503 • Tibagi (PR)",
    },
    {
      cte: "0089201", serie: "Série 1", chave: "3524 0505 7712 0036", nf: "457712", vols: 140, kg: 5220,
      dest: "Construtora Atlântica S.A.", cidade: "Santos", uf: "SP", bairro: "Alemoa", pedido: "#ORD-99098-SP",
      despacho: "17 Mai 2024", despachoHora: "05:50 (Hub SP-01)", hub: "Hub SP-01",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "entregue", rotulo: "Entregue c/ POD",
      prev: "17 Mai 2024", prevNota: "Entregue 15:40", eta: "Entregue em 17/05, 15:40", obs: "Comprovante digital (POD) autenticado", local: "Alemoa • Pátio 4",
      pod: { recebedor: "Ricardo Almeida Prado", doc: "41.220.775-2", carimbo: "17/05/2024 às 15:40:19", lat: -23.9318, lng: -46.3505, raio: 8, local: "Santos / SP • Alemoa - Pátio 4", registro: "#VL-771992", entregador: "Diego Moraes", conferente: "Ricardo Prado" },
    },
    {
      cte: "0089340", serie: "Minuta", chave: "3524 0521 2219 6604", nf: "458130", vols: 18, kg: 540,
      dest: "Química Fina Paulínia", cidade: "Paulínia", uf: "SP", bairro: "Polo Petroquímico", pedido: "#ORD-99230-SP",
      despacho: "Hoje", despachoHora: "Janela das 9h às 12h", hub: "Hub Campinas",
      mod: "Carga Fracionada", modTipo: "fracionada", status: "coleta", rotulo: "Aguardando Coleta",
      prev: "22 Mai 2024", prevNota: "SLA 48h", eta: "22 Mai 2024", obs: "Janela de coleta 9h–12h", local: "Planta Ind. ABC • Campinas (SP)",
    },
    {
      // viagem longa com várias ocorrências — mostra o histórico em rolagem (rastreio)
      cte: "0089377", serie: "Série 1", chave: "3524 0522 4471 9908", nf: "458201", vols: 96, kg: 7340,
      dest: "Norte Atacadista de Ferragens", cidade: "Belém", uf: "PA", bairro: "Distrito de Icoaraci", pedido: "#ORD-99251-PA",
      despacho: "14 Mai 2024", despachoHora: "22:10 (Hub Paulínia)", hub: "Hub Paulínia",
      mod: "Lotação Dedicada", modTipo: "lotacao", status: "ocorrencia", rotulo: "Recebimento Fechado",
      prev: "Reentrega 23 Mai", prevNota: "3ª tentativa agendada", eta: "Reentrega 23 Mai, 08:00",
      obs: "Recebimento fechado na 2ª tentativa", local: "Base Belém • Doca 5",
      // histórico próprio (mais recente primeiro). tipo "ocorrencia" = ícone de alerta
      eventos: [
        { titulo: "Ocorrência: Recebimento fechado (2ª tentativa)", local: "Base Belém • Doca 5 (PA)", texto: "Portaria informou expediente encerrado. 3ª tentativa agendada com o cliente para 23/05 às 08:00.", quando: "22/05 17:40", tipo: "ocorrencia" },
        { titulo: "Saiu para entrega (2ª tentativa)", local: "Base Belém (PA)", texto: "Carga roteirizada com prioridade e motorista dedicado.", quando: "22/05 13:15" },
        { titulo: "Ocorrência: Divergência de endereço na NF-e", local: "Distrito de Icoaraci • Belém (PA)", texto: "Número do galpão divergente na NF-e. Endereço correto confirmado com o cliente por telefone.", quando: "21/05 16:05", tipo: "ocorrencia" },
        { titulo: "Saiu para entrega (1ª tentativa)", local: "Base Belém (PA)", texto: "Motorista: Jefferson A. • Placa QTA-4G21.", quando: "21/05 09:30" },
        { titulo: "Chegada à base de destino", local: "Belém (PA)", texto: "Carga conferida, sem avarias, e roteirizada para a entrega final.", quando: "20/05 22:48" },
        { titulo: "Ocorrência: Retenção na barreira fiscal", local: "Posto Fiscal de Imperatriz (MA)", texto: "Conferência documental da SEFAZ-MA. Carga liberada após 3h40 sem pendências.", quando: "19/05 14:20", tipo: "ocorrencia" },
        { titulo: "Em trânsito", local: "BR-010 KM 1.256 • Imperatriz (MA)", texto: "Telemetria normal, velocidade média de 72 km/h.", quando: "19/05 06:10" },
        { titulo: "Ocorrência: Desvio por obras na pista", local: "BR-153 KM 412 • Uruaçu (GO)", texto: "Pista interditada pelo DNIT. Rota alternativa autorizada pela torre de controle (+46 km).", quando: "18/05 11:35", tipo: "ocorrencia" },
        { titulo: "Parada obrigatória de descanso", local: "Anápolis (GO)", texto: "Descanso do motorista conforme a Lei 13.103 (11h). Carga monitorada no pátio.", quando: "17/05 21:00" },
        { titulo: "Em trânsito", local: "BR-050 KM 32 • Delta (MG)", texto: "Sem retenções. Telemetria e sensores de baú normais.", quando: "17/05 08:45" },
        { titulo: "Saída do centro de distribuição", local: "Paulínia (Hub Paulínia)", texto: "Carga lacrada (lacre nº 448210) e liberada para a viagem.", quando: "15/05 05:30" },
        { titulo: "Carga recebida no hub", local: "Paulínia (Hub Paulínia)", texto: "Conferência de peso e cubagem finalizada no centro de distribuição.", quando: "14/05 23:15" },
        { titulo: "Coleta realizada", local: "Ind. ABC • Paulínia • SP", texto: "Mercadoria da NF 458201 coletada e integrada à operação.", quando: "14/05 18:40" },
      ],
    },
  ];

  // aceita o código de rastreio "VLZ-894012-SP" e também "CTE-894012" ou só "894012"
  // (procura nas duas listas: monitoramento e gestão)
  function buscar(texto) {
    const numero = String(texto || "").replace(/\D/g, "");
    if (!numero) return null;
    return (
      LISTA.find((m) => m.cte === numero) ||
      CARGAS.find((m) => m.cte === numero) ||
      null
    );
  }

  window.VelozManifestos = Object.freeze({
    lista: LISTA,
    cargas: CARGAS,
    totais: TOTAIS,
    buscar,
    codigo,
    origem,
    situacao,
  });
})();
