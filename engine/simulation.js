// ─── ZOKA MVP — TAM ÇALIŞIR SİMÜLASYON ─────────────────────────────────────
// Prompt 8: node simulation.js  →  konsola sezon özeti basar
//
// Bağımlılık YOK — saf Node.js  (v18+)
// Her çalıştırmada farklı sonuç üretir.

// ── Yardımcı ─────────────────────────────────────────────────────────────────
const rnd  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const pct  = (a, b) => b === 0 ? 0 : Math.round((a / b) * 100);

// ── Olay şablonları ───────────────────────────────────────────────────────────
const EVENTS = [
  { type:"investment", title:"Yatırımcı geldi",       impact:+40, trust:72, truth:0.80 },
  { type:"rumor",      title:"Altın madeni söylentisi",impact:+55, trust:28, truth:0.25 },
  { type:"panic",      title:"Panik satış başladı",   impact:-50, trust:85, truth:0.90 },
  { type:"fake_news",  title:"Sahte iflas haberi",    impact:-40, trust:18, truth:0.12 },
  { type:"market",     title:"Hammadde ucuzladı",     impact:+20, trust:78, truth:0.82 },
  { type:"rumor",      title:"Rakip firma kapanıyor", impact:+25, trust:48, truth:0.55 },
  { type:"panic",      title:"Banka kriz haberi",     impact:-35, trust:55, truth:0.60 },
  { type:"market",     title:"Kuraklık uyarısı",      impact:-22, trust:68, truth:0.70 },
  { type:"investment", title:"Liman projesi onayı",   impact:+30, trust:65, truth:0.75 },
  { type:"fake_news",  title:"Vergi muafiyeti iddiası",impact:+45, trust:20, truth:0.10 },
];

const ACTIONS = ["invest","sell","wait","research","spread_rumor"];

// ── Oyuncu fabrikası ──────────────────────────────────────────────────────────
function newPlayer(name) {
  return {
    name, money:1000, totalEarned:0, totalLost:0, reputation:50,
    riskScore:0, suspicion:0, crowdFollow:0, manipScore:0,
    wolfScore:0, foxScore:0, owlScore:0, fishScore:0,
    totalDecisions:0, correctDecisions:0,
    stats:{ invest:0, sell:0, wait:0, research:0, spread_rumor:0 },
    log:[],
  };
}

// ── Distorsiyon ───────────────────────────────────────────────────────────────
function distort(event, seed) {
  const v = seed * 0.6 + Math.random() * 0.4;
  if (v < 0.30) return { ...event, label:"TAM BİLGİ",   clarity:1.0, perceivedTrust:event.trust };
  if (v < 0.58) return { ...event, label:"EKSİK",       clarity:0.65,perceivedTrust:event.trust-15 };
  if (v < 0.80) return { ...event, label:"ÇARPITILMIŞ", clarity:0.35,perceivedTrust:event.trust-35,
                          impact: Math.random()<0.4 ? -event.impact : event.impact };
  return              { ...event, label:"SÖYLENTİ",     clarity:0.10,perceivedTrust:10 };
}

// ── Karar motoru ──────────────────────────────────────────────────────────────
function decide(player, event) {
  // Basit AI: 3 strateji arasından rastgele birini seç
  // (gerçek oyunda kullanıcı seçer)
  const r = Math.random();
  if (event.clarity < 0.15)          return "wait";          // çok belirsizse bekle
  if (event.type === "panic" && r<.5) return "sell";          // panik varsa sat
  if (r < 0.25)                       return "research";
  if (r < 0.35)                       return "spread_rumor";
  if (event.impact > 0 && r < 0.75)  return "invest";
  return "wait";
}

