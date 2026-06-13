// ─── ZOKA KARAKTER PROFİL SİSTEMİ ───────────────────────────────────────────
// Prompt 5: Arketip hesaplama, davranış analizi, sezon sonu raporu

import { accuracyPct } from "./player.js";

// ── Arketip tanımları ────────────────────────────────────────────────────────
const ARCHETYPES = {
  wolf: {
    key:   "wolf",
    icon:  "🐺",
    name:  "Kurt",
    title: "Ters Köşe Oyuncusu",
    desc:  "Risk alır, kalabalığın tersine hareket eder, ani kararlarla fark yaratır.",
    notes: [
      "Cesaretinle öne çıkıyorsun — ama her risk hesaplanmış değil.",
      "Piyasayı zorlama eğilimin bazen seni doğru yere taşıyor.",
      "Sabır sana yabancı ama öğrenmene değer.",
    ],
  },
  fox: {
    key:   "fox",
    icon:  "🦊",
    name:  "Tilki",
    title: "Fırsat Avcısı",
    desc:  "Manipülasyona açık ama zeki; söylenti ekonomisini kendi lehine kullanır.",
    notes: [
      "Fırsatları iyi görürsün ama bazen fazla şüphe seni yavaşlatır.",
      "Piyasayı okuma yeteneğin var — güven inşa etmeyi unutma.",
      "Söylenti silahını çok kullanırsan güvenilirliğin düşer.",
    ],
  },
  owl: {
    key:   "owl",
    icon:  "🦉",
    name:  "Baykuş",
    title: "Sessiz Analist",
    desc:  "Araştırır, bekler, bilgiye dayalı karar verir. Sabır en büyük avantajı.",
    notes: [
      "Doğru bilgiyle hareket etmek seni öne çıkarıyor.",
      "Bazen fazla beklemek fırsatı kaçırtıyor — dengeyi bul.",
      "Analizin güçlü, sezgini de geliştir.",
    ],
  },
  fish: {
    key:   "fish",
    icon:  "🐟",
    name:  "Balık",
    title: "Sürü Oyuncusu",
    desc:  "Hızlı karar verir, kalabalıktan etkilenir, söylentilere açıktır.",
    notes: [
      "Hızın bazen avantaj — ama bilgiyi doğrula.",
      "Kalabalığın arkasından gitmek seni çoğunlukla yanıltıyor.",
      "Sabır ve araştırma seni bir sonraki seviyeye taşır.",
    ],
  },
};

// ── Arketip hesaplama ────────────────────────────────────────────────────────

/**
 * Oyuncunun ham skorlarından dominant arketip belirle
 * Karma profil döndürür: ana + alt eğilimler
 */
export function calculateArchetype(player) {
  const raw = {
    wolf: player.wolfScore,
    fox:  player.foxScore,
    owl:  player.owlScore,
    fish: player.fishScore,
  };

  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;

  // Yüzdelik dağılım
  const pct = {
    wolf: Math.round((raw.wolf / total) * 100),
    fox:  Math.round((raw.fox  / total) * 100),
    owl:  Math.round((raw.owl  / total) * 100),
    fish: Math.round((raw.fish / total) * 100),
  };

  // Dominant arketip
  const dominant = Object.entries(pct).sort((a, b) => b[1] - a[1])[0][0];

  // Not: yeterli veri yoksa "belirsiz" döndür
  if (player.totalDecisions < 3) {
    return {
      dominant: "unknown",
      icon:   "❓",
      name:   "Belirsiz",
      title:  "Henüz Tanımlanamadı",
      desc:   "Daha fazla karar gerekiyor.",
      pct,
      note:   "En az 3 karar verdikten sonra profilin şekillenir.",
    };
  }

  const arch = ARCHETYPES[dominant];
  const noteIdx = Math.min(
    Math.floor(player.totalDecisions / 5),
    arch.notes.length - 1,
  );

  return {
    dominant,
    icon:   arch.icon,
    name:   arch.name,
    title:  arch.title,
    desc:   arch.desc,
    pct,
    note:   arch.notes[noteIdx],
  };
}

