/*
  calc.js — 獎懲計算引擎
  依照【JFKD】家規獎懲系統 Google Sheet 的邏輯還原：

  1. 基礎獎金（翻倍）：每科依分數對應級距取得基礎獎金，
     再依「該科在本次考試所有科目中的名次」給予倍數 1, 2, 4, 8...
     （名次由分數高到低排序，同分時依輸入順序排序，第 1 名 ×1，第 2 名開始翻倍）
  2. 進步獎金：與上一次同科分數相比，每進步 1 分 +progressBonusPerPoint 元
     （退步不倒扣，最低 0）
  3. 衛冕獎金：若該科這次與上次分數都達到 90 分以上，代表「守住」上次的級距，
     依「上次分數對應的級距」核發衛冕獎金
  4. 全科加碼獎金：取「本次分數前 3 高」的科目，若這 3 科都達到某個級距（以其中最低
     那科的級距為準），核發 3 科加碼獎金；若科目數 ≥5，另外再取「前 5 高」比照辦理算出
     5 科加碼獎金。兩者都符合時取金額較高者發放（不會疊加）
  5. 若分數 < 80，該科不計基礎/進步/衛冕獎金，並標記「需處罰」

  這是盡量還原試算表公式的近似邏輯；若實際家規認定與計算結果有落差，
  可以在「新增紀錄」表單使用「手動覆寫總額」欄位修正，不影響歷史紀錄。
*/

function findTier(score, tiers) {
  return tiers.find((t) => score >= t.min && score <= t.max) || tiers[tiers.length - 1];
}

/**
 * 計算單筆考試紀錄（多科目）的獎懲明細
 * @param {Array} subjects [{name, score, prevScore}]
 * @param {Object} rules config/rules 文件內容
 */
function calcExamRecord(subjects, rules) {
  const tiers = rules.tiers;

  // 依分數排序取得名次（同分依原始順序）
  const ranked = subjects
    .map((s, idx) => ({ ...s, idx }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  const detail = ranked.map((s, rank) => {
    const tier = findTier(s.score, tiers);
    const multiplier = Math.pow(2, rank); // 第1名 x1, 第2名 x2, 第3名 x4...
    const baseBonus = tier.baseBonus * multiplier;

    const improved = typeof s.prevScore === "number" ? Math.max(0, s.score - s.prevScore) : 0;
    const progressBonus = improved * (rules.progressBonusPerPoint || 0);

    // 衛冕獎金：這次與上次都達 90 分以上，代表「守住」上次的級距，
    // 獎金依「上次分數的級距」發放（例：上次 95-100 分這次仍 ≥90，發 95-100 級距的衛冕獎金）
    let defenseBonus = 0;
    if (s.score >= 90 && typeof s.prevScore === "number" && s.prevScore >= 90) {
      const prevTier = findTier(s.prevScore, tiers);
      defenseBonus = prevTier.defenseBonus || 0;
    }

    const punishment = !!tier.punishment;

    return {
      name: s.name,
      score: s.score,
      prevScore: s.prevScore,
      rank: rank + 1,
      tierKey: tier.key,
      tierLabel: tier.label,
      multiplier,
      baseBonus,
      progressBonus,
      defenseBonus,
      punishment,
      subtotal: baseBonus + progressBonus + defenseBonus,
    };
  });

  // 還原原始輸入順序（表單顯示用）
  detail.sort((a, b) => {
    const ai = subjects.findIndex((s) => s.name === a.name && s.score === a.score);
    const bi = subjects.findIndex((s) => s.name === b.name && s.score === b.score);
    return ai - bi;
  });

  // 全科加碼獎金：分別檢查「前 3 高分」與「前 5 高分」(若有 5 科以上) 這兩組科目，
  // 取組內最低級距核發對應加碼獎金，兩組都符合時取較高金額
  function comboForTopN(n, comboTable) {
    if (ranked.length < n || !comboTable) return 0;
    const topN = ranked.slice(0, n);
    const worstIdx = Math.max(...topN.map((d) => tiers.findIndex((t) => t.key === findTier(d.score, tiers).key)));
    const worstTier = tiers[worstIdx];
    if (!worstTier || worstTier.punishment) return 0;
    return comboTable[worstTier.key] || 0;
  }
  const combo3 = comboForTopN(3, rules.comboBonus3);
  const combo5 = comboForTopN(5, rules.comboBonus5);
  const comboBonus = Math.max(combo3, combo5);

  const baseBonusTotal = sum(detail.map((d) => d.baseBonus));
  const progressBonusTotal = sum(detail.map((d) => d.progressBonus));
  const defenseBonusTotal = sum(detail.map((d) => d.defenseBonus));
  const hasPunishment = detail.some((d) => d.punishment);
  const punishmentSubjects = detail.filter((d) => d.punishment).map((d) => d.name);

  const total = baseBonusTotal + progressBonusTotal + defenseBonusTotal + comboBonus;

  return {
    detail,
    baseBonusTotal,
    progressBonusTotal,
    defenseBonusTotal,
    comboBonus,
    total,
    hasPunishment,
    punishmentSubjects,
    avgScore: round1(sum(subjects.map((s) => s.score)) / subjects.length),
  };
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

/** 預設規則（尚未從 Firestore 讀到自訂設定前的 fallback，與 Config 分頁一致） */
function defaultRules() {
  return {
    tiers: [
      { key: "A", label: "100分", min: 100, max: 100, baseBonus: 100, defenseBonus: 200, punishment: false },
      { key: "B", label: "95-100分", min: 95, max: 99, baseBonus: 50, defenseBonus: 100, punishment: false },
      { key: "C", label: "90-94分", min: 90, max: 94, baseBonus: 20, defenseBonus: 50, punishment: false },
      { key: "normal", label: "80-89分", min: 80, max: 89, baseBonus: 0, defenseBonus: 0, punishment: false },
      { key: "penalty", label: "<80分", min: 0, max: 79, baseBonus: 0, defenseBonus: 0, punishment: true },
    ],
    progressBonusPerPoint: 5,
    comboBonus3: { A: 1000, B: 500, C: 200, normal: 0, penalty: 0 },
    comboBonus5: { A: 3000, B: 1500, C: 700, normal: 0, penalty: 0 },
    punishmentText:
      "【體罰】低於 80 分，每分被爸爸揍一下\n【進步計劃】該科目每週多寫 2 份評量",
  };
}
