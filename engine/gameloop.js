// ─── ZOKA OYUN DÖNGÜSÜ ──────────────────────────────────────────────────────
// Prompt 7: Tick sistemi, event chaining, kasaba simülasyonu

import { generateEvent, applyDistortion } from "./events.js";

// ── Kasaba state'i (in-memory) ───────────────────────────────────────────────
export const kasabaState = {
  id:            "yenisehir",
  name:          "Yenişehir",
  season:        1,
  tick:          0,           // saniye cinsinden oyun saati
  day:           1,
  hour:          9,           // gün 9:00'da başlar, 18:00'da biter

  // Piyasa endeksi (100 = normal)
  marketIndex:   100,
  marketHistory: [100],       // son 20 değer

  // Aktif olaylar
  activeEvents:  [],          // maks 5 aktif olay

  // Söylenti havuzu
  activeRumors:  [],

  // Oyuncu ID → player nesnesi (in-memory "DB")
  players:       new Map(),

  // İstatistikler
  stats: {
    totalDecisions: 0,
    totalEvents:    0,
    totalRumors:    0,
  },
};

// ── Tick döngüsü ─────────────────────────────────────────────────────────────
// Her "tick" = 10 gerçek saniye = oyun içinde ~6 dakika
const TICK_INTERVAL_MS    = 10_000;  // 10 saniye
const TICKS_PER_HOUR      = 10;      // 10 tick = 1 oyun saati
const HOURS_PER_DAY       = 9;       // 09:00 – 18:00
const TICKS_PER_DAY       = TICKS_PER_HOUR * HOURS_PER_DAY;
const EVENT_SPAWN_INTERVAL = 3;      // her 3 tick'te bir yeni olay üret

let _tickTimer = null;

export function startGameLoop() {
  if (_tickTimer) return; // zaten çalışıyor
  console.log("[ZOKA] Oyun döngüsü başlatıldı — tick: 10s");
  _tickTimer = setInterval(tick, TICK_INTERVAL_MS);
  tick(); // ilk tick'i hemen çalıştır
}

export function stopGameLoop() {
  if (_tickTimer) { clearInterval(_tickTimer); _tickTimer = null; }
  console.log("[ZOKA] Oyun döngüsü durduruldu.");
}

// ── Tek tick ─────────────────────────────────────────────────────────────────
function tick() {
  kasabaState.tick++;
  const t = kasabaState.tick;

  // Gün/saat hesabı
  const tickOfDay = (t - 1) % TICKS_PER_DAY;
  kasabaState.hour = 9 + Math.floor(tickOfDay / TICKS_PER_HOUR);
  if (tickOfDay === 0 && t > 1) {
    kasabaState.day++;
    // Her 30 günde sezon sıfırla
    if (kasabaState.day > 30) {
      kasabaState.day = 1;
      kasabaState.season++;
      console.log(`[ZOKA] Yeni sezon: ${kasabaState.season}`);
    }
  }

  // Süresi dolan olayları temizle
  const now = Date.now();
  kasabaState.activeEvents = kasabaState.activeEvents.filter(e => e.expiresAt > now);

  // Yeni olay üret
  if (t % EVENT_SPAWN_INTERVAL === 0 && kasabaState.activeEvents.length < 5) {
    const newEvent = generateEvent();
    kasabaState.activeEvents.push(newEvent);
    kasabaState.stats.totalEvents++;

    // Olay zinciri: panik event → zincirleme ikinci olay tetikle
    if (newEvent.type === "panic_event" && Math.random() < 0.4) {
      setTimeout(() => {
        const chain = generateEvent("market_change");
        chain.chainedFrom = newEvent.instanceId;
        kasabaState.activeEvents.push(chain);
        console.log(`[CHAIN] Panik → piyasa değişimi zinciri: ${chain.title}`);
      }, 15_000);
    }
  }

  // Piyasa endeksini güncelle
  updateMarketIndex();

  // Söylentilerin gücünü zaman içinde azalt
  decayRumors();

  if (t % 6 === 0) { // her dakika log
    console.log(
      `[TICK ${t}] Gün ${kasabaState.day} ${kasabaState.hour}:00 | ` +
      `Piyasa: ${kasabaState.marketIndex} | ` +
      `Aktif olay: ${kasabaState.activeEvents.length} | ` +
      `Oyuncu: ${kasabaState.players.size}`
    );
  }
}

// ── Piyasa endeksi ────────────────────────────────────────────────────────────
function updateMarketIndex() {
  const panicCount  = kasabaState.activeEvents.filter(e => e.type === "panic_event").length;
  const boomCount   = kasabaState.activeEvents.filter(e => e.type === "investment_opportunity").length;
  const rumorPower  = kasabaState.activeRumors.reduce((s, r) => s + r.strength, 0) / 100;

  const delta = (boomCount * 2) - (panicCount * 4) + (rumorPower * 1.5) + (Math.random() * 4 - 2);
  kasabaState.marketIndex = Math.max(20, Math.min(250,
    kasabaState.marketIndex + Math.round(delta)
  ));

  kasabaState.marketHistory.push(kasabaState.marketIndex);
  if (kasabaState.marketHistory.length > 20) kasabaState.marketHistory.shift();
}

// ── Söylenti zayıflama ────────────────────────────────────────────────────────
function decayRumors() {
  kasabaState.activeRumors = kasabaState.activeRumors
    .map(r => ({ ...r, strength: Math.max(0, r.strength - 1.5) }))
    .filter(r => r.strength > 0);
}

// ── Oyunculara özel olay listesi ──────────────────────────────────────────────
// Her oyuncuya kendi distorsiyon tohumuyla filtrelenmiş olay listesi
export function getEventsForPlayer(player) {
  return kasabaState.activeEvents.map(ev =>
    applyDistortion(ev, player.infoSeed, ev.noise)
  ).map(ev => {
    // Gerçek değerleri client'a sızdırma
    const safe = { ...ev };
    delete safe._realImpact;
    delete safe._isTrue;
    return safe;
  });
}

// ── Kasaba özet snapshot ──────────────────────────────────────────────────────
export function getKasabaSnapshot() {
  return {
    id:           kasabaState.id,
    name:         kasabaState.name,
    season:       kasabaState.season,
    tick:         kasabaState.tick,
    day:          kasabaState.day,
    hour:         kasabaState.hour,
    marketIndex:  kasabaState.marketIndex,
    marketHistory: kasabaState.marketHistory.slice(-10),
    activeEventCount: kasabaState.activeEvents.length,
    activeRumorCount: kasabaState.activeRumors.length,
    playerCount:  kasabaState.players.size,
  };
}

// ── Söylenti ekle (oyuncu tetiklemeli) ────────────────────────────────────────
export function addRumor(rumor) {
  kasabaState.activeRumors.push(rumor);
  if (kasabaState.activeRumors.length > 10) kasabaState.activeRumors.shift();
  kasabaState.stats.totalRumors++;
}
