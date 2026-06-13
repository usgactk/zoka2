// ─── ZOKA SERVER (EXPRESS VERSION) ───────────────────────────────────────────
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createPlayer, applyMoneyDelta, applyArchetypeWeights,
         applyBehaviorScores, recordDecision } from "./engine/player.js";
import { generateEvent, applyDistortion, resolveEvent,
         EVENT_TEMPLATES } from "./engine/events.js";
import { calculateArchetype, analyzeBehavior,
         generateSeasonReport } from "./engine/profile.js";

const __dir  = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(__dir, "../client");
const PORT   = process.env.PORT || 10000;

const app = express();

// Tüm dünyadan ve mobilden gelen isteklere tam izin ver (CORS)
app.use(cors({ origin: "*" }));
app.use(express.json());

// Statik ön yüz dosyalarını otomatik sun (Android assets kullanmıyorsan yararlıdır)
app.use(express.static(CLIENT));

// ─── KASABA STATE ─────────────────────────────────────────────────────────────
const kasaba = {
  id:"yenisehir", name:"Yenişehir", season:1, tick:0, day:1, hour:9,
  marketIndex:100, marketHistory:[100],
  activeEvents:[], activeRumors:[],
  players: new Map(),
  coalitions: new Map(),
  dailySummary: null,
  stats:{ totalDecisions:0, totalEvents:0, totalRumors:0 },
};

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
const TICK_MS  = 10_000;
const TICKS_PER_HOUR = 10;
const TICKS_PER_DAY  = 90;

function gameTick() {
  kasaba.tick++;
  const t   = kasaba.tick;
  const tod = (t - 1) % TICKS_PER_DAY;

  kasaba.hour = 9 + Math.floor(tod / TICKS_PER_HOUR);

  if (tod === 0 && t > 1) {
    kasaba.dailySummary = buildDailySummary();
    kasaba.day++;
    if (kasaba.day > 30) {
      kasaba.day = 1;
      kasaba.season++;
      console.log(`[ZOKA] Yeni sezon: ${kasaba.season}`);
      for (const p of kasaba.players.values()) {
        p.season            = kasaba.season;
        p.wolfScore         = 0; p.foxScore = 0; p.owlScore = 0; p.fishScore = 0;
        p.riskScore         = 0; p.suspicionLevel = 0; p.crowdFollowScore = 0; p.manipScore = 0;
        p.totalDecisions    = 0; p.correctDecisions = 0; p.decisions = [];
        p.stats             = { investCount:0, waitCount:0, researchCount:0, spreadRumorCount:0, sellCount:0, panicSells:0 };
        p.seasonStartMoney  = p.money;
      }
    }
    kasaba.coalitions.clear();
  }

  const now = Date.now();
  kasaba.activeEvents = kasaba.activeEvents.filter(e => e.expiresAt > now);

  if (t % 3 === 0 && kasaba.activeEvents.length < 5) {
    const ev = generateEvent();
    kasaba.activeEvents.push(ev);
    kasaba.stats.totalEvents++;
    if (ev.type === "panic_event" && Math.random() < 0.4) {
      setTimeout(() => {
        if (kasaba.activeEvents.length < 5) {
          const chain = generateEvent("market_change");
          chain.chainedFrom = ev.instanceId;
          kasaba.activeEvents.push(chain);
        }
      }, 15_000);
    }
  }

  const panic = kasaba.activeEvents.filter(e => e.type === "panic_event").length;
  const boom  = kasaba.activeEvents.filter(e => e.type === "investment_opportunity").length;
  const rumorPower = kasaba.activeRumors.reduce((s, r) => s + (r.strength || 0), 0) / 100;
  kasaba.marketIndex = Math.max(20, Math.min(250,
    kasaba.marketIndex + boom * 2 - panic * 4 + rumorPower * 1.5 + (Math.random() * 4 - 2)
  ));
  kasaba.marketHistory.push(Math.round(kasaba.marketIndex));
  if (kasaba.marketHistory.length > 20) kasaba.marketHistory.shift();

  kasaba.activeRumors = kasaba.activeRumors
    .map(r => ({ ...r, strength: (r.strength || 0) - 1.5 }))
    .filter(r => r.strength > 0);
}