// ── Davranış analizi ─────────────────────────────────────────────────────────

export function analyzeBehavior(player) {
  const accuracy = accuracyPct(player);

  // Risk toleransı
  const riskLabel =
    player.riskScore > 70 ? "Çok Yüksek" :
    player.riskScore > 45 ? "Yüksek"     :
    player.riskScore > 25 ? "Orta"        :
                             "Düşük";

  // Araştırma alışkanlığı
  const researchLabel =
    player.suspicionLevel > 60 ? "Yüksek"  :
    player.suspicionLevel > 30 ? "Orta"    :
                                  "Düşük";

  // Kalabalık etkisi
  const crowdLabel =
    player.crowdFollowScore > 60 ? "Yüksek (kolay etkilenir)"  :
    player.crowdFollowScore > 30 ? "Orta"                       :
                                    "Düşük (bağımsız)";

  // Manipülasyon girişimi
  const manipLabel =
    player.manipScore > 60 ? "Aktif manipülatör" :
    player.manipScore > 30 ? "Ara sıra dener"     :
                              "Manipülasyondan uzak";

  return {
    accuracy,
    riskLevel:          { score: player.riskScore,        label: riskLabel },
    researchHabit:      { score: player.suspicionLevel,   label: researchLabel },
    crowdInfluence:     { score: player.crowdFollowScore, label: crowdLabel },
    manipulationTendency: { score: player.manipScore,     label: manipLabel },
    reputation:         { score: player.reputation,
                          label: player.reputation > 70 ? "Güvenilir" :
                                 player.reputation > 40 ? "Orta"      : "Şüpheli" },
  };
}

// ── Sezon sonu raporu ────────────────────────────────────────────────────────

export function generateSeasonReport(player, kasabaRankings = []) {
  const arch     = calculateArchetype(player);
  const behavior = analyzeBehavior(player);

  const wealthRank = kasabaRankings.findIndex(r => r.playerId === player.id) + 1;
  const netChange  = player.money - 1000; // başlangıç: 1000

  // Sezon değerlendirmesi
  const verdict =
    netChange > 2000 ? "Olağanüstü bir sezon — strateji mükemmeldi." :
    netChange > 500  ? "Başarılı bir sezon — doğru kararlar ağır bastı." :
    netChange > -200 ? "Dengeli bir sezon — öğrenme süreci devam ediyor." :
    netChange > -800 ? "Zor bir sezon — söylentiler seni etkiledi." :
                       "Ağır bir sezon — bir sonrakinde analizi güçlendir.";

  return {
    playerId:     player.id,
    playerName:   player.name,
    season:       player.season,
    generatedAt:  new Date().toISOString(),

    // Servet
    wealth: {
      final:     player.money,
      start:     1000,
      net:       netChange,
      earned:    player.totalEarned,
      lost:      player.totalLost,
      kasabaRank: wealthRank || null,
    },

    // Arketip
    archetype: arch,

    // Davranış
    behavior,

    // Karar istatistikleri
    decisions: {
      total:    player.totalDecisions,
      correct:  player.correctDecisions,
      accuracy: behavior.accuracy,
      breakdown: player.stats,
    },

    // Sezon notu
    verdict,

    // Sosyal paylaşım kartı (metin)
    shareCard: buildShareCard(player, arch, behavior),
  };
}

// ── Paylaşım kartı ───────────────────────────────────────────────────────────
function buildShareCard(player, arch, behavior) {
  const net = player.money - 1000;
  const sign = net >= 0 ? "+" : "";
  return [
    `🏘 ZOKA Kasabası — Sezon ${player.season} Raporu`,
    ``,
    `${arch.icon} ${arch.name.toUpperCase()} — ${arch.title}`,
    ``,
    `💰 Net: ${sign}${net} ₺  |  🎯 Doğruluk: %${behavior.accuracy}`,
    `📊 Risk: ${behavior.riskLevel.label}  |  🔍 Araştırma: ${behavior.researchHabit.label}`,
    ``,
    `"${arch.note}"`,
    ``,
    `#ZOKA #KasabaPsikolojisi`,
  ].join("\n");
}
