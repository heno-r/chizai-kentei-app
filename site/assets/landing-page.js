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
        showMessage(fitMessage, "無料版を試したあとに『苦手だけを何度も回したい』『試験1か月前で順番を決めたい』と感じたら、3級プレミアム版が役立ちやすいです。");
        fitMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    purchaseCheckButton?.addEventListener("click", () => {
        showMessage(purchaseMessage, `購入前の確認ページへ移動します。価格 (${getPremiumPriceText()}), 使える機能, ログインの流れを確認してから、そのまま手続きへ進めます。`);
        purchaseMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        window.setTimeout(() => {
            window.location.href = getPremiumPurchasePath();
        }, 250);
    });
})();