setInterval(gameTick, TICK_MS);
gameTick();

function buildDailySummary() {
  const topPlayers = [...kasaba.players.values()]
    .sort((a, b) => b.money - a.money).slice(0, 3)
    .map(p => ({ name: p.name, money: p.money, arch: calculateArchetype(p).icon }));

  const marketTrend = kasaba.marketHistory.length >= 2
    ? (kasaba.marketHistory[kasaba.marketHistory.length - 1] > kasaba.marketHistory[0] ? "yükseliş" : "düşüş")
    : "sakin";

  const topRumor = kasaba.activeRumors.sort((a, b) => (b.strength || 0) - (a.strength || 0))[0];

  return {
    day: kasaba.day, season: kasaba.season, marketIndex: Math.round(kasaba.marketIndex),
    marketTrend, topPlayers, hotRumor: topRumor?.text || null,
    totalDecisions: kasaba.stats.totalDecisions, generatedAt: Date.now(),
  };
}

function recordCoalition(eventId, action, playerName) {
  if (!kasaba.coalitions.has(eventId)) kasaba.coalitions.set(eventId, {});
  const ev = kasaba.coalitions.get(eventId);
  if (!ev[action]) ev[action] = [];
  const prev = ev[action].length;
  if (!ev[action].includes(playerName)) ev[action].push(playerName);
  return ev[action].length > prev && ev[action].length >= 2;
}

const ACTION_PROFILES = {
  invest:       { wolf:+6, fox:+2, owl:-1, fish:+2, risk:+8, susp:-3, crowd:+2 },
  sell:         { wolf:+2, fox:+4, owl:+2, fish:+3, risk:+3, susp:+2, crowd:+4 },
  wait:         { wolf:-3, fox:+1, owl:+5, fish:-2, risk:-4, susp:+3, crowd:-3 },
  research:     { wolf:-2, fox:+2, owl:+8, fish:-4, risk:-5, susp:+8, crowd:-5 },
  spread_rumor: { wolf:+3, fox:+8, owl:-3, fish:+1, risk:+5, manip:+10, crowd:+3 },
};

function checkPatternMemory(player, event) {
  if (player.suspicionLevel < 30) return null;
  const seen = (player.decisions || []).filter(d => d.templateId === event.templateId);
  if (seen.length >= 1) {
    return { recognized: true, bonus: Math.round(player.suspicionLevel * 0.15), msg: `Tanıdık senaryo — bu tür olay daha önce de çıkmıştı.` };
  }
  return null;
}

function processAction(player, rawEvent, eventForPlayer, action) {
  const w = ACTION_PROFILES[action];
  const res = resolveEvent(action, eventForPlayer, player);
  const memory = checkPatternMemory(player, rawEvent);
  if (memory && action === "research") {
    res.moneyDelta = (res.moneyDelta || 0) + memory.bonus;
    res.explanation += ` (+${memory.bonus}₺ tanıma bonusu)`;
    res.memoryHint = memory.msg;
  }
  applyMoneyDelta(player, res.moneyDelta);
  applyArchetypeWeights(player, { wolf:w.wolf||0, fox:w.fox||0, owl:w.owl||0, fish:w.fish||0 });
  applyBehaviorScores(player, { risk:w.risk||0, suspicion:w.susp||0, manip:w.manip||0, crowd:w.crowd||0 });
  recordDecision(player, action, eventForPlayer.instanceId, res.moneyDelta, res.correct, kasaba.tick);
  const last = player.decisions[player.decisions.length - 1];
  if (last) last.templateId = rawEvent.templateId;
  if (action === "spread_rumor") player.rumorCooldownUntil = kasaba.tick + 600;
  return { ...res, memoryHint: res.memoryHint || null };
}

