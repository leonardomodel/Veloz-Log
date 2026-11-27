/* VelozLog — manifestos do Portal B2B (dados de DEMONSTRAÇÃO, fonte única)
   Usado pelo portal (portal.js: tabela "Monitoramento em Tempo Real") e pelo
   rastreio (rastreio.js: página do pedido em /rastreio.html?codigo=CTE-894012).
   Quando houver API, troque esta lista pela resposta do servidor.

   status: entrega | transito | hub | coleta
   hoje:   ETA de hoje (fica laranja no portal)
   local:  onde a carga está agora (linha "Telemetria em tempo real" do rastreio) */
(() => {
  "use strict";

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

  // aceita "CTE-894012", "cte894012" ou só "894012"
  function buscar(codigo) {
    const numero = String(codigo || "").replace(/\D/g, "");
    return LISTA.find((m) => m.cte === numero) || null;
  }

  window.VelozManifestos = Object.freeze({ lista: LISTA, buscar });
})();
