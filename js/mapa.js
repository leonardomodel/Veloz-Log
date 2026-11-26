/* VelozLog — mapa da rota (frete.html)
   Atualiza sozinho quando o cliente muda origem/destino no modal, sempre com a rota MAIS CURTA em laranja.

   • SEM chave: usa mapa real do OpenStreetMap (Leaflet) em tons de cinza, sem custo e sem cadastro.
   • COM chave do Google Maps: usa o Google Maps (mesmo visual cinza).
   • Se tudo falhar: fica o desenho simples (SVG) que já está no HTML.

   PARA USAR O GOOGLE:
   1) No Google Cloud, crie uma chave e ative: Maps JavaScript API, Routes API e Geocoding API.
   2) Restrinja a chave a "Sites (HTTP referrers)" com o domínio do site (e http://127.0.0.1:5500/* para testes).
   3) Cole a chave abaixo. */
(() => {
  "use strict";

  const CHAVE_CONFIGURADA = ""; // ← cole aqui a chave da API do Google Maps
  const CHAVE = window.VELOZ_MAPS_KEY || CHAVE_CONFIGURADA;

  const LARANJA = "#f26a1b";
  const AZUL = "#0e2a5c";

  // TRÂNSITO EM TEMPO REAL (opcional): chave gratuita da TomTom (developer.tomtom.com, sem cartão).
  // Sem chave, "Condições da Rota" usa o clima ao longo do trajeto (Open-Meteo, grátis).
  const CHAVE_TRANSITO_CONFIGURADA = "";
  const CHAVE_TRANSITO = window.VELOZ_TRAFFIC_KEY || CHAVE_TRANSITO_CONFIGURADA;

  // Mapa do Google com todos os detalhes (estradas, cidades, nomes), só que em tons de cinza.
  // O único elemento colorido é a rota, desenhada por cima em laranja.
  const ESTILO = [
    { stylers: [{ saturation: -100 }, { lightness: 6 }] }, // tira toda a cor do mapa
    { featureType: "poi", stylers: [{ visibility: "off" }] }, // sem ícones de lugares
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "landscape", stylers: [{ lightness: 14 }] },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ lightness: 8 }],
    },
  ];

  const $ = (s, r = document) => r.querySelector(s);
  let carregando = null; // promessa do script do Google
  let falhou = false; // chave inválida / faturamento / bloqueio
  let mapa = null;
  let camadas = []; // polylines e pinos desenhados
  let numeroPedido = 0; // ignora respostas antigas
  let ultimoPar = null; // última origem/destino pedida
  let mapaOsm = null;
  let camadasOsm = [];
  let carregandoLeaflet = null;

  const ll = (p) => ({
    lat: typeof p.lat === "function" ? p.lat() : p.lat,
    lng: typeof p.lng === "function" ? p.lng() : p.lng,
  });

  /* ---------- carregamento do script ---------- */
  function carregarGoogle() {
    if (!CHAVE) return Promise.reject(new Error("sem chave configurada"));
    if (falhou) return Promise.reject(new Error("chave recusada pelo Google"));
    if (window.google && window.google.maps && window.google.maps.importLibrary)
      return Promise.resolve();
    if (!carregando) {
      carregando = new Promise((ok, erro) => {
        window.__velozMapsPronto = ok;
        window.gm_authFailure = () => {
          falhou = true;
          console.warn(
            "[VelozLog] O Google recusou a chave (confira chave, APIs ativadas, faturamento e restrições de domínio).",
          );
          erro(new Error("chave recusada pelo Google"));
          const g = $("#mapa-google");
          if (g) g.classList.remove("pronto");
          if (ultimoPar) atualizar(ultimoPar.origem, ultimoPar.destino); // refaz no mapa aberto
        };
        const s = document.createElement("script");
        s.src =
          "https://maps.googleapis.com/maps/api/js?key=" +
          encodeURIComponent(CHAVE) +
          "&v=weekly&loading=async&language=pt-BR&region=BR&callback=__velozMapsPronto";
        s.async = true;
        s.onerror = () =>
          erro(new Error("não foi possível carregar o script do Google Maps"));
        document.head.appendChild(s);
      });
    }
    return carregando;
  }

  /* ---------- tela ---------- */
  function mostrarMapaSimples() {
    const area = $(".fr-mapa-area");
    if (area) area.classList.remove("tem-google");
    ["#mapa-google", "#mapa-osm"].forEach((id) => {
      const el = $(id);
      if (el) el.classList.remove("pronto");
    });
  }

  function limparCamadas() {
    camadas.forEach((c) => c.setMap(null));
    camadas = [];
  }

  function criarPino(gm, posicao, texto, cor) {
    class Pino extends gm.OverlayView {
      onAdd() {
        this.el = document.createElement("div");
        this.el.className = "fr-pino";
        this.el.style.setProperty("--cor", cor);
        const bolinha = document.createElement("i");
        const rotulo = document.createElement("span");
        rotulo.textContent = texto;
        this.el.append(bolinha, rotulo);
        this.getPanes().overlayLayer.appendChild(this.el);
      }
      draw() {
        const p = this.getProjection().fromLatLngToDivPixel(
          new gm.LatLng(posicao),
        );
        if (p && this.el) {
          this.el.style.left = p.x + "px";
          this.el.style.top = p.y + "px";
        }
      }
      onRemove() {
        if (this.el) this.el.remove();
        this.el = null;
      }
    }
    return new Pino();
  }

  const haversineKm = (a, b) => {
    const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r;
    const dLng = (b.lng - a.lng) * r;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };
  const duracao = (ms) => {
    const min = Math.round(ms / 60000);
    const h = Math.floor(min / 60);
    return h ? `${h}h${String(min % 60).padStart(2, "0")}` : `${min} min`;
  };
  const texto = (sel, valor) => {
    const el = $(sel);
    if (el) el.textContent = valor;
  };

  /* ---------- condições da rota (clima + trânsito) ---------- */
  const NIVEIS = ["normal", "atencao", "critico"];
  const ROTULO = { normal: "Normal", atencao: "Atenção", critico: "Crítica" };

  function mostrarCondicao(nivel, detalhes) {
    const el = $(".fr-mapa-clima");
    if (!el) return;
    NIVEIS.forEach((n) => el.classList.toggle("nv-" + n, n === nivel));
    el.textContent =
      "Condições da Rota: " +
      ROTULO[nivel] +
      (detalhes.length ? " · " + detalhes[0] : "");
    el.title = detalhes.length
      ? detalhes.join("\n")
      : "Sem ocorrências no trajeto";
  }

  // classifica o tempo em um ponto da rota
  function nivelClima(c) {
    const cod = c.weather_code;
    const chuva = c.precipitation || 0;
    const rajada = c.wind_gusts_10m || 0;
    const vis = c.visibility == null ? 99999 : c.visibility;
    if (
      [65, 67, 82, 95, 96, 99].includes(cod) ||
      chuva >= 7.5 ||
      rajada >= 80 ||
      vis < 200
    )
      return {
        n: 2,
        txt:
          cod >= 95
            ? "tempestade no trajeto"
            : vis < 200
              ? "neblina intensa"
              : rajada >= 80
                ? "ventos fortes"
                : "chuva forte no trajeto",
      };
    if ([45, 48].includes(cod) || vis < 1000)
      return { n: 1, txt: "neblina no trajeto" };
    if ([51, 53, 55, 56, 57, 61, 63, 66, 80, 81].includes(cod) || chuva >= 2.5)
      return { n: 1, txt: "chuva no trajeto" };
    if (rajada >= 60) return { n: 1, txt: "rajadas de vento" };
    return { n: 0, txt: "" };
  }

  async function climaDaRota(caminho) {
    const idx = [0, 0.25, 0.5, 0.75, 1].map((f) =>
      Math.min(caminho.length - 1, Math.round(f * (caminho.length - 1))),
    );
    const pts = idx.map((i) => caminho[i]);
    const url =
      "https://api.open-meteo.com/v1/forecast?current=precipitation,weather_code,visibility,wind_gusts_10m&timezone=auto" +
      "&latitude=" +
      pts.map((p) => p.lat.toFixed(3)).join(",") +
      "&longitude=" +
      pts.map((p) => p.lng.toFixed(3)).join(",");
    const r = await fetch(url);
    if (!r.ok) throw new Error("clima indisponível");
    const dados = await r.json();
    const lista = Array.isArray(dados) ? dados : [dados];
    return lista
      .map((d) => nivelClima(d.current || {}))
      .reduce((a, b) => (b.n > a.n ? b : a), { n: 0, txt: "" });
  }

  // trânsito: compara o tempo com e sem trânsito (TomTom)
  async function transitoDaRota(pO, pD) {
    const url =
      `https://api.tomtom.com/routing/1/calculateRoute/${pO.lat},${pO.lng}:${pD.lat},${pD.lng}/json` +
      `?key=${encodeURIComponent(CHAVE_TRANSITO)}&traffic=true&computeTravelTimeFor=all&routeType=shortest`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("trânsito indisponível");
    const s = ((await r.json()).routes || [])[0].summary;
    const atraso = Math.round((s.trafficDelayInSeconds || 0) / 60);
    const base = (s.noTrafficTravelTimeInSeconds || s.travelTimeInSeconds) / 60;
    const pct = base ? atraso / base : 0;
    if (atraso >= 45 || pct >= 0.25)
      return { n: 2, txt: `trânsito intenso (+${atraso} min)` };
    if (atraso >= 15 || pct >= 0.1)
      return { n: 1, txt: `trânsito lento (+${atraso} min)` };
    return { n: 0, txt: "" };
  }

  async function carregarCondicoes(caminho, pedido) {
    mostrarCondicao("normal", []);
    const el = $(".fr-mapa-clima");
    if (el) el.textContent = "Verificando condições da rota…";
    const pO = caminho[0];
    const pD = caminho[caminho.length - 1];
    const tarefas = [climaDaRota(caminho)];
    if (CHAVE_TRANSITO) tarefas.push(transitoDaRota(pO, pD));
    const resultados = (await Promise.allSettled(tarefas))
      .filter((x) => x.status === "fulfilled")
      .map((x) => x.value);
    if (pedido !== numeroPedido) return;
    if (!resultados.length) {
      if (el) {
        NIVEIS.forEach((n) => el.classList.remove("nv-" + n));
        el.textContent = "Condições da Rota: indisponível";
      }
      return;
    }
    const pior = Math.max(...resultados.map((x) => x.n));
    const detalhes = resultados
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((x) => x.txt);
    mostrarCondicao(NIVEIS[pior], detalhes);
  }

  /* ---------- textos de distância ---------- */
  function aplicarTextos({ km, descricao, tempo, linhaReta }) {
    texto(
      "#r-distancia",
      `${km.toLocaleString("pt-BR")} km${descricao ? " via " + descricao : ""}`,
    );
    const sub = $(".fr-mapa-sub");
    if (sub) {
      const partes = [];
      if (!linhaReta && descricao) partes.push(`Rota via ${descricao}`);
      if (linhaReta)
        partes.push("Distância em linha reta (rota rodoviária indisponível)");
      if (tempo) partes.push(`tempo de condução estimado: ${tempo}`);
      sub.textContent = partes.join(" · ");
      sub.style.display = partes.length ? "" : "none";
    }
  }

  /* ---------- Google Maps ---------- */
  async function atualizarGoogle(origem, destino, pedido) {
    await carregarGoogle();
    const gm = window.google.maps;
    const [{ Map, Polyline }, { LatLngBounds }, { Geocoder }] =
      await Promise.all([
        gm.importLibrary("maps"),
        gm.importLibrary("core"),
        gm.importLibrary("geocoding"),
      ]);
    let Route = null;
    try {
      ({ Route } = await gm.importLibrary("routes"));
    } catch (e) {
      console.warn("[VelozLog] Routes API indisponível; usando linha reta.", e);
    }

    // 1) CEP → coordenadas
    const geo = new Geocoder();
    const buscar = async (p) => {
      const lugar = [p.cep, p.cidade && `${p.cidade} - ${p.uf}`, "Brasil"]
        .filter(Boolean)
        .join(", ");
      const { results } = await geo.geocode({ address: lugar, region: "BR" });
      if (!results || !results.length)
        throw new Error("endereço não encontrado: " + lugar);
      return ll(results[0].geometry.location);
    };
    const [pO, pD] = await Promise.all([buscar(origem), buscar(destino)]);
    if (pedido !== numeroPedido) return;

    // 2) rota por rodovia (ou linha reta se a Routes API falhar)
    let caminho = [pO, pD];
    let km = Math.round(haversineKm(pO, pD));
    let descricao = "";
    let tempo = "";
    let linhaReta = true;
    if (Route) {
      try {
        // pede as alternativas ao Google e fica só com a mais curta (em km)
        const tentativas = [
          {
            fields: ["path", "distanceMeters", "durationMillis", "description"],
            computeAlternativeRoutes: true,
          },
          {
            fields: ["path", "distanceMeters", "durationMillis"],
            computeAlternativeRoutes: true,
          },
          { fields: ["path", "distanceMeters", "durationMillis"] },
        ];
        let rotas = [];
        let ultimoErro = null;
        for (const extra of tentativas) {
          try {
            const resp = await Route.computeRoutes({
              origin: pO,
              destination: pD,
              travelMode: "DRIVING",
              ...extra,
            });
            rotas = (resp.routes || []).filter((r) => r.path && r.path.length);
            if (rotas.length) break;
          } catch (e) {
            ultimoErro = e;
          }
        }
        if (!rotas.length)
          throw ultimoErro || new Error("o Google não devolveu rotas");
        const rota = rotas.reduce((a, b) =>
          b.distanceMeters < a.distanceMeters ? b : a,
        );
        caminho = rota.path.map(ll);
        km = Math.round(rota.distanceMeters / 1000);
        descricao = rota.description || "";
        tempo = rota.durationMillis ? duracao(rota.durationMillis) : "";
        linhaReta = false;
      } catch (e) {
        console.warn(
          "[VelozLog] Não foi possível traçar a rota (ative a Routes API). Mostrando linha reta.",
          e,
        );
      }
    }
    if (pedido !== numeroPedido) return;

    // 3) desenha
    const area = $(".fr-mapa-area");
    const caixa = $("#mapa-google");
    if (!area || !caixa) return;
    area.classList.add("tem-google");
    if (!mapa) {
      mapa = new Map(caixa, {
        center: pO,
        zoom: 6,
        styles: ESTILO,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
        backgroundColor: "#e5e7ea",
      });
    }
    limparCamadas();
    const base = new Polyline({
      path: caminho,
      strokeColor: "#ffffff",
      strokeOpacity: 1,
      strokeWeight: 9,
      zIndex: 1,
      map: mapa,
      geodesic: linhaReta,
    });
    const linha = new Polyline({
      path: caminho,
      strokeColor: LARANJA,
      strokeOpacity: 1,
      strokeWeight: 5,
      zIndex: 2,
      map: mapa,
      geodesic: linhaReta,
    });
    const pinoO = criarPino(gm, pO, origem.cidade || "Origem", AZUL);
    const pinoD = criarPino(gm, pD, destino.cidade || "Destino", LARANJA);
    pinoO.setMap(mapa);
    pinoD.setMap(mapa);
    camadas = [base, linha, pinoO, pinoD];

    const limites = new LatLngBounds();
    caminho.forEach((p) => limites.extend(p));
    mapa.fitBounds(limites, 48);
    caixa.classList.add("pronto");
    if (pedido !== numeroPedido) return;
    const osm = $("#mapa-osm");
    if (osm) osm.classList.remove("pronto");
    aplicarTextos({ km, descricao, tempo, linhaReta });
    carregarCondicoes(caminho, pedido);
  }

  /* ---------- OpenStreetMap (Leaflet), sem chave ---------- */
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  function carregarLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (!carregandoLeaflet) {
      carregandoLeaflet = new Promise((ok, erro) => {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = LEAFLET_CSS;
        document.head.appendChild(css);
        const js = document.createElement("script");
        js.src = LEAFLET_JS;
        js.onload = ok;
        js.onerror = () => {
          carregandoLeaflet = null;
          erro(new Error("não foi possível carregar o Leaflet"));
        };
        document.head.appendChild(js);
      });
    }
    return carregandoLeaflet;
  }

  const cacheCoord = new Map();
  async function coordenadas(p) {
    const cep = String(p.cep).replace(/\D/g, "");
    if (cacheCoord.has(cep)) return cacheCoord.get(cep);

    let resultado = null;
    // 1) BrasilAPI: devolve latitude/longitude do CEP quando existe
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      if (r.ok) {
        const c = ((await r.json()).location || {}).coordinates || {};
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng))
          resultado = { lat, lng };
      }
    } catch (e) {
      /* tenta o próximo */
    }
    // 2) centro da cidade (Nominatim / OpenStreetMap)
    if (!resultado && p.cidade) {
      const q = encodeURIComponent(`${p.cidade}, ${p.uf || ""}, Brasil`);
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&accept-language=pt-BR&q=${q}`,
      );
      const lista = r.ok ? await r.json() : [];
      if (lista.length)
        resultado = {
          lat: parseFloat(lista[0].lat),
          lng: parseFloat(lista[0].lon),
        };
    }
    if (!resultado) throw new Error("não achei as coordenadas do CEP " + p.cep);
    cacheCoord.set(cep, resultado);
    return resultado;
  }

  function criarPinoOsm(L, posicao, rotulo, cor) {
    const el = document.createElement("div");
    el.className = "fr-pino";
    el.style.setProperty("--cor", cor);
    const bolinha = document.createElement("i");
    const nome = document.createElement("span");
    nome.textContent = rotulo;
    el.append(bolinha, nome);
    return L.marker([posicao.lat, posicao.lng], {
      icon: L.divIcon({ className: "", html: el, iconSize: [0, 0] }),
      interactive: false,
      keyboard: false,
    });
  }

  async function atualizarOsm(origem, destino, pedido) {
    await carregarLeaflet();
    const L = window.L;
    const [pO, pD] = await Promise.all([
      coordenadas(origem),
      coordenadas(destino),
    ]);
    if (pedido !== numeroPedido) return;

    // rota por rodovia: pede as alternativas ao OSRM e fica com a mais curta
    let caminho = [pO, pD];
    let km = Math.round(haversineKm(pO, pD));
    let tempo = "";
    let linhaReta = true;
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/${pO.lng},${pO.lat};${pD.lng},${pD.lat}` +
        "?overview=full&geometries=geojson&alternatives=true";
      const r = await fetch(url);
      const dados = r.ok ? await r.json() : null;
      const rotas = ((dados && dados.routes) || []).filter(
        (x) => x.geometry && x.geometry.coordinates.length,
      );
      if (rotas.length) {
        const rota = rotas.reduce((a, b) => (b.distance < a.distance ? b : a));
        caminho = rota.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        km = Math.round(rota.distance / 1000);
        tempo = duracao(rota.duration * 1000);
        linhaReta = false;
      }
    } catch (e) {
      console.warn(
        "[VelozLog] Serviço de rotas indisponível; mostrando linha reta.",
        e,
      );
    }
    if (pedido !== numeroPedido) return;

    const area = $(".fr-mapa-area");
    const caixa = $("#mapa-osm");
    if (!area || !caixa) return;
    area.classList.add("tem-google");
    caixa.classList.add("pronto");
    const g = $("#mapa-google");
    if (g) g.classList.remove("pronto");

    if (!mapaOsm) {
      mapaOsm = L.map(caixa, {
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: !L.Browser.mobile,
        tap: false,
        attributionControl: false,
      });
      L.control
        .attribution({ prefix: false, position: "bottomright" })
        .addTo(mapaOsm);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(mapaOsm);
      // zoom com a rodinha sempre ativo enquanto o ponteiro estiver sobre o mapa
    }
    mapaOsm.invalidateSize();
    camadasOsm.forEach((c) => c.remove());

    const pontos = caminho.map((p) => [p.lat, p.lng]);
    const opcoes = { lineCap: "round", lineJoin: "round", interactive: false };
    camadasOsm = [
      L.polyline(pontos, {
        ...opcoes,
        color: "#ffffff",
        weight: 9,
        opacity: 1,
      }).addTo(mapaOsm),
      L.polyline(pontos, {
        ...opcoes,
        color: LARANJA,
        weight: 5,
        opacity: 1,
      }).addTo(mapaOsm),
      criarPinoOsm(L, pO, origem.cidade || "Origem", AZUL).addTo(mapaOsm),
      criarPinoOsm(L, pD, destino.cidade || "Destino", LARANJA).addTo(mapaOsm),
    ];
    mapaOsm.fitBounds(L.latLngBounds(pontos), { padding: [48, 48] });
    aplicarTextos({ km, descricao: "", tempo, linhaReta });
    carregarCondicoes(caminho, pedido);
  }

  /* ---------- principal ---------- */
  async function atualizar(origem, destino) {
    ultimoPar = { origem, destino };
    const pedido = ++numeroPedido;

    if (CHAVE && !falhou) {
      try {
        await atualizarGoogle(origem, destino, pedido);
        return;
      } catch (erro) {
        if (pedido !== numeroPedido) return;
        console.warn(
          "[VelozLog] Google Maps indisponível, usando o mapa do OpenStreetMap:",
          erro && erro.message ? erro.message : erro,
        );
      }
    }
    try {
      await atualizarOsm(origem, destino, pedido);
    } catch (erro) {
      if (pedido !== numeroPedido) return;
      console.warn(
        "[VelozLog] Mapa indisponível, mantendo o desenho simples:",
        erro && erro.message ? erro.message : erro,
      );
      mostrarMapaSimples();
    }
  }

  window.VelozMapa = { atualizar };
})();
/* VelozLog — mapa da rota (frete.html)
   Atualiza sozinho quando o cliente muda origem/destino no modal, sempre com a rota MAIS CURTA em laranja.

   • SEM chave: usa mapa real do OpenStreetMap (Leaflet) em tons de cinza, sem custo e sem cadastro.
   • COM chave do Google Maps: usa o Google Maps (mesmo visual cinza).
   • Se tudo falhar: fica o desenho simples (SVG) que já está no HTML.

   PARA USAR O GOOGLE:
   1) No Google Cloud, crie uma chave e ative: Maps JavaScript API, Routes API e Geocoding API.
   2) Restrinja a chave a "Sites (HTTP referrers)" com o domínio do site (e http://127.0.0.1:5500/* para testes).
   3) Cole a chave abaixo. */