function safePlayer(p) { const { infoSeed, ...pub } = p; return pub; }
function snap() {
  return {
    id:kasaba.id, name:kasaba.name, season:kasaba.season, tick:kasaba.tick, day:kasaba.day, hour:kasaba.hour,
    marketIndex:Math.round(kasaba.marketIndex), marketHistory:[...kasaba.marketHistory],
    activeEventCount:kasaba.activeEvents.length, activeRumorCount:kasaba.activeRumors.length, playerCount:kasaba.players.size,
  };
}
function eventsForPlayer(player) {
  return kasaba.activeEvents.map(ev => {
    const d = applyDistortion(ev, player.infoSeed, ev.noise);
    const s = { ...d }; delete s._realImpact; delete s._isTrue;
    return s;
  });
}

function getPlayer(req) {
  const id = req.headers["x-player-id"];
  return id ? kasaba.players.get(id) : null;
}

// ─── EXPRESS API ROTACILARI ──────────────────────────────────────────────────

app.post("/api/join", (req, res) => {
  const { name } = req.body;
  if (!name?.trim() || name.trim().length < 2) {
    return res.status(400).json({ error: "Geçerli isim girin (min 2 karakter)." });
  }
  const player = createPlayer(name.trim());
  player.seasonStartMoney = player.money;
  kasaba.players.set(player.id, player);
  return res.json({ ok: true, playerId: player.id, player: safePlayer(player), kasaba: snap() });
});

app.get("/api/state", (req, res) => {
  const player = getPlayer(req);
  if (!player) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  return res.json({
    player: safePlayer(player), kasaba: snap(),
    archetype: calculateArchetype(player), behavior: analyzeBehavior(player),
  });
});

app.get("/api/events", (req, res) => {
  const player = getPlayer(req);
  if (!player) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  return res.json({
    events: eventsForPlayer(player),
    marketIndex: Math.round(kasaba.marketIndex),
    marketHistory: [...kasaba.marketHistory],
    activeRumors: kasaba.activeRumors.map(r => ({
      id: r.id, text: r.text, strength: Math.round(r.strength || 0), trend: r.trend,
    })),
    tick: kasaba.tick,
  });
});

app.post("/api/action", (req, res) => {
  const player = getPlayer(req);
  if (!player) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  const { eventId, action } = req.body;
  if (!ACTION_PROFILES[action]) return res.status(400).json({ error: `Geçersiz aksiyon: ${action}` });

  const rawEv = kasaba.activeEvents.find(e => e.instanceId === eventId);
  if (!rawEv) return res.status(404).json({ error: "Olay bulunamadı veya süresi doldu." });

  if (action === "spread_rumor" && kasaba.tick < (player.rumorCooldownUntil || 0)) {
    const wait = Math.ceil((player.rumorCooldownUntil - kasaba.tick) / 6);
    return res.status(429).json({ error: `Söylenti cooldown: ~${wait} dakika bekle.` });
  }

  const ev = applyDistortion(rawEv, player.infoSeed, rawEv.noise);
  const res2 = processAction(player, rawEv, ev, action);

  if (action === "spread_rumor") {
    kasaba.activeRumors.push({
      id: `r_${Date.now()}`, text: `${rawEv.title} — kaynak belirsiz`,
      strength: 25 + Math.random() * 35, trend: "up", origin: player.name,
    });
    if (kasaba.activeRumors.length > 10) kasaba.activeRumors.shift();
    kasaba.stats.totalRumors++;
  }

  const coalitionFormed = recordCoalition(eventId, action, player.name);
  let coalitionBonus = 0;
  if (coalitionFormed) {
    coalitionBonus = 30;
    applyMoneyDelta(player, coalitionBonus);
    res2.explanation += ` [+${coalitionBonus}₺ koalisyon bonusu!]`;
  }

  kasaba.stats.totalDecisions++;

  return res.json({
    ok: true,
    result: {
      action, moneyDelta: res2.moneyDelta + coalitionBonus, correct: res2.correct,
      happened: res2.happened, explanation: res2.explanation, newBalance: player.money,
      memoryHint: res2.memoryHint || null, coalitionBonus: coalitionBonus > 0 ? coalitionBonus : null,
      researchReveal: action === "research" ? { perceivedTrust: ev.perceivedTrust, infoLabel: ev.infoLabel, clarity: ev.clarity } : null,
    },
    player: safePlayer(player), kasaba: snap(),
  });
});

