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
    function showMessage(target, text) {
        if (!target)
            return;
        target.textContent = text;
        target.classList.remove("hidden");
    }
    fitCheckButton?.addEventListener("click", () => {
        showMessage(fitMessage, "無料版を触って『苦手だけを回したい』『直前1か月の順番を決めたい』と感じた人は、3級プレミアム版との相性が高めです。");
        fitMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    purchaseReadyButton?.addEventListener("click", () => {
        showMessage(purchaseMessage, `購入前チェックページへ移動します。価格や使い方を確認してから、3級プレミアム版 (${getPremiumPriceText()}) に進めるようにしています。`);
        purchaseMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        window.setTimeout(() => {
            window.location.href = getPremiumPurchasePath();
        }, 250);
    });
    purchaseFlowButton?.addEventListener("click", () => {
        showMessage(flowMessage, "おすすめの流れは『無料版で相性確認 -> プレミアム版を使い始める -> 苦手復習を回す -> 試験2週間前に直前14日モードへ移行』です。購入直後に全部を見るのではなく、まず苦手復習から使い始める流れです。");
        flowMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    deviceCheckButton?.addEventListener("click", () => {
        showMessage(deviceMessage, "iPhone / Android を主対象にしつつ、購入前の確認や無料体験は PC ブラウザでも見られるようにしています。オフライン対応は後回しにして、まずはオンラインで安定して使えることを優先しています。");
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
