(function attachLandingPage(): void {
  const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
  const fitCheckButton = document.getElementById("lp-fit-check-button") as HTMLButtonElement | null;
  const purchaseCheckButton = document.getElementById("lp-purchase-check-button") as HTMLButtonElement | null;
  const fitMessage = document.getElementById("lp-fit-message") as HTMLElement | null;
  const purchaseMessage = document.getElementById("lp-purchase-message") as HTMLElement | null;

  function getPremiumGuidePath(): string {
    return runtimeConfig.premiumGuidePath || "/premium/";
  }

  function getPremiumPurchasePath(): string {
    return runtimeConfig.premiumPurchasePath || "/premium/ready/";
  }

  function getPremiumPriceText(): string {
    return runtimeConfig.premiumPriceText || "3級プレミアム版 1,200円 / 追加月額料金なし";
  }

  function isPurchaseReady(): boolean {
    if (runtimeConfig.purchaseEnabled === false) {
      return false;
    }
    if (runtimeConfig.checkoutProvider !== "stripe") {
      return true;
    }
    return Boolean(String(runtimeConfig.stripePublishableKey || "").trim() && String(runtimeConfig.stripePriceId || "").trim());
  }

  function showMessage(target: HTMLElement | null, text: string): void {
    if (!target) return;
    target.textContent = text;
    target.classList.remove("hidden");
  }

  fitCheckButton?.addEventListener("click", () => {
    showMessage(
      fitMessage,
      "無料診断と無料版を試したあとに『苦手だけを何度も回したい』『試験1か月前で順番を決めたい』と感じたら、3級プレミアム版が役立ちやすいです。",
    );
    fitMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  purchaseCheckButton?.addEventListener("click", () => {
    const purchaseReady = isPurchaseReady();
    showMessage(
      purchaseMessage,
      purchaseReady
        ? `購入前の確認ページへ移動します。価格 (${getPremiumPriceText()}), 使える機能, ログインの流れを確認してから、そのまま手続きへ進めます。`
        : "現在はプレミアム版の内容確認を中心に案内しています。購入受付の準備が整い次第、このページから手続きへ進めます。",
    );
    purchaseMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => {
      window.location.href = purchaseReady ? getPremiumPurchasePath() : getPremiumGuidePath();
    }, 250);
  });
})();
