// ─── ZOKA EVENT SİSTEMİ ─────────────────────────────────────────────────────
// Prompt 3: Olay üretici, seçici ve sonuç hesaplayıcı

// ── Olay şablonları ──────────────────────────────────────────────────────────
export const EVENT_TEMPLATES = [
  // investment_opportunity
  { id:"E01", type:"investment_opportunity", category:"ekonomi",
    title:"Yeni Yatırımcı Kasabaya Geliyor",
    description:"Büyük bir holding Yenişehir'e fabrika kuracak.",
    baseImpact: +40, baseTrustLevel: 72, truthChance: 0.80,
    spreadFactor: 0.6, socialIntensity: "yüksek" },

  { id:"E02", type:"investment_opportunity", category:"altyapı",
    title:"Liman Genişletme Projesi Onaylandı",
    description:"Belediye limanı iki katına çıkartacak, ticaret hacmi artacak.",
    baseImpact: +30, baseTrustLevel: 65, truthChance: 0.75,
    spreadFactor: 0.5, socialIntensity: "orta" },

  // rumor / spekülasyon
  { id:"E03", type:"rumor", category:"spekülasyon",
    title:"Altın Madeni Söylentisi",
    description:"Kasaba dışında büyük altın rezervi bulunduğu iddia ediliyor.",
    baseImpact: +55, baseTrustLevel: 28, truthChance: 0.25,
    spreadFactor: 0.9, socialIntensity: "viral" },

  { id:"E04", type:"rumor", category:"rekabet",
    title:"Rakip Firma Kapanıyor",
    description:"En büyük rakibin yöneticisi istifa etti. İşçi çıkarmalar başladı.",
    baseImpact: +25, baseTrustLevel: 48, truthChance: 0.55,
    spreadFactor: 0.7, socialIntensity: "yüksek" },

  // panic_event
  { id:"E05", type:"panic_event", category:"kriz",
    title:"Panik Satış Dalgası",
    description:"Büyük yatırımcılar portföylerini boşaltıyor. Sebep belirsiz.",
    baseImpact: -50, baseTrustLevel: 85, truthChance: 0.90,
    spreadFactor: 1.0, socialIntensity: "kritik" },

  { id:"E06", type:"panic_event", category:"kriz",
    title:"Banka Zor Durumda Haberi",
    description:"Yerel bankanın acil sermaye aradığı kulaktan kulağa yayılıyor.",
    baseImpact: -35, baseTrustLevel: 55, truthChance: 0.60,
    spreadFactor: 0.8, socialIntensity: "endişe" },

  // fake_news
  { id:"E07", type:"fake_news", category:"manipülasyon",
    title:"Vergi Muafiyeti Kararnamesi",
    description:"Hükümetin ticaret vergilerini tamamen kaldıracağı söyleniyor.",
    baseImpact: +45, baseTrustLevel: 20, truthChance: 0.10,
    spreadFactor: 0.75, socialIntensity: "yüksek" },

  { id:"E08", type:"fake_news", category:"manipülasyon",
    title:"Büyük Şirket İflas Edecek",
    description:"Anonim kaynak: şehrin en büyük işvereni 30 gün içinde kapanıyor.",
    baseImpact: -40, baseTrustLevel: 18, truthChance: 0.12,
    spreadFactor: 0.85, socialIntensity: "panik" },

  // market_change
  { id:"E09", type:"market_change", category:"piyasa",
    title:"Hammadde Fiyatları Düştü",
    description:"Küresel tedarik zinciri düzelmesi yerel üretim maliyetlerini azalttı.",
    baseImpact: +20, baseTrustLevel: 78, truthChance: 0.82,
    spreadFactor: 0.4, socialIntensity: "düşük" },

  { id:"E10", type:"market_change", category:"piyasa",
    title:"Kuraklık Tahıl Fiyatlarını Vurdu",
    description:"Bölgesel kuraklık gıda ve hammadde maliyetlerini artırabilir.",
    baseImpact: -22, baseTrustLevel: 68, truthChance: 0.70,
    spreadFactor: 0.5, socialIntensity: "orta" },

  { id:"E11", type:"investment_opportunity", category:"turizm",
    title:"Kasaba Turizm Rotasına Girdi",
    description:"Ulusal turizm ajansı Yenişehir'i yeni rota listesine ekledi.",
    baseImpact: +18, baseTrustLevel: 82, truthChance: 0.88,
    spreadFactor: 0.45, socialIntensity: "olumlu" },

  { id:"E12", type:"panic_event", category:"düzenleme",
    title:"Acil Vergi Denetimi Başlıyor",
    description:"Maliye müfettişleri kasabaya ineceği haberi yayıldı.",
    baseImpact: -28, baseTrustLevel: 62, truthChance: 0.65,
    spreadFactor: 0.65, socialIntensity: "endişe" },
];