app.get("/api/profile", (req, res) => {
  const player = getPlayer(req);
  if (!player) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  const rankings = [...kasaba.players.values()].sort((a, b) => b.money - a.money).map(p => ({ playerId: p.id, name: p.name, money: p.money }));
  return res.json(generateSeasonReport(player, rankings));
});

app.get("/api/kasaba", (req, res) => {
  const lb = [...kasaba.players.values()].sort((a, b) => b.money - a.money).slice(0, 10).map((p, i) => ({
    rank: i + 1, name: p.name, money: p.money, archetype: calculateArchetype(p).icon, decisions: p.totalDecisions,
    accuracy: p.totalDecisions > 0 ? Math.round((p.correctDecisions / p.totalDecisions) * 100) : 0,
  }));
  return res.json({ ...snap(), leaderboard: lb });
});

app.get("/api/daily-summary", (req, res) => {
  const player = getPlayer(req);
  if (!kasaba.dailySummary) return res.json({ summary: null, msg: "Gün henüz tamamlanmadı." });
  const personal = player ? {
    money: player.money, decisions: player.totalDecisions,
    accuracy: player.totalDecisions > 0 ? Math.round((player.correctDecisions / player.totalDecisions) * 100) : 0,
    archetype: calculateArchetype(player),
  } : null;
  return res.json({ summary: kasaba.dailySummary, personal });
});

app.get("/api/trade-info", (req, res) => {
  const player = getPlayer(req);
  if (!player) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  const eventId = req.query.eventId;
  const rawEv = kasaba.activeEvents.find(e => e.instanceId === eventId);
  if (!rawEv) return res.status(404).json({ error: "Olay bulunamadı." });
  const ev = applyDistortion(rawEv, player.infoSeed, rawEv.noise);
  if (ev.clarity < 0.65) return res.status(400).json({ error: "Bilgin yeterince net değil." });
  return res.json({ eventId, title: rawEv.title, clarity: ev.clarity, infoLabel: ev.infoLabel, perceivedTrust: ev.perceivedTrust, price: Math.round(ev.clarity * 120), seller: player.name });
});

app.post("/api/buy-info", (req, res) => {
  const buyer = getPlayer(req);
  if (!buyer) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  const { eventId, sellerId } = req.body;
  const seller = kasaba.players.get(sellerId);
  if (!seller) return res.status(404).json({ error: "Satıcı bulunamadı." });
  if (buyer.id === seller.id) return res.status(400).json({ error: "Kendi bilgini satın alamazsın." });
  const rawEv = kasaba.activeEvents.find(e => e.instanceId === eventId);
  if (!rawEv) return res.status(404).json({ error: "Olay bulunamadı." });

  const sellerView = applyDistortion(rawEv, seller.infoSeed, rawEv.noise);
  if (sellerView.clarity < 0.65) return res.status(400).json({ error: "Satıcının bilgisi net değil." });

  const price = Math.round(sellerView.clarity * 120);
  if (buyer.money < price) return res.status(400).json({ error: `Yeterli para yok. Gerekli: ${price}₺` });

  applyMoneyDelta(buyer, -price);
  applyMoneyDelta(seller, +Math.round(price * 0.8));
  applyArchetypeWeights(seller, { fox: +5 });

  return res.json({ ok: true, price, info: { infoLabel: sellerView.infoLabel, perceivedTrust: sellerView.perceivedTrust, perceivedImpact: sellerView.perceivedImpact, clarity: sellerView.clarity }, buyerBalance: buyer.money, sellerBalance: seller.money });
});

app.get("/api/health", (req, res) => {
  return res.json({ status: "ok", game: "ZOKA", version: "2.0.0", kasaba: snap() });
});

// Geri kalan her istek için index.html döndür (Fall-through SPA routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(CLIENT, "index.html"));
});

app.listen(PORT, () => {
  console.log(`[LIVE] ZOKA v2.0 sunucusu ${PORT} portunda tamamen güvenceye alındı.`);
});