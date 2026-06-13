import { randomUUID } from "crypto";
// ─── ZOKA PLAYER MODEL ──────────────────────────────────────────────────────
// Prompt 2: Player state sistemi
// Her oyuncunun tam state'i burada tanımlanır ve güncellenir.

// built-in crypto kullan

// ── Varsayılan oyuncu fabrikası ──────────────────────────────────────────────
export function createPlayer(name, kasabaId = "yenisehir") {
  return {
    id:          randomUUID(),
    name,
    kasabaId,
    createdAt:   Date.now(),
    season:      1,

    // ── Ekonomi ──────────────────────────────────────────────────────────────
    money:       1000,         // başlangıç serveti (ZOKA ₺)
    totalEarned: 0,
    totalLost:   0,

    // ── Sosyal / itibar ──────────────────────────────────────────────────────
    reputation:  50,           // 0-100, kasabadaki güvenilirlik

    // ── Gizli davranış skorları (oyuncu görmez, sistem takip eder) ───────────
    riskScore:        0,       // risk alma eğilimi
    suspicionLevel:   0,       // şüpheci / araştırmacı
    crowdFollowScore: 0,       // kalabalığı takip etme
    manipScore:       0,       // manipülasyon girişimleri

    // ── Arketip skorları (davranıştan türer) ─────────────────────────────────
    wolfScore:  0,             // 🐺 Risk / saldırganlık
    foxScore:   0,             // 🦊 Manipülasyon / fırsatçılık
    owlScore:   0,             // 🦉 Analiz / araştırma
    fishScore:  0,             // 🐟 Kolay etkilenme

    // ── Karar geçmişi ────────────────────────────────────────────────────────
    decisions:       [],       // { action, eventId, result, delta, tick }
    totalDecisions:  0,
    correctDecisions:0,

    // ── Aktif söylentiler ────────────────────────────────────────────────────
    activeRumors:    [],       // başlattığı/güçlendirdiği söylentiler
    rumorCooldownUntil: 0,

    // ── Sezon istatistikleri ─────────────────────────────────────────────────
    stats: {
      investCount:  0,
      waitCount:    0,
      researchCount:0,
      spreadRumorCount: 0,
      sellCount:    0,
      panicSells:   0,
    },

    // ── Bilgi distorsiyon tohumu (her oyuncuya özel, sunucu taraflı) ─────────
    infoSeed: Math.random(),   // 0-1, yeniden üretilmez → hile engeli
  };
}

// ── Durum güncelleyiciler ────────────────────────────────────────────────────

/**
 * Para değişimi — sınırları korur, istatistik tutar
 */
export function applyMoneyDelta(player, delta) {
  const before = player.money;
  player.money = Math.max(0, player.money + delta);
  if (delta > 0) player.totalEarned += delta;
  else           player.totalLost   += Math.abs(delta);
  return player.money - before; // gerçek değişim (sıfırda kesilmiş olabilir)
}

/**
 * Arketip skorlarını güncelle
 * weights: { wolf, fox, owl, fish } — pozitif veya negatif
 */
export function applyArchetypeWeights(player, weights) {
  player.wolfScore  = clamp(player.wolfScore  + (weights.wolf  || 0), 0, 200);
  player.foxScore   = clamp(player.foxScore   + (weights.fox   || 0), 0, 200);
  player.owlScore   = clamp(player.owlScore   + (weights.owl   || 0), 0, 200);
  player.fishScore  = clamp(player.fishScore  + (weights.fish  || 0), 0, 200);
}

/**
 * Davranış skorlarını güncelle
 */
export function applyBehaviorScores(player, delta) {
  if (delta.risk        != null) player.riskScore        = clamp(player.riskScore        + delta.risk,        0, 100);
  if (delta.suspicion   != null) player.suspicionLevel   = clamp(player.suspicionLevel   + delta.suspicion,   0, 100);
  if (delta.crowd       != null) player.crowdFollowScore = clamp(player.crowdFollowScore + delta.crowd,       0, 100);
  if (delta.manip       != null) player.manipScore       = clamp(player.manipScore       + delta.manip,       0, 100);
  if (delta.reputation  != null) player.reputation       = clamp(player.reputation       + delta.reputation,  0, 100);
}

/**
 * Karar kaydı
 */
export function recordDecision(player, action, eventId, moneyDelta, correct, tick) {
  player.decisions.push({ action, eventId, moneyDelta, correct, tick, at: Date.now() });
  // son 50 kararı tut
  if (player.decisions.length > 50) player.decisions.shift();
  player.totalDecisions++;
  if (correct) player.correctDecisions++;
  if (player.stats[action + "Count"] !== undefined) player.stats[action + "Count"]++;
}

/**
 * Doğru karar yüzdesi
 */
export function accuracyPct(player) {
  if (player.totalDecisions === 0) return 0;
  return Math.round((player.correctDecisions / player.totalDecisions) * 100);
}

// ── Yardımcı ────────────────────────────────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