// ── Bilgi distorsiyon katmanı ────────────────────────────────────────────────
// Her oyuncuya "kendi infoSeed"ine göre farklı netlikte bilgi gelir.
const DISTORTION_LEVELS = [
  { clarity: 1.00, label: "TAM BİLGİ",    trustMod: +0,   color: "teal"   },
  { clarity: 0.65, label: "EKSİK BİLGİ",  trustMod: -15,  color: "gold"   },
  { clarity: 0.35, label: "ÇARPITILMIŞ",  trustMod: -35,  color: "orange" },
  { clarity: 0.10, label: "SÖYLENTİ",     trustMod: -55,  color: "purple" },
];

/**
 * Oyuncuya özel distorsiyon uygula
 * playerSeed: oyuncunun infoSeed değeri (0-1)
 * randomness: o olay için ek varyans (0-1)
 */
export function applyDistortion(event, playerSeed, extraNoise = 0) {
  const composite = (playerSeed * 0.6 + extraNoise * 0.4);
  let level;
  if (composite < 0.30) level = DISTORTION_LEVELS[0]; // tam bilgi
  else if (composite < 0.58) level = DISTORTION_LEVELS[1]; // eksik
  else if (composite < 0.80) level = DISTORTION_LEVELS[2]; // çarpıtılmış
  else                       level = DISTORTION_LEVELS[3]; // söylenti

  const perceivedTrust = Math.max(5, Math.min(95,
    event.baseTrustLevel + level.trustMod + jitter(10)
  ));

  // çarpıtılmış veya söylenti ise impact yönü değişebilir
  let perceivedImpact = event.baseImpact;
  if (level.clarity <= 0.35 && Math.random() < 0.45) {
    perceivedImpact = -event.baseImpact; // yön tersine dönmüş görünür
  }

  return {
    ...event,
    clarity:         level.clarity,
    infoLabel:       level.label,
    infoColor:       level.color,
    perceivedTrust,
    perceivedImpact, // oyuncunun gördüğü tahmini etki
    // gerçek değerler gizli kalır (client'a gönderilmez)
    _realImpact:     event.baseImpact,
    _isTrue:         Math.random() < event.truthChance,
  };
}

// ── Event üretici ────────────────────────────────────────────────────────────

let _eventCounter = 0;

/**
 * Yeni olay üret
 * Oyuncu-tetiklemeli söylentiler hariç, sistem tarafından çağrılır
 */
export function generateEvent(overrideType = null) {
  const pool = overrideType
    ? EVENT_TEMPLATES.filter(e => e.type === overrideType)
    : EVENT_TEMPLATES;

  const template = weightedRandom(pool);

  return {
    instanceId:   `ev_${Date.now()}_${++_eventCounter}`,
    templateId:   template.id,
    type:         template.type,
    category:     template.category,
    title:        template.title,
    description:  template.description,
    baseImpact:   template.baseImpact,
    baseTrustLevel: template.baseTrustLevel,
    truthChance:  template.truthChance,
    spreadFactor: template.spreadFactor,
    socialIntensity: template.socialIntensity,
    noise:        Math.random(), // olay bazlı ek varyans
    createdAt:    Date.now(),
    expiresAt:    Date.now() + 90_000, // 90 saniye aktif kalır
    resolved:     false,
    _resolved:    false,
  };
}

// ── Event çözümleme ──────────────────────────────────────────────────────────

/**
 * Oyuncu kararına ve olayın gerçekliğine göre sonucu hesapla
 * action: "invest" | "wait" | "research" | "spread_rumor" | "sell"
 * eventForPlayer: applyDistortion() çıktısı
 */
