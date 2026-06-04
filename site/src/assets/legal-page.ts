(function attachLegalPage(): void {
  const runtimeConfig = window.APP_RUNTIME_CONFIG || {};

  function getSupportEmail(): string | null {
    const value = String(runtimeConfig.supportEmail || "").trim();
    if (!value || /example\.com/i.test(value)) {
      return null;
    }
    return value;
  }

  function getPremiumPriceText(): string {
    return String(runtimeConfig.premiumPriceText || "").trim() || "3級プレミアム版 1,200円 / 追加月額料金なし";
  }

  function getServiceName(): string {
    return String(runtimeConfig.serviceName || "").trim() || "しけん準備室 知財3級対策";
  }

  function getOperatorTradeName(): string {
    return String(runtimeConfig.operatorTradeName || "").trim() || "しけん準備室";
  }

  function getOperatorName(): string {
    return String(runtimeConfig.operatorName || "").trim() || "佐々木隆司";
  }

  function getLegalEffectiveDate(): string {
    return String(runtimeConfig.legalEffectiveDate || "").trim() || "2026/5/3";
  }

  function renderSupportEmailNotes(): void {
    const supportEmail = getSupportEmail();
    const notes = document.querySelectorAll<HTMLElement>("[data-support-email-note]");
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

  function renderPremiumPriceText(): void {
    const premiumPriceText = getPremiumPriceText();
    const targets = document.querySelectorAll<HTMLElement>("[data-premium-price-text]");
    targets.forEach((target) => {
      target.textContent = premiumPriceText;
    });
  }

  function renderText(selector: string, value: string): void {
    const targets = document.querySelectorAll<HTMLElement>(selector);
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
