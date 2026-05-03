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
    return isStripeCheckout ? "Stripe" : "ローカル確認モード";
  }

  function showPurchasePausedMessage(target: HTMLElement | null): void {
    showMessage(
      target,
      "プレミアム版の購入受付は、Stripe の本番審査が完了するまで一時停止しています。無料版とプレミアム版の案内はそのまま確認できます。",
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
      "購入手続きに進む前に、先にログインしてください。無料版の状態でログインしたあとにもう一度押せます。",
    );
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return false;
  }

  readyCheckButton?.addEventListener("click", () => {
    showMessage(
      readyMessage,
      `無料版の相性確認が済んでいて、苦手復習や直前14日モードが必要だと感じているなら、3級プレミアム版 (${getPremiumPriceText()}) に進みやすい状態です。`,
    );
    readyMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  needTrialButton?.addEventListener("click", () => {
    showMessage(
      needTrialMessage,
      "まだ『問題形式が自分に合うか』『どのカテゴリが苦手か』が見えていないなら、まずは無料版をもう少し触ってから判断する流れが自然です。",
    );
    needTrialMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  loginPlaceholderButton?.addEventListener("click", () => {
    showMessage(
      loginPlaceholderMessage,
      "ログイン画面へ進みます。購入前チェックの続きや、購入済み状態の確認はログイン後にそのまま続けられる想定です。",
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
      "想定している流れは『無料版を試す -> 購入前チェックでログイン -> 購入または購入済み確認 -> プレミアム版の機能を解放』です。ログイン後の戻り先は購入前チェックページかプレミアム版案内ページを想定しています。",
    );
    loginFlowMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  startCheckoutButton?.addEventListener("click", async () => {
    if (!authClient?.startCheckout) {
      showMessage(
        startCheckoutMessage,
        "この環境では購入手続きの再現がまだ使えません。ログイン導線の接続後にここから試せる想定です。",
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
        "すでにプレミアム版を利用できる状態です。このまま学習画面へ戻ります。",
      );
      startCheckoutMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      window.setTimeout(() => {
        window.location.href = getAppPath();
      }, 250);
      return;
    }

    try {
      const payload = await authClient.startCheckout();
      const providerLabel =
        payload?.checkout_provider === "stripe" ? "Stripe" : getCheckoutProviderLabel();
      if (payload?.checkout_provider === "stripe" && payload?.checkout_url) {
        showMessage(
          startCheckoutMessage,
          `Stripe のテスト決済画面へ移動します。checkout_id: ${payload.checkout_id}。画面が切り替わらない場合は、もう一度ボタンを押してください。`,
        );
        startCheckoutMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        window.setTimeout(() => {
          window.location.href = payload.checkout_url;
        }, 250);
        return;
      }
      showMessage(
        startCheckoutMessage,
        `購入手続き中の状態を記録しました。checkout_id: ${payload.checkout_id}。決済プロバイダ: ${providerLabel}。このまま購入完了を試すと、プレミアム版の状態へ切り替わります。`,
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
        "この環境では購入後状態の再現がまだ使えません。ログイン導線の接続後にここから試せる想定です。",
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
        "ローカルでは、購入完了を再現してプレミアム版の状態で無料版アプリへ戻します。",
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
      "購入状態は『未購入 -> 購入中 -> 購入成功 -> ライセンス反映済み』の4段で考えます。決済完了直後は、短時間だけ反映確認中の表示を許容する想定です。",
    );
    purchaseStateMessage?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  returnTargetButton?.addEventListener("click", () => {
    showMessage(
      returnTargetMessage,
      "購入後の主な戻り先は無料版アプリです。プレミアム版が解放された状態で `/app/` に戻し、そのまま苦手復習や要復習キューへ入れる導線を想定しています。",
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
          "現在はプレミアム版を利用できる状態です。このまま学習画面へ戻って続きを進められます。",
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
          : "ログイン済みです。プレミアム版の案内は確認できますが、購入受付は一時停止しています。",
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
