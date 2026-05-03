// @ts-nocheck
const form = document.getElementById("diagnosis-form");
const resultSection = document.getElementById("diagnosis-result");
const resultHeading = document.getElementById("result-heading");
const resultCopy = document.getElementById("result-copy");
const resultPlan = document.getElementById("result-plan");
const resultAction = document.getElementById("result-action");
const resultPrimaryLink = document.getElementById("result-primary-link");

const RESULTS = {
  beginner: {
    heading: "まずは3級の土台づくりから始めるのが合っています。",
    copy:
      "基礎論点を短く反復できる形が合いそうです。まずは無料版で出題形式に慣れて、必要を感じたら3級プレミアム版の案内へ進む流れが自然です。",
    plan: "無料 → 3級プレミアム版 1,200円 / 追加月額料金なし",
    action: "無料版で基礎を確認",
    href: "/app/",
  },
  focused: {
    heading: "3級合格に向けて、1か月で十分巻き返せる位置です。",
    copy:
      "基礎知識はあるので、苦手論点の整理と反復が鍵です。無料版で触り心地を確認したうえで、3級プレミアム版の内容を見て次の一歩を決めるのが合っています。",
    plan: "3級プレミアム版 1,200円 / 追加月額料金なし",
    action: "3級プレミアム版の内容を見る",
    href: "/premium/",
  },
  ambitious: {
    heading: "3級をかなり短期間で仕上げに行ける位置です。",
    copy:
      "学習時間を確保できそうなので、まずは3級を短期間で安定させる進め方が向いています。苦手復習や直前14日モードを活かせるかどうかを、3級プレミアム版の案内で確認するのがおすすめです。",
    plan: "3級プレミアム版 1,200円 / 追加月額料金なし",
    action: "3級プレミアム版の内容を見る",
    href: "/premium/",
  },
};

function resolveResult(total) {
  if (total <= 4) return RESULTS.beginner;
  if (total >= 8) return RESULTS.ambitious;
  return RESULTS.focused;
}

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const values = [...new FormData(form).values()].map((value) => Number(value));
    const total = values.reduce((sum, value) => sum + value, 0);
    const result = resolveResult(total);

    resultHeading.textContent = result.heading;
    resultCopy.textContent = result.copy;
    resultPlan.textContent = result.plan;
    resultAction.textContent = result.action;
    resultPrimaryLink.href = result.href;
    resultSection.classList.remove("hidden");
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
