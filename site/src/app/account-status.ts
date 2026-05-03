(function attachAppAccountStatus(): void {
  const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
  const authClient = window.SiteAuthClient;
  const statusTitle = document.getElementById("account-status-title") as HTMLElement | null;
  const statusCopy = document.getElementById("account-status-copy") as HTMLElement | null;
  const loginLink = document.getElementById("account-login-link") as HTMLAnchorElement | null;
  const upgradeLink = document.getElementById("account-upgrade-link") as HTMLAnchorElement | null;
  const logoutButton = document.getElementById("account-logout-button") as HTMLButtonElement | null;

  function getLoginPath(): string {
    return runtimeConfig.loginPath || "/login/";
  }

  function buildLoginHref(): string {
    const target = new URL(getLoginPath(), window.location.origin);
    target.searchParams.set("returnTo", `${window.location.pathname}${window.location.search}`);
    return target.toString();
  }

  function getPremiumReadyPath(): string {
    return runtimeConfig.premiumPurchasePath || "/premium/ready/";
  }

  function getPremiumGuidePath(): string {
    return runtimeConfig.premiumGuidePath || "/premium/";
  }

  function isPurchaseEnabled(): boolean {
    return runtimeConfig.purchaseEnabled !== false;
  }

  function renderMessage(
    title: string,
    copy: string,
    signedIn: boolean,
    {
      loginHref,
      loginLabel,
      upgradeHref,
      upgradeLabel,
    }: {
      loginHref: string;
      loginLabel: string;
      upgradeHref: string;
      upgradeLabel: string;
    },
  ): void {
    if (statusTitle) {
      statusTitle.textContent = title;
    }
    if (statusCopy) {
      statusCopy.textContent = copy;
    }
    if (loginLink) {
      loginLink.href = loginHref;
      loginLink.textContent = loginLabel;
    }
    if (upgradeLink) {
      upgradeLink.href = upgradeHref;
      upgradeLink.textContent = upgradeLabel;
    }
    if (logoutButton) {
      logoutButton.classList.toggle("hidden", !signedIn);
    }
  }

  async function refresh(): Promise<void> {
    if (!authClient) {
      renderMessage(
        "ログイン案内は準備中です",
        "今は無料版の学習体験をそのまま確認できます。プレミアム版の購入状態確認は、公開時にこの画面から続けられるようにします。",
        false,
        {
          loginHref: buildLoginHref(),
          loginLabel: "ログインして購入状態を確認",
          upgradeHref: getPremiumReadyPath(),
          upgradeLabel: "購入前チェックへ進む",
        },
      );
      return;
    }

    try {
      const status = await authClient.fetchLicenseStatus();
      if (status.source === "supabase_config_missing") {
        renderMessage(
          "ログイン設定が未完了です",
          "本番用の Supabase Auth 設定がまだ入っていません。ローカル確認では local_stub を使うか、設定値を入れてから再確認します。",
          false,
          {
            loginHref: buildLoginHref(),
            loginLabel: "ログインして購入状態を確認",
            upgradeHref: getPremiumReadyPath(),
            upgradeLabel: "購入前チェックへ進む",
          },
        );
        return;
      }
      if (!status.signed_in) {
        renderMessage(
          isPurchaseEnabled() ? "無料版を試したあとは、ログインして次へ進めます" : "無料版を試しながら公開準備をお待ちください",
          isPurchaseEnabled()
            ? "無料版の相性確認が済んだら、先にログインしておくと購入前チェックからそのまま進めます。"
            : "ログインはできますが、プレミアム版の購入受付は Stripe の本番審査が完了するまで一時停止しています。",
          false,
          {
            loginHref: buildLoginHref(),
            loginLabel: "ログインする",
            upgradeHref: isPurchaseEnabled() ? buildLoginHref() : getPremiumGuidePath(),
            upgradeLabel: isPurchaseEnabled() ? "ログインして購入準備へ進む" : "プレミアム版の案内を見る",
          },
        );
        return;
      }

      if (status.active_plan === "premium") {
        renderMessage(
          "プレミアム版を利用できる状態です",
          "準備はできています。このまま学習へ戻れば、追加問題とプレミアム機能をそのまま使えます。",
          true,
          {
            loginHref: buildLoginHref(),
            loginLabel: "ログイン状態を変更する",
            upgradeHref: "/app/",
            upgradeLabel: "プレミアム版で学習を続ける",
          },
        );
        return;
      }

      renderMessage(
        isPurchaseEnabled() ? "次は購入前チェックへ進めます" : "プレミアム版の購入受付は準備中です",
        isPurchaseEnabled()
          ? status.purchase_state === "in_checkout"
            ? "購入手続きの途中として記録されています。購入前チェックへ戻ると、そのまま続きから確認できます。"
            : "ログイン済みなので、価格と機能を確認したらそのまま購入へ進めます。"
          : "ログイン済みです。プレミアム版の内容確認はできますが、購入受付は Stripe の本番審査が完了するまで一時停止しています。",
        true,
        {
          loginHref: buildLoginHref(),
          loginLabel: "ログイン状態を変更する",
          upgradeHref: isPurchaseEnabled() ? getPremiumReadyPath() : getPremiumGuidePath(),
          upgradeLabel: isPurchaseEnabled() ? "このまま購入前チェックへ進む" : "プレミアム版の案内を見る",
        },
      );
    } catch (error) {
      console.warn("account status load failed", error);
      renderMessage(
        "購入状態を確認できませんでした",
        "通信の状況によって購入状態の確認に失敗することがあります。しばらくしてからもう一度お試しください。",
        false,
        {
          loginHref: buildLoginHref(),
          loginLabel: "ログインして購入状態を確認",
          upgradeHref: getPremiumReadyPath(),
          upgradeLabel: "購入前チェックへ進む",
        },
      );
    }
  }

  logoutButton?.addEventListener("click", async () => {
    if (logoutButton) {
      logoutButton.disabled = true;
    }
    try {
      await authClient?.signOut();
    } finally {
      const target = new URL(window.location.pathname, window.location.origin);
      window.location.href = target.toString();
    }
  });

  void refresh();
})();
