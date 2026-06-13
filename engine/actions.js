// ─── ZOKA KARAR SİSTEMİ ─────────────────────────────────────────────────────
// Prompt 4: Action handler — her kararın ekonomik ve psikolojik etkisi

import {
  applyMoneyDelta,
  applyArchetypeWeights,
  applyBehaviorScores,
  recordDecision,
} from "./player.js";
import { resolveEvent } from "./events.js";

// ── Aksiyon tanımları ────────────────────────────────────────────────────────
// Her aksiyon: ekonomi etkisi + arketip ağırlıkları + davranış skoru değişimi

const ACTION_PROFILES = {
  invest: {
    label:       "Yatırım Yap",
    icon:        "📈",
    archWeights: { wolf: +6, fox: +2, owl: -1, fish: +2 },
    behavior:    { risk: +8, suspicion: -3, crowd: +2 },
    repEffect:   (correct) => correct ? +3 : -2,
  },
  sell: {
    label:       "Sat",
    icon:        "📉",
    archWeights: { wolf: +2, fox: +4, owl: +2, fish: +3 },
    behavior:    { risk: +3, suspicion: +2, crowd: +4 },
    repEffect:   (correct) => correct ? +2 : -1,
  },
  wait: {
    label:       "Bekle",
    icon:        "⏳",
    archWeights: { wolf: -3, fox: +1, owl: +5, fish: -2 },
    behavior:    { risk: -4, suspicion: +3, crowd: -3 },
    repEffect:   () => +1,
  },
  research: {
    label:       "Araştır",
    icon:        "🔍",
    archWeights: { wolf: -2, fox: +2, owl: +8, fish: -4 },
    behavior:    { risk: -5, suspicion: +8, crowd: -5, manip: -2 },
    repEffect:   () => +2,
  },
  spread_rumor: {
    label:       "Söylenti Yay",
    icon:        "🌀",
    archWeights: { wolf: +3, fox: +8, owl: -3, fish: +1 },
    behavior:    { risk: +5, manip: +10, crowd: +3, suspicion: -2 },
    repEffect:   (correct) => correct ? 0 : -5,
  },
};

// ── Ana aksiyon işleyici ─────────────────────────────────────────────────────

/**
 * processAction(player, event, action) → { player, result }
 *
 * player:  güncel oyuncu state'i (mutate edilir)
 * event:   applyDistortion() ile işlenmiş olay
 * action:  "invest" | "sell" | "wait" | "research" | "spread_rumor"
 * tick:    oyun saati
 */
export function processAction(player, event, action, tick = 0) {
  const profile = ACTION_PROFILES[action];
  if (!profile) throw new Error(`Bilinmeyen aksiyon: ${action}`);

  // 1. Olay sonucunu hesapla
  const resolution = resolveEvent(action, event, player);

  // 2. Para güncelle
  const actualDelta = applyMoneyDelta(player, resolution.moneyDelta);

  // 3. Arketip skorları güncelle
  applyArchetypeWeights(player, profile.archWeights);

  // 4. Davranış skorları güncelle
  applyBehaviorScores(player, {
    ...profile.behavior,
    reputation: profile.repEffect(resolution.correct),
  });

  // 5. Balık etkisi: kalabalık baskısıyla yanlış karar verdiyse fishScore artar
  if (!resolution.correct && player.crowdFollowScore > 50) {
    applyArchetypeWeights(player, { fish: +4 });
  }

  // 6. Karar kaydet
  recordDecision(
    player,
    action,
    event.instanceId,
    actualDelta,
    resolution.correct,
    tick,
  );

  // 7. Söylenti cooldown
  if (action === "spread_rumor") {
    player.rumorCooldownUntil = tick + 600; // 10 dakika (600 saniye)
    player.activeRumors.push({
      eventId: event.instanceId,
      title:   event.title,
      tick,
      success: resolution.correct,
    });
    if (player.activeRumors.length > 3) player.activeRumors.shift();
  }

  return {
    player,
    result: {
      action,
      icon:        profile.label,
      moneyDelta:  actualDelta,
      correct:     resolution.correct,
      happened:    resolution.happened,
      explanation: resolution.explanation,
      newBalance:  player.money,
    },
  };
}

// ── Risk/Reward özeti ────────────────────────────────────────────────────────
// API'den oyuncuya gönderilebilir yardımcı: hangi aksiyonun risk profili ne?
export function getActionRiskProfile(action) {
  const p = ACTION_PROFILES[action];
  if (!p) return null;
  return {
    action,
    label:    p.label,
    icon:     p.icon,
    riskLevel: action === "invest"       ? "yüksek"
              : action === "spread_rumor" ? "yüksek"
              : action === "sell"         ? "orta"
              : action === "wait"         ? "düşük"
              : "düşük",          // research
    potentialGain:  action === "invest"       ? "çok yüksek"
                   : action === "spread_rumor" ? "yüksek"
                   : action === "sell"         ? "orta"
                   : action === "wait"         ? "düşük"
                   : "bilgi",     // research
  };
}

export { ACTION_PROFILES };