(() => {
  "use strict";

  const CHAVE_CONFIGURADA = ""; // ← cole aqui a chave da API do Google Maps
  const CHAVE = window.VELOZ_MAPS_KEY || CHAVE_CONFIGURADA;

  const LARANJA = "#f26a1b";
  const AZUL = "#0e2a5c";

  // TRÂNSITO EM TEMPO REAL (opcional): chave gratuita da TomTom (developer.tomtom.com, sem cartão).
  // Sem chave, "Condições da Rota" usa o clima ao longo do trajeto (Open-Meteo, grátis).
  const CHAVE_TRANSITO_CONFIGURADA = "";
  const CHAVE_TRANSITO = window.VELOZ_TRAFFIC_KEY || CHAVE_TRANSITO_CONFIGURADA;

  // Mapa do Google com todos os detalhes (estradas, cidades, nomes), só que em tons de cinza.
  // O único elemento colorido é a rota, desenhada por cima em laranja.
  const ESTILO = [
    { stylers: [{ saturation: -100 }, { lightness: 6 }] }, // tira toda a cor do mapa
    { featureType: "poi", stylers: [{ visibility: "off" }] }, // sem ícones de lugares
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "landscape", stylers: [{ lightness: 14 }] },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ lightness: 8 }],
    },
  ];

  const $ = (s, r = document) => r.querySelector(s);
  let carregando = null; // promessa do script do Google
  let falhou = false; // chave inválida / faturamento / bloqueio
  let mapa = null;
  let camadas = []; // polylines e pinos desenhados
  let numeroPedido = 0; // ignora respostas antigas
  let ultimoPar = null; // última origem/destino pedida
  let mapaOsm = null;
  let camadasOsm = [];
  let carregandoLeaflet = null;

  const ll = (p) => ({
    lat: typeof p.lat === "function" ? p.lat() : p.lat,
    lng: typeof p.lng === "function" ? p.lng() : p.lng,
  });

  /* ---------- carregamento do script ---------- */
  function carregarGoogle() {
    if (!CHAVE) return Promise.reject(new Error("sem chave configurada"));
    if (falhou) return Promise.reject(new Error("chave recusada pelo Google"));
    if (window.google && window.google.maps && window.google.maps.importLibrary)
      return Promise.resolve();
    if (!carregando) {
      carregando = new Promise((ok, erro) => {
        window.__velozMapsPronto = ok;
        window.gm_authFailure = () => {
          falhou = true;
          console.warn(
            "[VelozLog] O Google recusou a chave (confira chave, APIs ativadas, faturamento e restrições de domínio).",
          );
          erro(new Error("chave recusada pelo Google"));
          const g = $("#mapa-google");
          if (g) g.classList.remove("pronto");
          if (ultimoPar) atualizar(ultimoPar.origem, ultimoPar.destino); // refaz no mapa aberto
        };
        const s = document.createElement("script");
        s.src =
          "https://maps.googleapis.com/maps/api/js?key=" +
          encodeURIComponent(CHAVE) +
          "&v=weekly&loading=async&language=pt-BR&region=BR&callback=__velozMapsPronto";
        s.async = true;
        s.onerror = () =>
          erro(new Error("não foi possível carregar o script do Google Maps"));
        document.head.appendChild(s);
      });
    }
    return carregando;
  }

  /* ---------- tela ---------- */
  function mostrarMapaSimples() {
    const area = $(".fr-mapa-area");
    if (area) area.classList.remove("tem-google");
    ["#mapa-google", "#mapa-osm"].forEach((id) => {
      const el = $(id);
      if (el) el.classList.remove("pronto");
    });
  }

  function limparCamadas() {
    camadas.forEach((c) => c.setMap(null));
    camadas = [];
  }

  function criarPino(gm, posicao, texto, cor) {
    class Pino extends gm.OverlayView {
      onAdd() {
        this.el = document.createElement("div");
        this.el.className = "fr-pino";
        this.el.style.setProperty("--cor", cor);
        const bolinha = document.createElement("i");
        const rotulo = document.createElement("span");
        rotulo.textContent = texto;
        this.el.append(bolinha, rotulo);
        this.getPanes().overlayLayer.appendChild(this.el);
      }
      draw() {
        const p = this.getProjection().fromLatLngToDivPixel(
          new gm.LatLng(posicao),
        );
        if (p && this.el) {
          this.el.style.left = p.x + "px";
          this.el.style.top = p.y + "px";
        }
      }
      onRemove() {
        if (this.el) this.el.remove();
        this.el = null;
      }
    }
    return new Pino();
  }

  const haversineKm = (a, b) => {
    const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r;
    const dLng = (b.lng - a.lng) * r;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };
  const duracao = (ms) => {
    const min = Math.round(ms / 60000);
    const h = Math.floor(min / 60);
    return h ? `${h}h${String(min % 60).padStart(2, "0")}` : `${min} min`;
  };
  const texto = (sel, valor) => {
    const el = $(sel);
    if (el) el.textContent = valor;
  };

  /* ---------- condições da rota (clima + trânsito) ---------- */
  const NIVEIS = ["normal", "atencao", "critico"];
  const ROTULO = { normal: "Normal", atencao: "Atenção", critico: "Crítica" };

  function mostrarCondicao(nivel, detalhes) {
    const el = $(".fr-mapa-clima");
    if (!el) return;
    NIVEIS.forEach((n) => el.classList.toggle("nv-" + n, n === nivel));
    el.textContent =
      "Condições da Rota: " +
      ROTULO[nivel] +
      (detalhes.length ? " · " + detalhes[0] : "");
    el.title = detalhes.length
      ? detalhes.join("\n")
      : "Sem ocorrências no trajeto";
  }

  // classifica o tempo em um ponto da rota
  function nivelClima(c) {
    const cod = c.weather_code;
    const chuva = c.precipitation || 0;
    const rajada = c.wind_gusts_10m || 0;
    const vis = c.visibility == null ? 99999 : c.visibility;
    if (
      [65, 67, 82, 95, 96, 99].includes(cod) ||
      chuva >= 7.5 ||
      rajada >= 80 ||
      vis < 200
    )
      return {
        n: 2,
        txt:
          cod >= 95
            ? "tempestade no trajeto"
            : vis < 200
              ? "neblina intensa"
              : rajada >= 80
                ? "ventos fortes"
                : "chuva forte no trajeto",
      };
    if ([45, 48].includes(cod) || vis < 1000)
      return { n: 1, txt: "neblina no trajeto" };
    if ([51, 53, 55, 56, 57, 61, 63, 66, 80, 81].includes(cod) || chuva >= 2.5)
      return { n: 1, txt: "chuva no trajeto" };
    if (rajada >= 60) return { n: 1, txt: "rajadas de vento" };
    return { n: 0, txt: "" };
  }

  async function climaDaRota(caminho) {
    const idx = [0, 0.25, 0.5, 0.75, 1].map((f) =>
      Math.min(caminho.length - 1, Math.round(f * (caminho.length - 1))),
    );
    const pts = idx.map((i) => caminho[i]);
    const url =
      "https://api.open-meteo.com/v1/forecast?current=precipitation,weather_code,visibility,wind_gusts_10m&timezone=auto" +
      "&latitude=" +
      pts.map((p) => p.lat.toFixed(3)).join(",") +
      "&longitude=" +
      pts.map((p) => p.lng.toFixed(3)).join(",");
    const r = await fetch(url);
    if (!r.ok) throw new Error("clima indisponível");
    const dados = await r.json();
    const lista = Array.isArray(dados) ? dados : [dados];
    return lista
      .map((d) => nivelClima(d.current || {}))
      .reduce((a, b) => (b.n > a.n ? b : a), { n: 0, txt: "" });
  }

  // trânsito: compara o tempo com e sem trânsito (TomTom)
  async function transitoDaRota(pO, pD) {
    const url =
      `https://api.tomtom.com/routing/1/calculateRoute/${pO.lat},${pO.lng}:${pD.lat},${pD.lng}/json` +
      `?key=${encodeURIComponent(CHAVE_TRANSITO)}&traffic=true&computeTravelTimeFor=all&routeType=shortest`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("trânsito indisponível");
    const s = ((await r.json()).routes || [])[0].summary;
    const atraso = Math.round((s.trafficDelayInSeconds || 0) / 60);
    const base = (s.noTrafficTravelTimeInSeconds || s.travelTimeInSeconds) / 60;
    const pct = base ? atraso / base : 0;
    if (atraso >= 45 || pct >= 0.25)
      return { n: 2, txt: `trânsito intenso (+${atraso} min)` };
    if (atraso >= 15 || pct >= 0.1)
      return { n: 1, txt: `trânsito lento (+${atraso} min)` };
    return { n: 0, txt: "" };
  }

  async function carregarCondicoes(caminho, pedido) {
    mostrarCondicao("normal", []);
    const el = $(".fr-mapa-clima");
    if (el) el.textContent = "Verificando condições da rota…";
    const pO = caminho[0];
    const pD = caminho[caminho.length - 1];
    const tarefas = [climaDaRota(caminho)];
    if (CHAVE_TRANSITO) tarefas.push(transitoDaRota(pO, pD));
    const resultados = (await Promise.allSettled(tarefas))
      .filter((x) => x.status === "fulfilled")
      .map((x) => x.value);
    if (pedido !== numeroPedido) return;
    if (!resultados.length) {
      if (el) {
        NIVEIS.forEach((n) => el.classList.remove("nv-" + n));
        el.textContent = "Condições da Rota: indisponível";
      }
      return;
    }
    const pior = Math.max(...resultados.map((x) => x.n));
    const detalhes = resultados
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .map((x) => x.txt);
    mostrarCondicao(NIVEIS[pior], detalhes);
  }

  /* ---------- textos de distância ---------- */
  function aplicarTextos({ km, descricao, tempo, linhaReta }) {
    texto(
      "#r-distancia",
      `${km.toLocaleString("pt-BR")} km${descricao ? " via " + descricao : ""}`,
    );
    const sub = $(".fr-mapa-sub");
    if (sub) {
      const partes = [
        `Distância ${linhaReta ? "em linha reta" : "da rota"}: ${km.toLocaleString("pt-BR")} km`,
      ];
      if (!linhaReta && descricao) partes.push(`Rota via ${descricao}`);
      if (linhaReta) partes.push("rota rodoviária indisponível");
      if (tempo) partes.push(`tempo de condução estimado: ${tempo}`);
      sub.textContent = partes.join(" · ");
      sub.style.display = partes.length ? "" : "none";
    }
  }

  /* ---------- Google Maps ---------- */
  async function atualizarGoogle(origem, destino, pedido) {
    await carregarGoogle();
    const gm = window.google.maps;
    const [{ Map, Polyline }, { LatLngBounds }, { Geocoder }] =
      await Promise.all([
        gm.importLibrary("maps"),
        gm.importLibrary("core"),
        gm.importLibrary("geocoding"),
      ]);
    let Route = null;
    try {
      ({ Route } = await gm.importLibrary("routes"));
    } catch (e) {
      console.warn("[VelozLog] Routes API indisponível; usando linha reta.", e);
    }

    // 1) CEP → coordenadas
    const geo = new Geocoder();
    const buscar = async (p) => {
      const lugar = [p.cep, p.cidade && `${p.cidade} - ${p.uf}`, "Brasil"]
        .filter(Boolean)
        .join(", ");
      const { results } = await geo.geocode({ address: lugar, region: "BR" });
      if (!results || !results.length)
        throw new Error("endereço não encontrado: " + lugar);
      return ll(results[0].geometry.location);
    };
    const [pO, pD] = await Promise.all([buscar(origem), buscar(destino)]);
    if (pedido !== numeroPedido) return;

    // 2) rota por rodovia (ou linha reta se a Routes API falhar)
    let caminho = [pO, pD];
    let km = Math.round(haversineKm(pO, pD));
    let descricao = "";
    let tempo = "";
    let linhaReta = true;
    if (Route) {
      try {
        // pede as alternativas ao Google e fica só com a mais curta (em km)
        const tentativas = [
          {
            fields: ["path", "distanceMeters", "durationMillis", "description"],
            computeAlternativeRoutes: true,
          },
          {
            fields: ["path", "distanceMeters", "durationMillis"],
            computeAlternativeRoutes: true,
          },
          { fields: ["path", "distanceMeters", "durationMillis"] },
        ];
        let rotas = [];
        let ultimoErro = null;
        for (const extra of tentativas) {
          try {
            const resp = await Route.computeRoutes({
              origin: pO,
              destination: pD,
              travelMode: "DRIVING",
              ...extra,
            });
            rotas = (resp.routes || []).filter((r) => r.path && r.path.length);
            if (rotas.length) break;
          } catch (e) {
            ultimoErro = e;
          }
        }
        if (!rotas.length)
          throw ultimoErro || new Error("o Google não devolveu rotas");
        const rota = rotas.reduce((a, b) =>
          b.distanceMeters < a.distanceMeters ? b : a,
        );
        caminho = rota.path.map(ll);
        km = Math.round(rota.distanceMeters / 1000);
        descricao = rota.description || "";
        tempo = rota.durationMillis ? duracao(rota.durationMillis) : "";
        linhaReta = false;
      } catch (e) {
        console.warn(
          "[VelozLog] Não foi possível traçar a rota (ative a Routes API). Mostrando linha reta.",
          e,
        );
      }
    }
    if (pedido !== numeroPedido) return;

    // 3) desenha
    const area = $(".fr-mapa-area");
    const caixa = $("#mapa-google");
    if (!area || !caixa) return;
    area.classList.add("tem-google");
    if (!mapa) {
      mapa = new Map(caixa, {
        center: pO,
        zoom: 6,
        styles: ESTILO,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
        backgroundColor: "#e5e7ea",
      });
    }
    limparCamadas();
    const base = new Polyline({
      path: caminho,
      strokeColor: "#ffffff",
      strokeOpacity: 1,
      strokeWeight: 9,
      zIndex: 1,
      map: mapa,
      geodesic: linhaReta,
    });
    const linha = new Polyline({
      path: caminho,
      strokeColor: LARANJA,
      strokeOpacity: 1,
      strokeWeight: 5,
      zIndex: 2,
      map: mapa,
      geodesic: linhaReta,
    });
    const pinoO = criarPino(gm, pO, origem.cidade || "Origem", AZUL);
    const pinoD = criarPino(gm, pD, destino.cidade || "Destino", LARANJA);
    pinoO.setMap(mapa);
    pinoD.setMap(mapa);
    camadas = [base, linha, pinoO, pinoD];

    const limites = new LatLngBounds();
    caminho.forEach((p) => limites.extend(p));
    mapa.fitBounds(limites, 48);
    caixa.classList.add("pronto");
    if (pedido !== numeroPedido) return;
    const osm = $("#mapa-osm");
    if (osm) osm.classList.remove("pronto");
    aplicarTextos({ km, descricao, tempo, linhaReta });
    carregarCondicoes(caminho, pedido);
  }

  /* ---------- OpenStreetMap (Leaflet), sem chave ---------- */
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

  function carregarLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (!carregandoLeaflet) {
      carregandoLeaflet = new Promise((ok, erro) => {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = LEAFLET_CSS;
        document.head.appendChild(css);
        const js = document.createElement("script");
        js.src = LEAFLET_JS;
        js.onload = ok;
        js.onerror = () => {
          carregandoLeaflet = null;
          erro(new Error("não foi possível carregar o Leaflet"));
        };
        document.head.appendChild(js);
      });
    }
    return carregandoLeaflet;
  }

  const cacheCoord = new Map();
  async function coordenadas(p) {
    const cep = String(p.cep).replace(/\D/g, "");
    if (cacheCoord.has(cep)) return cacheCoord.get(cep);

    let resultado = null;
    // 1) BrasilAPI: devolve latitude/longitude do CEP quando existe
    try {
      const r = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
      if (r.ok) {
        const c = ((await r.json()).location || {}).coordinates || {};
        const lat = parseFloat(c.latitude);
        const lng = parseFloat(c.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng))
          resultado = { lat, lng };
      }
    } catch (e) {
      /* tenta o próximo */
    }
    // 2) centro da cidade (Nominatim / OpenStreetMap)
    if (!resultado && p.cidade) {
      const q = encodeURIComponent(`${p.cidade}, ${p.uf || ""}, Brasil`);
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&accept-language=pt-BR&q=${q}`,
      );
      const lista = r.ok ? await r.json() : [];
      if (lista.length)
        resultado = {
          lat: parseFloat(lista[0].lat),
          lng: parseFloat(lista[0].lon),
        };
    }
    if (!resultado) throw new Error("não achei as coordenadas do CEP " + p.cep);
    cacheCoord.set(cep, resultado);
    return resultado;
  }

  function criarPinoOsm(L, posicao, rotulo, cor) {
    const el = document.createElement("div");
    el.className = "fr-pino";
    el.style.setProperty("--cor", cor);
    const bolinha = document.createElement("i");
    const nome = document.createElement("span");
    nome.textContent = rotulo;
    el.append(bolinha, nome);
    return L.marker([posicao.lat, posicao.lng], {
      icon: L.divIcon({ className: "", html: el, iconSize: [0, 0] }),
      interactive: false,
      keyboard: false,
    });
  }

  async function atualizarOsm(origem, destino, pedido) {
    await carregarLeaflet();
    const L = window.L;
    const [pO, pD] = await Promise.all([
      coordenadas(origem),
      coordenadas(destino),
    ]);
    if (pedido !== numeroPedido) return;

    // rota por rodovia: pede as alternativas ao OSRM e fica com a mais curta
    let caminho = [pO, pD];
    let km = Math.round(haversineKm(pO, pD));
    let tempo = "";
    let linhaReta = true;
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/${pO.lng},${pO.lat};${pD.lng},${pD.lat}` +
        "?overview=full&geometries=geojson&alternatives=true";
      const r = await fetch(url);
      const dados = r.ok ? await r.json() : null;
      const rotas = ((dados && dados.routes) || []).filter(
        (x) => x.geometry && x.geometry.coordinates.length,
      );
      if (rotas.length) {
        const rota = rotas.reduce((a, b) => (b.distance < a.distance ? b : a));
        caminho = rota.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
        km = Math.round(rota.distance / 1000);
        tempo = duracao(rota.duration * 1000);
        linhaReta = false;
      }
    } catch (e) {
      console.warn(
        "[VelozLog] Serviço de rotas indisponível; mostrando linha reta.",
        e,
      );
    }
    if (pedido !== numeroPedido) return;

    const area = $(".fr-mapa-area");
    const caixa = $("#mapa-osm");
    if (!area || !caixa) return;
    area.classList.add("tem-google");
    caixa.classList.add("pronto");
    const g = $("#mapa-google");
    if (g) g.classList.remove("pronto");

    if (!mapaOsm) {
      mapaOsm = L.map(caixa, {
        zoomControl: true,
        scrollWheelZoom: true,
        dragging: !L.Browser.mobile,
        tap: false,
        attributionControl: false,
      });
      L.control
        .attribution({ prefix: false, position: "bottomright" })
        .addTo(mapaOsm);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(mapaOsm);
      // zoom com a rodinha sempre ativo enquanto o ponteiro estiver sobre o mapa
    }
    mapaOsm.invalidateSize();
    camadasOsm.forEach((c) => c.remove());

    const pontos = caminho.map((p) => [p.lat, p.lng]);
    const opcoes = { lineCap: "round", lineJoin: "round", interactive: false };
    camadasOsm = [
      L.polyline(pontos, {
        ...opcoes,
        color: "#ffffff",
        weight: 9,
        opacity: 1,
      }).addTo(mapaOsm),
      L.polyline(pontos, {
        ...opcoes,
        color: LARANJA,
        weight: 5,
        opacity: 1,
      }).addTo(mapaOsm),
      criarPinoOsm(L, pO, origem.cidade || "Origem", AZUL).addTo(mapaOsm),
      criarPinoOsm(L, pD, destino.cidade || "Destino", LARANJA).addTo(mapaOsm),
    ];
    mapaOsm.fitBounds(L.latLngBounds(pontos), { padding: [48, 48] });
    aplicarTextos({ km, descricao: "", tempo, linhaReta });
    carregarCondicoes(caminho, pedido);
  }

  /* ---------- principal ---------- */
  async function atualizar(origem, destino) {
    ultimoPar = { origem, destino };
    const pedido = ++numeroPedido;

    if (CHAVE && !falhou) {
      try {
        await atualizarGoogle(origem, destino, pedido);
        return;
      } catch (erro) {
        if (pedido !== numeroPedido) return;
        console.warn(
          "[VelozLog] Google Maps indisponível, usando o mapa do OpenStreetMap:",
          erro && erro.message ? erro.message : erro,
        );
      }
    }
    try {
      await atualizarOsm(origem, destino, pedido);
    } catch (erro) {
      if (pedido !== numeroPedido) return;
      console.warn(
        "[VelozLog] Mapa indisponível, mantendo o desenho simples:",
        erro && erro.message ? erro.message : erro,
      );
      mostrarMapaSimples();
    }
  }

  window.VelozMapa = { atualizar };
})();
