(function attachLandingPage() {
    const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
    const fitCheckButton = document.getElementById("lp-fit-check-button");
    const purchaseCheckButton = document.getElementById("lp-purchase-check-button");
    const fitMessage = document.getElementById("lp-fit-message");
    const purchaseMessage = document.getElementById("lp-purchase-message");
    function getPremiumGuidePath() {
        return runtimeConfig.premiumGuidePath || "/premium/";
    }
    function getPremiumPurchasePath() {
        return runtimeConfig.premiumPurchasePath || "/premium/ready/";
    }
    function getPremiumPriceText() {
        return runtimeConfig.premiumPriceText || "3級プレミアム版 1,200円 / 追加月額料金なし";
    }
    function showMessage(target, text) {
        if (!target)
            return;
        target.textContent = text;
        target.classList.remove("hidden");
    }
    fitCheckButton?.addEventListener("click", () => {
        showMessage(fitMessage, "無料版を試したあとに『苦手だけを何度も回したい』『試験1か月前で順番を決めたい』と感じたら、3級プレミアム版との相性が高めです。");
        fitMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    purchaseCheckButton?.addEventListener("click", () => {
        showMessage(purchaseMessage, `購入前は、価格 (${getPremiumPriceText()}), 解放される機能, 対応端末, 返金や問い合わせの案内を確認してから進む想定です。購入前チェックページへ移動します。`);
        purchaseMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        window.setTimeout(() => {
            window.location.href = getPremiumPurchasePath();
        }, 250);
    });
})();