// ── Aksiyon çözümleyici ───────────────────────────────────────────────────────
function resolve(player, ev, action) {
  const happened = Math.random() < ev.truth;
  const real     = ev.impact; // orijinal, çarpıtılmamış
  const pos      = real > 0;
  let delta = 0, correct = false, note = "";

  switch(action) {
    case "invest":
      if (happened && pos)  { delta = rnd(real*3,real*5);    correct=true;  note="Yatırım kazandı! ✓" }
      else if (happened)    { delta = -rnd(Math.abs(real)*2,Math.abs(real)*3);  note="Yatırım battı. ✗" }
      else if (!happened&&pos){ delta = -rnd(Math.abs(real),Math.abs(real)*2);  note="Olay olmadı, kayıp. ✗" }
      else                  { delta = rnd(5,20);              correct=true;  note="Kötü senaryo gelmedi. ✓" }
      break;
    case "sell":
      if (!pos && happened) { delta = rnd(Math.abs(real),Math.abs(real)*2); correct=true; note="Zamanında çıktın. ✓" }
      else if (pos&&happened){ delta = -rnd(10,Math.abs(real)); note="Erken sattın. ✗" }
      else                  { delta = rnd(-5,15);             note="Belirsiz sonuç." }
      break;
    case "wait":
      if (ev.clarity<0.40)  { delta = rnd(15,35); correct=true; note="Belirsizlikte sabır ödüllendi. ✓" }
      else if (!happened)   { delta = rnd(5,15);  correct=true; note="Olay gelmedi, iyi bekledin. ✓" }
      else                  { delta = rnd(-15,0);              note="Fırsat geçti. ✗" }
      break;
    case "research":
      delta = -80; correct = true;
      note  = `Araştırma: olay ${happened?"gerçekleşti":"olmadı"}. (−80₺) ✓`;
      break;
    case "spread_rumor":
      delta = Math.random()>0.45 ? rnd(50,130)-100 : -rnd(50,80);
      correct = delta > 0;
      note = correct ? "Söylenti piyasayı etkiledi. ✓" : "Söylenti geri tepti. ✗";
      break;
  }
  return { delta:Math.round(delta), correct, note, happened };
}

// ── Arketip skorcusu ──────────────────────────────────────────────────────────
const ARCH_WEIGHTS = {
  invest:       { wolf:+6, fox:+2, owl:-1, fish:+2, risk:+8, susp:-3, crowd:+2 },
  sell:         { wolf:+2, fox:+4, owl:+2, fish:+3, risk:+3, susp:+2, crowd:+4 },
  wait:         { wolf:-3, fox:+1, owl:+5, fish:-2, risk:-4, susp:+3, crowd:-3 },
  research:     { wolf:-2, fox:+2, owl:+8, fish:-4, risk:-5, susp:+8, crowd:-5 },
  spread_rumor: { wolf:+3, fox:+8, owl:-3, fish:+1, risk:+5, manip:+10, crowd:+3 },
};

function applyWeights(player, action) {
  const w = ARCH_WEIGHTS[action];
  player.wolfScore   = clamp(player.wolfScore+(w.wolf||0),  0,200);
  player.foxScore    = clamp(player.foxScore +(w.fox||0),   0,200);
  player.owlScore    = clamp(player.owlScore +(w.owl||0),   0,200);
  player.fishScore   = clamp(player.fishScore+(w.fish||0),  0,200);
  player.riskScore   = clamp(player.riskScore+(w.risk||0),  0,100);
  player.suspicion   = clamp(player.suspicion+(w.susp||0),  0,100);
  player.crowdFollow = clamp(player.crowdFollow+(w.crowd||0),0,100);
  player.manipScore  = clamp(player.manipScore+(w.manip||0),0,100);
}

// ── Arketip hesapla ───────────────────────────────────────────────────────────
function getArchetype(player) {
  const raw   = { wolf:player.wolfScore, fox:player.foxScore, owl:player.owlScore, fish:player.fishScore };
  const total = Object.values(raw).reduce((a,b)=>a+b,0)||1;
  const pcts  = Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,Math.round(v/total*100)]));
  const dom   = Object.entries(pcts).sort((a,b)=>b[1]-a[1])[0][0];
  const icons = { wolf:"🐺 Kurt", fox:"🦊 Tilki", owl:"🦉 Baykuş", fish:"🐟 Balık" };
  return { dominant: icons[dom], pcts };
}