export function resolveEvent(action, eventForPlayer, player) {
  const happened = eventForPlayer._isTrue;
  const impact   = eventForPlayer._realImpact;
  const isPositive = impact > 0;

  let moneyDelta = 0;
  let correct    = false;
  let explanation = "";

  switch (action) {
    case "invest":
      if (happened && isPositive) {
        moneyDelta  = Math.round(Math.abs(impact) * (3 + Math.random() * 2));
        correct     = true;
        explanation = "Olay gerçekleşti ve yatırım kazandırdı.";
      } else if (happened && !isPositive) {
        moneyDelta  = -Math.round(Math.abs(impact) * (2 + Math.random()));
        explanation = "Olay gerçekleşti ama olumsuzdu — yatırım kaybı.";
      } else if (!happened && isPositive) {
        moneyDelta  = -Math.round(Math.abs(impact) * 1.5);
        explanation = "Olay gerçekleşmedi — beklenen kazanç olmadı.";
      } else {
        moneyDelta  = Math.round(Math.abs(impact) * 0.8);
        correct     = true;
        explanation = "Olumsuz söylenti gerçekleşmedi, piyasa normale döndü.";
      }
      break;

    case "sell":
      if (!isPositive && happened) {
        moneyDelta  = Math.round(Math.abs(impact) * (1.5 + Math.random()));
        correct     = true;
        explanation = "Zamanında çıktın — düşüşten kaçındın.";
      } else if (isPositive && happened) {
        moneyDelta  = -Math.round(Math.abs(impact) * 1.2);
        explanation = "Erken sattın — yükselişi kaçırdın.";
      } else {
        moneyDelta  = jitter(15);
        explanation = "Olay belirsiz kaldı — ufak etki.";
      }
      break;

    case "wait":
      if (eventForPlayer.clarity < 0.40) {
        moneyDelta  = 25 + jitter(15);
        correct     = true;
        explanation = "Belirsiz bilgi karşısında sabır ödüllendi.";
      } else if (!happened) {
        moneyDelta  = 10 + jitter(10);
        correct     = true;
        explanation = "Olay gerçekleşmedi — beklemek doğruydu.";
      } else {
        moneyDelta  = isPositive ? -(Math.round(Math.abs(impact) * 0.5)) : jitter(10);
        explanation = isPositive
          ? "Fırsatı izleyerek kaçırdın."
          : "Bekledin ama zarar gördün.";
      }
      break;

    case "research": {
      const cost  = 80;
      moneyDelta  = -cost;
      // araştırma: gerçeği %72 ihtimalle açar
      const reveal = Math.random() < 0.72;
      explanation = reveal
        ? `Araştırma sonucu: Olay %${happened ? "yüksek" : "düşük"} doğruluk taşıyor.`
        : "Kaynaklar çelişiyor — kesin sonuç yok.";
      correct     = reveal; // bilgi sahibi olmak "doğru" sayılır
      break;
    }

    case "spread_rumor": {
      const cost   = 100;
      const power  = Math.random();
      if (player.money < cost) {
        moneyDelta  = 0;
        explanation = "Söylenti için yeterli para yok.";
        break;
      }
      moneyDelta = power > 0.55
        ? Math.round(power * 120) - cost  // başarılı manipülasyon
        : -cost - Math.round((1 - power) * 50); // geri tepti
      correct    = moneyDelta > 0;
      explanation = correct
        ? "Söylenti yayıldı ve piyasayı istenen yönde etkiledi."
        : "Söylenti geri tepti veya güvenilmez bulundu.";
      break;
    }

    default:
      explanation = "Bilinmeyen aksiyon.";
  }

  return { moneyDelta, correct, explanation, happened, action };
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

// Rastgele pozitif/negatif sapma
function jitter(range) {
  return Math.round((Math.random() * 2 - 1) * range);
}

// Ağırlıklı rastgele seçim
// Panik eventler daha az sık gelsin — spreadFactor'ı ters ağırlık olarak kullan
function weightedRandom(pool) {
  const weights = pool.map(e => {
    if (e.type === "panic_event") return 0.5;
    if (e.type === "fake_news")   return 0.7;
    return 1.0;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
