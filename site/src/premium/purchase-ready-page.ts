(function attachPurchaseReadyPage(): void {
  const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
  const authClient = window.SiteAuthClient;
  const readyCheckButton = document.getElementById("ready-check-button") as HTMLButtonElement | null;
  const needTrialButton = document.getElementById("need-trial-button") as HTMLButtonElement | null;
  const loginPlaceholderButton = document.getElementById("login-placeholder-button") as HTMLButtonElement | null;
  const startCheckoutButton = document.getElementById("start-checkout-button") as HTMLButtonElement | null;
  const loginFlowButton = document.getElementById("login-flow-button") as HTMLButtonElement | null;
  const simulatePurchaseButton = document.getElementById("simulate-purchase-button") as HTMLButtonElement | null;
  const purchaseStateButton = document.getElementById("purchase-state-button") as HTMLButtonElement | null;
  const returnTargetButton = document.getElementById("return-target-button") as HTMLButtonElement | null;
  const readyMessage = document.getElementById("ready-check-message") as HTMLElement | null;
  const needTrialMessage = document.getElementById("need-trial-message") as HTMLElement | null;
  const loginPlaceholderMessage = document.getElementById("login-placeholder-message") as HTMLElement | null;
  const startCheckoutMessage = document.getElementById("start-checkout-message") as HTMLElement | null;
  const loginFlowMessage = document.getElementById("login-flow-message") as HTMLElement | null;
  const simulatePurchaseMessage = document.getElementById("simulate-purchase-message") as HTMLElement | null;
  const purchaseStateMessage = document.getElementById("purchase-state-message") as HTMLElement | null;
  const returnTargetMessage = document.getElementById("return-target-message") as HTMLElement | null;
  const faqButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".faq-toggle"));
  const isStripeCheckout = runtimeConfig.checkoutProvider === "stripe";
  const purchaseEnabled = runtimeConfig.purchaseEnabled !== false;
  let currentStatus: LicenseStatusResponse | null = null;

  function getPremiumPriceText(): string {
    return runtimeConfig.premiumPriceText || "3級プレミアム版 1,200円 / 追加月額料金なし";
  }

  function getLoginPath(): string {
    return runtimeConfig.loginPath || "/login/";
  }

  function getAppPath(): string {
    return runtimeConfig.appEntryPath || "/app/";
  }

  function getCheckoutProviderLabel(): string {
    return isStripeCheckout ? "決済画面" : "購入手続き";
  }

  function showPurchasePausedMessage(target: HTMLElement | null): void {
    showMessage(
      target,
      "現在は購入受付を一時停止しています。無料版とプレミアム版の内容はそのまま確認できます。",
    );
  }

  function showMessage(target: HTMLElement | null, text: string): void {
    if (!target) return;
    target.textContent = text;
    target.classList.remove("hidden");
  }

  async function requireSignedIn(target: HTMLElement | null): Promise<boolean> {
    if (!authClient?.fetchLicenseStatus) {
      showMessage(
        target,
        "この環境ではログイン状態を確認できません。ログイン画面へ戻ってからもう一度お試しください。",
      );
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return false;
    }

    try {
      const status = await authClient.fetchLicenseStatus();
      currentStatus = status;
      if (status.signed_in) {
        return true;
      }
    } catch (error) {
      console.warn("purchase ready sign-in check failed", error);
      showMessage(
        target,
        "ログイン状態の確認に失敗しました。ログインし直すか、しばらくしてからもう一度お試しください。",
      );
      target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return false;
    }

    showMessage(
      target,
      "購入手続きに進む前に、先にログインしてください。ログインしたあとにもう一度押せます。",
    );
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return false;
  }

  readyCheckButton?.addEventListener("click", () => {
    showMessage(
      readyMessage,
      `無料版を試していて、苦手復習や直前14日モードが必要だと感じているなら、3級プレミアム版 (${getPremiumPriceText()}) を考えやすい段階です。`,
    );
    readyMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  needTrialButton?.addEventListener("click", () => {
    showMessage(
      needTrialMessage,
      "まだ『問題形式が自分に合うか』『どのカテゴリが苦手か』が見えていないなら、まずは無料版をもう少し使ってから判断する流れが自然です。",
    );
    needTrialMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  loginPlaceholderButton?.addEventListener("click", () => {
    showMessage(
      loginPlaceholderMessage,
      "ログイン画面へ進みます。購入前の確認の続きや、購入済みかどうかの確認はログイン後にそのまま続けられます。",
    );
    loginPlaceholderMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    window.setTimeout(() => {
      const target = new URL(getLoginPath(), window.location.origin);
      target.searchParams.set("returnTo", `${window.location.pathname}${window.location.search}`);
      window.location.href = target.toString();
    }, 250);
  });

  loginFlowButton?.addEventListener("click", () => {
    showMessage(
      loginFlowMessage,
      "流れは『無料版を試す -> 購入前の確認ページでログイン -> 購入または購入済み確認 -> プレミアム版を使い始める』です。ログイン後は購入前の確認ページかプレミアム版の内容ページへ戻れます。",
    );
    loginFlowMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  startCheckoutButton?.addEventListener("click", async () => {
    if (!authClient?.startCheckout) {
      showMessage(
        startCheckoutMessage,
        "この環境では購入手続きに接続できませんでした。接続状態を確認してから、もう一度お試しください。",
      );
      return;
    }

    if (!purchaseEnabled) {
      showPurchasePausedMessage(startCheckoutMessage);
      startCheckoutMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    const signedIn = await requireSignedIn(startCheckoutMessage);
    if (!signedIn) {
      return;
    }

    if (currentStatus?.active_plan === "premium") {
      showMessage(
        startCheckoutMessage,
        "すでにプレミアム版を利用できる状態です。このまま学習ページへ戻ります。",
      );
      startCheckoutMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      window.setTimeout(() => {
        window.location.href = getAppPath();
      }, 250);
      return;
    }

    try {
      const payload = await authClient.startCheckout();
      const providerLabel = getCheckoutProviderLabel();
      if (payload?.checkout_provider === "stripe" && payload?.checkout_url) {
        showMessage(
          startCheckoutMessage,
          "決済画面へ移動します。画面が切り替わらない場合は、少し待ってからもう一度お試しください。",
        );
        startCheckoutMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        window.setTimeout(() => {
          window.location.href = payload.checkout_url;
        }, 250);
        return;
      }
      showMessage(
        startCheckoutMessage,
        `${providerLabel}の準備ができました。このまま案内に沿って進めると、購入後にプレミアム版の状態へ切り替わります。`,
      );
      startCheckoutMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      showMessage(
        startCheckoutMessage,
        error instanceof Error
          ? `購入手続きの開始に失敗しました: ${error.message}`
          : "購入手続きの開始に失敗しました。",
      );
      startCheckoutMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  simulatePurchaseButton?.addEventListener("click", async () => {
    if (!authClient?.completeCheckout) {
      showMessage(
        simulatePurchaseMessage,
        "この環境では購入後の確認に接続できませんでした。接続状態を確認してから、もう一度お試しください。",
      );
      return;
    }

    const signedIn = await requireSignedIn(simulatePurchaseMessage);
    if (!signedIn) {
      return;
    }

    try {
      showMessage(
        simulatePurchaseMessage,
        "購入完了後の状態を確認しています。完了後はプレミアム版の状態で学習ページへ戻ります。",
      );
      simulatePurchaseMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      await authClient.completeCheckout();
      window.setTimeout(() => {
        window.location.href = "/app/";
      }, 250);
    } catch (error) {
      showMessage(
        simulatePurchaseMessage,
        error instanceof Error
          ? `購入後状態の再現に失敗しました: ${error.message}`
          : "購入後状態の再現に失敗しました。",
      );
      simulatePurchaseMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });

  purchaseStateButton?.addEventListener("click", () => {
    showMessage(
      purchaseStateMessage,
      "購入の進み方は『未購入 -> 購入中 -> 購入完了 -> 反映完了』の順です。決済直後は、短時間だけ反映待ちになることがあります。",
    );
    purchaseStateMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  returnTargetButton?.addEventListener("click", () => {
    showMessage(
      returnTargetMessage,
      "購入後の主な戻り先は無料版アプリです。プレミアム版が解放された状態で `/app/` に戻り、そのまま苦手復習や要復習キューへ進めます。",
    );
    returnTargetMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  faqButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.faqTarget;
      if (!targetId) return;
      const answer = document.getElementById(targetId);
      if (!answer) return;
      const isOpen = !answer.classList.contains("hidden");
      answer.classList.toggle("hidden", isOpen);
      button.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  if (isStripeCheckout) {
    simulatePurchaseButton?.classList.add("hidden");
  }

  async function renderCurrentLicenseStatus(): Promise<void> {
    if (!authClient) {
      return;
    }

    try {
      const status = await authClient.fetchLicenseStatus();
      currentStatus = status;
      if (!status.signed_in) {
        if (loginPlaceholderButton) {
          loginPlaceholderButton.textContent = "1. ログインする";
        }
        if (startCheckoutButton) {
          startCheckoutButton.textContent = purchaseEnabled ? "2. 購入手続きに進む" : "購入受付は準備中です";
          startCheckoutButton.disabled = true;
        }
        showMessage(
          loginPlaceholderMessage,
          purchaseEnabled
            ? "まだログインしていません。先にログインすると、このページの続きから購入手続きへ進めます。"
            : "まだログインしていません。購入受付の再開までは、内容確認と無料版の体験を続けられます。",
        );
        return;
      }

      if (loginPlaceholderButton) {
        loginPlaceholderButton.textContent = "ログイン済み";
        loginPlaceholderButton.disabled = true;
      }
      if (startCheckoutButton) {
        startCheckoutButton.disabled = !purchaseEnabled;
      }

      if (status.active_plan === "premium") {
        if (startCheckoutButton) {
          startCheckoutButton.textContent = "プレミアム版で学習を続ける";
        }
        showMessage(
          loginPlaceholderMessage,
          "現在はプレミアム版を利用できる状態です。このまま学習ページへ戻って続きを進められます。",
        );
        return;
      }

      if (startCheckoutButton) {
        startCheckoutButton.textContent = purchaseEnabled ? "2. この内容で購入手続きに進む" : "購入受付は準備中です";
      }

      showMessage(
        loginPlaceholderMessage,
        purchaseEnabled
          ? "ログイン済みです。内容と価格に問題がなければ、そのまま購入手続きへ進めます。"
          : "ログイン済みです。プレミアム版の内容は確認できますが、購入受付は一時停止しています。",
      );
    } catch (error) {
      console.warn("purchase ready license status load failed", error);
    }
  }

  void renderCurrentLicenseStatus();

  if (!purchaseEnabled && startCheckoutButton && !currentStatus?.signed_in) {
    startCheckoutButton.textContent = "購入受付は準備中です";
    startCheckoutButton.disabled = true;
  }
})();
