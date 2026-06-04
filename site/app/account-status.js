(function attachAppAccountStatus() {
    const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
    const authClient = window.SiteAuthClient;
    const statusTitle = document.getElementById("account-status-title");
    const statusCopy = document.getElementById("account-status-copy");
    const loginLink = document.getElementById("account-login-link");
    const upgradeLink = document.getElementById("account-upgrade-link");
    const logoutButton = document.getElementById("account-logout-button");
    function getLoginPath() {
        return runtimeConfig.loginPath || "/login/";
    }
    function buildLoginHref() {
        const target = new URL(getLoginPath(), window.location.origin);
        target.searchParams.set("returnTo", `${window.location.pathname}${window.location.search}`);
        return target.toString();
    }
    function getPremiumReadyPath() {
        return runtimeConfig.premiumPurchasePath || "/premium/ready/";
    }
    function getPremiumGuidePath() {
        return runtimeConfig.premiumGuidePath || "/premium/";
    }
    function isPurchaseEnabled() {
        if (runtimeConfig.purchaseEnabled === false) {
            return false;
        }
        if (runtimeConfig.checkoutProvider !== "stripe") {
            return true;
        }
        return Boolean(String(runtimeConfig.stripePublishableKey || "").trim() && String(runtimeConfig.stripePriceId || "").trim());
    }
    function renderMessage(title, copy, signedIn, { loginHref, loginLabel, upgradeHref, upgradeLabel, }) {
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
    function buildSignedInFreeMessage(status) {
        if (status.purchase_state === "refunded") {
            return {
                title: "返金後は無料版に戻っています",
                copy: "返金済みのため、現在は無料版だけ使えます。必要になった場合は、内容を確認してから改めて進められます。",
                upgradeHref: getPremiumGuidePath(),
                upgradeLabel: "プレミアム版の内容を見る",
            };
        }
        if (status.purchase_state === "revoked" || status.purchase_state === "expired") {
            return {
                title: "現在は無料版を利用できます",
                copy: "現在はプレミアム版の利用対象外のため、無料版だけ使えます。必要になった場合は、内容を確認してから改めて進められます。",
                upgradeHref: getPremiumGuidePath(),
                upgradeLabel: "プレミアム版の内容を見る",
            };
        }
        if (status.purchase_state === "cancelled") {
            return {
                title: "前回の購入手続きは完了していません",
                copy: "無料版はそのまま続けられます。必要になった場合は、内容を確認してから購入前の確認へ進めます。",
                upgradeHref: getPremiumReadyPath(),
                upgradeLabel: "購入前の確認へ進む",
            };
        }
        return {
            title: isPurchaseEnabled() ? "次は価格と機能を確認します" : "今はプレミアム版の内容確認まで進めます",
            copy: isPurchaseEnabled()
                ? status.purchase_state === "in_checkout"
                    ? "購入手続きの途中として記録されています。購入前の確認へ戻ると、そのまま続きから確認できます。"
                    : "ログイン済みです。購入前の確認で価格と機能を見たあと、そのまま購入へ進めます。"
                : "ログイン済みです。プレミアム版は、まず内容だけ確認できます。",
            upgradeHref: isPurchaseEnabled() ? getPremiumReadyPath() : getPremiumGuidePath(),
            upgradeLabel: isPurchaseEnabled() ? "購入前の確認へ進む" : "プレミアム版の内容を見る",
        };
    }
    async function refresh() {
        if (!authClient) {
            renderMessage("ログインの準備中です", "いまは無料版をそのまま試せます。ログイン後の購入状況の確認は、時間をおいてもう一度お試しください。", false, {
                loginHref: buildLoginHref(),
                loginLabel: "ログインする",
                upgradeHref: getPremiumReadyPath(),
                upgradeLabel: "次へ進む",
            });
            return;
        }
        try {
            const status = await authClient.fetchLicenseStatus();
            if (status.source === "supabase_config_missing") {
                renderMessage("ログイン設定が未完了です", "ログインの準備がまだ完了していません。時間をおいてもう一度お試しください。", false, {
                    loginHref: buildLoginHref(),
                    loginLabel: "ログインする",
                    upgradeHref: getPremiumReadyPath(),
                    upgradeLabel: "次へ進む",
                });
                return;
            }
            if (!status.signed_in) {
                renderMessage(isPurchaseEnabled() ? "次はログインして進めます" : "今は無料版と内容確認を進められます", isPurchaseEnabled()
                    ? "無料版の使いやすさ確認が済んだら、先にログインしておくと購入前の確認までそのまま進めます。"
                    : "無料版はそのまま使えます。プレミアム版は、まず内容だけ確認できます。", false, {
                    loginHref: buildLoginHref(),
                    loginLabel: "ログインする",
                    upgradeHref: isPurchaseEnabled() ? buildLoginHref() : getPremiumGuidePath(),
                    upgradeLabel: isPurchaseEnabled() ? "ログインして次へ進む" : "プレミアム版の内容を見る",
                });
                return;
            }
            if (status.active_plan === "premium") {
                renderMessage("プレミアム版を利用できる状態です", "準備はできています。このまま学習へ戻れば、追加問題とプレミアム機能をそのまま使えます。", true, {
                    loginHref: buildLoginHref(),
                    loginLabel: "ログイン状態を変更する",
                    upgradeHref: "/app/",
                    upgradeLabel: "プレミアム版で学習を続ける",
                });
                return;
            }
            const freeMessage = buildSignedInFreeMessage(status);
            renderMessage(freeMessage.title, freeMessage.copy, true, {
                loginHref: buildLoginHref(),
                loginLabel: "ログイン状態を変更する",
                upgradeHref: freeMessage.upgradeHref,
                upgradeLabel: freeMessage.upgradeLabel,
            });
        }
        catch (error) {
            console.warn("account status load failed", error);
            renderMessage("購入状況を確認できませんでした", "通信の状況によって購入状況の確認に失敗することがあります。しばらくしてからもう一度お試しください。", false, {
                loginHref: buildLoginHref(),
                loginLabel: "ログインする",
                upgradeHref: getPremiumReadyPath(),
                upgradeLabel: "次へ進む",
            });
        }
    }
    logoutButton?.addEventListener("click", async () => {
        if (logoutButton) {
            logoutButton.disabled = true;
        }
        try {
            await authClient?.signOut();
        }
        finally {
            const target = new URL(window.location.pathname, window.location.origin);
            window.location.href = target.toString();
        }
    });
    void refresh();
})();