// ── Sezon simülasyonu ─────────────────────────────────────────────────────────
function runSeason(playerName, rounds=10) {
  const player   = newPlayer(playerName);
  const infoSeed = Math.random(); // kişiye özel bilgi kalitesi

  console.log(`\n${"═".repeat(52)}`);
  console.log(`  ZOKA SİMÜLASYONU — ${playerName}`);
  console.log(`  Bilgi kalitesi: ${infoSeed < 0.3 ? "İYİ" : infoSeed < 0.6 ? "ORTA" : "KÖTÜ"} (seed: ${infoSeed.toFixed(2)})`);
  console.log(`${"═".repeat(52)}`);

  for (let i = 1; i <= rounds; i++) {
    const template = pick(EVENTS);
    const ev       = distort(template, infoSeed);
    const action   = decide(player, ev);
    const result   = resolve(player, ev, action);

    // Para güncelle
    const before   = player.money;
    player.money   = Math.max(0, player.money + result.delta);
    if (result.delta > 0) player.totalEarned += result.delta;
    else                  player.totalLost   += Math.abs(result.delta);

    applyWeights(player, action);
    player.stats[action]++;
    player.totalDecisions++;
    if (result.correct) player.correctDecisions++;

    // Log satırı
    const sign  = result.delta >= 0 ? "+" : "";
    const arrow = result.delta >= 0 ? "▲" : "▼";
    console.log(
      `[${String(i).padStart(2,"0")}] ${ev.label.padEnd(12)} ` +
      `${ev.title.padEnd(26)} ` +
      `${action.padEnd(14)} ` +
      `${arrow} ${sign}${result.delta}₺ → ${player.money}₺  ${result.note}`
    );
  }

  // ── Sezon sonu raporu ─────────────────────────────────────────────────────
  const arch = getArchetype(player);
  const net  = player.money - 1000;
  const acc  = pct(player.correctDecisions, player.totalDecisions);

  console.log(`\n${"─".repeat(52)}`);
  console.log(`  SEZON SONU RAPORU — ${playerName}`);
  console.log(`${"─".repeat(52)}`);
  console.log(`  Başlangıç:    1.000 ₺`);
  console.log(`  Final:        ${player.money} ₺  (net: ${net>=0?"+":""}${net}₺)`);
  console.log(`  Kazanılan:    +${player.totalEarned}₺`);
  console.log(`  Kaybedilen:   -${player.totalLost}₺`);
  console.log(`  Doğru karar:  %${acc} (${player.correctDecisions}/${player.totalDecisions})`);
  console.log(`\n  Arketip:      ${arch.dominant}`);
  console.log(`  Alt eğilimler:`);
  console.log(`    🐺 Kurt:   %${arch.pcts.wolf}   🦊 Tilki: %${arch.pcts.fox}`);
  console.log(`    🦉 Baykuş: %${arch.pcts.owl}   🐟 Balık: %${arch.pcts.fish}`);
  console.log(`\n  Davranış:`);
  console.log(`    Risk skoru:    ${player.riskScore}`);
  console.log(`    Araştırma:     ${player.suspicion}`);
  console.log(`    Kalabalık:     ${player.crowdFollow}`);
  console.log(`    Manipülasyon:  ${player.manipScore}`);
  console.log(`\n  Karar dağılımı:`);
  Object.entries(player.stats).forEach(([k,v]) =>
    console.log(`    ${k.padEnd(14)}: ${v}`)
  );

  const verdict = net>2000?"Olağanüstü sezon!":net>500?"Başarılı sezon.":net>-200?"Denge sağlandı.":net>-800?"Zor bir sezon.":"Ağır kayıplar.";
  console.log(`\n  Değerlendirme: ${verdict}`);
  console.log(`${"═".repeat(52)}\n`);

  return player;
}

// ── Çalıştır ──────────────────────────────────────────────────────────────────
// 3 farklı oyuncu, farklı stratejiler (rastgele ama tekrarlanabilir)
runSeason("AlphaWolf",   12);
runSeason("SilentOwl",   12);
runSeason("QuickFish",   12);
