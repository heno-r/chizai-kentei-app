(function attachLegalPage() {
    const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
    function getSupportEmail() {
        const value = String(runtimeConfig.supportEmail || "").trim();
        if (!value || /example\.com/i.test(value)) {
            return null;
        }
        return value;
    }
    function getPremiumPriceText() {
        return String(runtimeConfig.premiumPriceText || "").trim() || "3級プレミアム版 1,200円 / 追加月額料金なし";
    }
    function getServiceName() {
        return String(runtimeConfig.serviceName || "").trim() || "しけん準備室 知財3級対策";
    }
    function getOperatorTradeName() {
        return String(runtimeConfig.operatorTradeName || "").trim() || "しけん準備室";
    }
    function getOperatorName() {
        return String(runtimeConfig.operatorName || "").trim() || "佐々木隆司";
    }
    function getLegalEffectiveDate() {
        return String(runtimeConfig.legalEffectiveDate || "").trim() || "2026/5/3";
    }
    function renderSupportEmailNotes() {
        const supportEmail = getSupportEmail();
        const notes = document.querySelectorAll("[data-support-email-note]");
        notes.forEach((note) => {
            if (!supportEmail) {
                note.textContent = "";
                note.classList.add("hidden");
                return;
            }
            note.textContent = `必要に応じて ${supportEmail} から返信することがあります。受信設定をご確認ください。`;
            note.classList.remove("hidden");
        });
    }
    function renderPremiumPriceText() {
        const premiumPriceText = getPremiumPriceText();
        const targets = document.querySelectorAll("[data-premium-price-text]");
        targets.forEach((target) => {
            target.textContent = premiumPriceText;
        });
    }
    function renderText(selector, value) {
        const targets = document.querySelectorAll(selector);
        targets.forEach((target) => {
            target.textContent = value;
        });
    }
    renderSupportEmailNotes();
    renderPremiumPriceText();
    renderText("[data-service-name]", getServiceName());
    renderText("[data-operator-trade-name]", getOperatorTradeName());
    renderText("[data-operator-name]", getOperatorName());
    renderText("[data-legal-effective-date]", getLegalEffectiveDate());
})();
