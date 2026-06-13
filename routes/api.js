// ─── ZOKA REST API ────────────────────────────────────────────────────────────
import { Router } from "express";
import { createPlayer } from "../engine/player.js";
import { processAction, getActionRiskProfile, ACTION_PROFILES } from "../engine/actions.js";
import { calculateArchetype, analyzeBehavior, generateSeasonReport } from "../engine/profile.js";
import { applyDistortion } from "../engine/events.js";
import {
  kasabaState, getEventsForPlayer, getKasabaSnapshot, addRumor,
} from "../engine/gameloop.js";

export const router = Router();

function getPlayer(req) {
  const id = req.headers["x-player-id"] || req.body?.playerId;
  return id ? kasabaState.players.get(id) : null;
}

function safePlayer(player) {
  const { infoSeed, ...pub } = player;
  return pub;
}

// POST /api/join
router.post("/join", (req, res) => {
  const { name } = req.body;
  if (!name?.trim() || name.trim().length < 2)
    return res.status(400).json({ error: "Geçerli isim girin (min 2 karakter)." });
  const player = createPlayer(name.trim());
  kasabaState.players.set(player.id, player);
  res.json({ ok: true, playerId: player.id, player: safePlayer(player), kasaba: getKasabaSnapshot() });
});

// GET /api/state
router.get("/state", (req, res) => {
  const player = getPlayer(req);
  if (!player) return res.status(404).json({ error: "Oyuncu bulunamadı. /api/join ile başlayın." });
  res.json({ player: safePlayer(player), kasaba: getKasabaSnapshot(),
    archetype: calculateArchetype(player), behavior: analyzeBehavior(player) });
});

// GET /api/events
router.get("/events", (req, res) => {
  const player = getPlayer(req);
  if (!player) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  res.json({
    events: getEventsForPlayer(player),
    marketIndex: kasabaState.marketIndex,
    marketHistory: kasabaState.marketHistory.slice(-10),
    activeRumors: kasabaState.activeRumors.map(r => ({
      id: r.id, text: r.text, strength: Math.round(r.strength), trend: r.trend,
    })),
    tick: kasabaState.tick,
  });
});

// POST /api/action
router.post("/action", (req, res) => {
  const player = getPlayer(req);
  if (!player) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  const { eventId, action } = req.body;
  if (!Object.keys(ACTION_PROFILES).includes(action))
    return res.status(400).json({ error: `Geçersiz aksiyon: ${action}` });
  const rawEvent = kasabaState.activeEvents.find(e => e.instanceId === eventId);
  if (!rawEvent) return res.status(404).json({ error: "Olay bulunamadı veya süresi doldu." });
  if (action === "spread_rumor" && kasabaState.tick < (player.rumorCooldownUntil || 0)) {
    const wait = Math.ceil((player.rumorCooldownUntil - kasabaState.tick) / 60);
    return res.status(429).json({ error: `Söylenti cooldown: ${wait} dakika bekle.` });
  }
  const eventForPlayer = applyDistortion(rawEvent, player.infoSeed, rawEvent.noise);
  const { result } = processAction(player, eventForPlayer, action, kasabaState.tick);
  if (action === "spread_rumor") {
    addRumor({ id: `rumor_${Date.now()}`, text: `${rawEvent.title} — kaynak belirsiz`,
      strength: 25 + Math.random() * 30, trend: "up", origin: player.name });
  }
  kasabaState.stats.totalDecisions++;
  res.json({ ok: true, result, player: safePlayer(player), kasaba: getKasabaSnapshot() });
});

// GET /api/profile
router.get("/profile", (req, res) => {
  const player = getPlayer(req);
  if (!player) return res.status(404).json({ error: "Oyuncu bulunamadı." });
  const rankings = [...kasabaState.players.values()]
    .sort((a, b) => b.money - a.money)
    .map(p => ({ playerId: p.id, name: p.name, money: p.money }));
  res.json(generateSeasonReport(player, rankings));
});

// GET /api/kasaba
router.get("/kasaba", (req, res) => {
  res.json({
    ...getKasabaSnapshot(),
    leaderboard: [...kasabaState.players.values()]
      .sort((a, b) => b.money - a.money).slice(0, 10)
      .map((p, i) => ({ rank: i + 1, name: p.name, money: p.money,
        archetype: calculateArchetype(p).icon, decisions: p.totalDecisions })),
  });
});

// GET /api/actions
router.get("/actions", (req, res) => {
  res.json({ actions: Object.keys(ACTION_PROFILES).map(getActionRiskProfile) });
});
