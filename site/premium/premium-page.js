(function attachPremiumGuidePage() {
    const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
    const fitCheckButton = document.getElementById("fit-check-button");
    const purchaseReadyButton = document.getElementById("purchase-ready-button");
    const purchaseFlowButton = document.getElementById("purchase-flow-button");
    const deviceCheckButton = document.getElementById("device-check-button");
    const fitMessage = document.getElementById("premium-fit-message");
    const purchaseMessage = document.getElementById("premium-purchase-message");
    const flowMessage = document.getElementById("premium-flow-message");
    const deviceMessage = document.getElementById("premium-device-message");
    const faqButtons = Array.from(document.querySelectorAll(".faq-toggle"));
    function getPremiumGuidePath() {
        return runtimeConfig.premiumGuidePath || "/premium/";
    }
    function getPremiumPurchasePath() {
        return runtimeConfig.premiumPurchasePath || "/premium/ready/";
    }
    function getPremiumPriceText() {
        return runtimeConfig.premiumPriceText || "3級プレミアム版 1,200円 / 追加月額料金なし";
    }
    function isPurchaseReady() {
        if (runtimeConfig.purchaseEnabled === false) {
            return false;
        }
        if (runtimeConfig.checkoutProvider !== "stripe") {
            return true;
        }
        return Boolean(String(runtimeConfig.stripePublishableKey || "").trim() && String(runtimeConfig.stripePriceId || "").trim());
    }
    function showMessage(target, text) {
        if (!target)
            return;
        target.textContent = text;
        target.classList.remove("hidden");
    }
    fitCheckButton?.addEventListener("click", () => {
        showMessage(fitMessage, "無料版を触って『苦手だけを回したい』『直前1か月の順番を決めたい』と感じた人は、3級プレミアム版が役立ちやすいです。");
        fitMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    purchaseReadyButton?.addEventListener("click", () => {
        const purchaseReady = isPurchaseReady();
        showMessage(purchaseMessage, purchaseReady
            ? `購入前の確認ページへ移動します。価格や流れを確認したあと、そのまま 3級プレミアム版 (${getPremiumPriceText()}) の購入手続きへ進めます。`
            : "現在はプレミアム版の内容確認を中心に案内しています。購入受付の準備が整い次第、このページから手続きへ進めます。");
        purchaseMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        window.setTimeout(() => {
            window.location.href = purchaseReady ? getPremiumPurchasePath() : getPremiumGuidePath();
        }, 250);
    });
    purchaseFlowButton?.addEventListener("click", () => {
        showMessage(flowMessage, "おすすめの流れは『無料版で使いやすさ確認 -> プレミアム版を使い始める -> 苦手復習を回す -> 試験2週間前に直前14日モードへ移行』です。購入直後に全部を見るのではなく、まず苦手復習から使い始める流れです。");
        flowMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    deviceCheckButton?.addEventListener("click", () => {
        showMessage(deviceMessage, "購入前の確認や学習ページは PC ブラウザからも利用できます。購入後は同じアカウントで続きから学習を再開する流れです。");
        deviceMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    faqButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const targetId = button.dataset.faqTarget;
            if (!targetId)
                return;
            const answer = document.getElementById(targetId);
            if (!answer)
                return;
            const isOpen = !answer.classList.contains("hidden");
            answer.classList.toggle("hidden", isOpen);
            button.setAttribute("aria-expanded", String(!isOpen));
        });
    });
})();
