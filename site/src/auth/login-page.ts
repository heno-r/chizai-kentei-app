(function attachLoginPage(): void {
  const authClient = window.SiteAuthClient;
  const AUTH_THROTTLE_STORAGE_KEY = "chizai-login-throttle-v1";
  const LOCAL_FAILURE_COOLDOWNS = [0, 15, 30, 60, 180, 600];
  const currentStatus = document.getElementById("login-current-status") as HTMLElement | null;
  const statusCopy = document.getElementById("login-status-copy") as HTMLElement | null;
  const returnToTarget = document.getElementById("login-return-target") as HTMLElement | null;
  const localModeWrap = document.getElementById("login-local-mode") as HTMLElement | null;
  const supabaseModeWrap = document.getElementById("login-supabase-mode") as HTMLElement | null;
  const freeButton = document.getElementById("login-free-button") as HTMLButtonElement | null;
  const premiumButton = document.getElementById("login-premium-button") as HTMLButtonElement | null;
  const emailInput = document.getElementById("login-email") as HTMLInputElement | null;
  const passwordInput = document.getElementById("login-password") as HTMLInputElement | null;
  const emailSignInButton = document.getElementById("login-email-signin-button") as HTMLButtonElement | null;
  const emailSignUpButton = document.getElementById("login-email-signup-button") as HTMLButtonElement | null;
  const logoutButton = document.getElementById("login-logout-button") as HTMLButtonElement | null;
  const infoMessage = document.getElementById("login-info-message") as HTMLElement | null;
  const supabaseChecklist = document.getElementById("login-supabase-checklist") as HTMLElement | null;
  let authCooldownTimerId = 0;

  interface AuthThrottleState {
    failed_attempts: number;
    locked_until: number;
  }

  function setButtonBusy(button: HTMLButtonElement | null, busy: boolean, busyLabel?: string): void {
    if (!button) {
      return;
    }

    if (busy) {
      if (!button.dataset.defaultLabel) {
        button.dataset.defaultLabel = button.textContent?.trim() || "";
      }
      button.disabled = true;
      button.classList.add("is-busy");
      button.setAttribute("aria-busy", "true");
      if (busyLabel) {
        button.textContent = busyLabel;
      }
      return;
    }

    button.disabled = false;
    button.classList.remove("is-busy");
    button.removeAttribute("aria-busy");
    if (button.dataset.defaultLabel) {
      button.textContent = button.dataset.defaultLabel;
    }
  }

  function getReturnToPath(): string {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("returnTo");
    if (!raw || !raw.startsWith("/")) {
      return "/app/";
    }
    return raw;
  }

  function showInfo(message: string): void {
    if (!infoMessage) {
      return;
    }
    infoMessage.textContent = message;
    infoMessage.classList.remove("hidden");
  }

  function readAuthThrottleState(): AuthThrottleState {
    try {
      const raw = localStorage.getItem(AUTH_THROTTLE_STORAGE_KEY);
      if (!raw) {
        return { failed_attempts: 0, locked_until: 0 };
      }
      const parsed = JSON.parse(raw);
      return {
        failed_attempts: Number(parsed?.failed_attempts || 0),
        locked_until: Number(parsed?.locked_until || 0),
      };
    } catch {
      return { failed_attempts: 0, locked_until: 0 };
    }
  }

  function writeAuthThrottleState(state: AuthThrottleState): void {
    localStorage.setItem(AUTH_THROTTLE_STORAGE_KEY, JSON.stringify(state));
  }

  function clearAuthThrottleState(): void {
    localStorage.removeItem(AUTH_THROTTLE_STORAGE_KEY);
  }

  function getRemainingCooldownSeconds(): number {
    const state = readAuthThrottleState();
    return Math.max(0, Math.ceil((state.locked_until - Date.now()) / 1000));
  }

  function setAuthButtonsDisabled(disabled: boolean): void {
    if (emailSignInButton) {
      emailSignInButton.disabled = disabled;
    }
    if (emailSignUpButton) {
      emailSignUpButton.disabled = disabled;
    }
  }

  function renderAuthCooldown(): void {
    const remaining = getRemainingCooldownSeconds();
    if (remaining > 0) {
      setAuthButtonsDisabled(true);
      showInfo(`試行回数が多いため、あと${remaining}秒ほど待ってからもう一度お試しください。`);
      if (authCooldownTimerId) {
        window.clearTimeout(authCooldownTimerId);
      }
      authCooldownTimerId = window.setTimeout(() => {
        renderAuthCooldown();
      }, 1000);
      return;
    }

    if (authCooldownTimerId) {
      window.clearTimeout(authCooldownTimerId);
      authCooldownTimerId = 0;
    }
    setAuthButtonsDisabled(false);
  }

  function registerLocalAuthFailure(retryAfterSeconds?: number): void {
    const current = readAuthThrottleState();
    const failedAttempts = Math.min(current.failed_attempts + 1, LOCAL_FAILURE_COOLDOWNS.length - 1);
    const localCooldownSeconds =
      retryAfterSeconds && retryAfterSeconds > 0
        ? retryAfterSeconds
        : LOCAL_FAILURE_COOLDOWNS[failedAttempts] || LOCAL_FAILURE_COOLDOWNS[LOCAL_FAILURE_COOLDOWNS.length - 1] || 15;
    writeAuthThrottleState({
      failed_attempts: failedAttempts,
      locked_until: Date.now() + localCooldownSeconds * 1000,
    });
    renderAuthCooldown();
  }

  function clearLocalAuthFailure(): void {
    clearAuthThrottleState();
    renderAuthCooldown();
  }

  function renderMode(): void {
    const mode = authClient?.getMode?.();
    const isSupabase = mode === "supabase";
    const isDisabledRemoteStub = mode === "disabled_remote_stub";
    localModeWrap?.classList.toggle("hidden", isSupabase || isDisabledRemoteStub);
    supabaseModeWrap?.classList.toggle("hidden", !isSupabase);
    supabaseChecklist?.classList.toggle("hidden", !isSupabase);
    if (isDisabledRemoteStub) {
      showInfo("公開環境ではローカル簡易ログインは無効です。Supabase ログインを設定してください。");
    }
  }

  function formatSupabaseError(error: unknown, action: "signin" | "signup"): string {
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    const retryAfterSeconds =
      typeof error === "object" && error && "retryAfterSeconds" in error
        ? Number((error as { retryAfterSeconds?: number }).retryAfterSeconds || 0)
        : 0;

    if (retryAfterSeconds > 0) {
      return `試行回数が多いため、あと${retryAfterSeconds}秒ほど待ってからもう一度お試しください。`;
    }
    if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
      return "接続に失敗しました。時間をおいてもう一度お試しください。";
    }
    if (message) {
      return message;
    }

    return action === "signup"
      ? "アカウント作成を完了できませんでした。入力内容を確認し、時間をおいてもう一度お試しください。"
      : "ログインに失敗しました。入力内容を確認し、時間をおいてもう一度お試しください。";
  }

  function renderStatus(status: LicenseStatusResponse): void {
    if (returnToTarget) {
      returnToTarget.textContent = getReturnToPath();
    }

    if (!status.signed_in) {
      if (currentStatus) {
        currentStatus.textContent = "未ログイン";
      }
      if (statusCopy) {
        statusCopy.textContent =
          authClient?.getMode?.() === "supabase"
            ? "Supabase のメールログインで入ると、購入状態の確認やプレミアム版の解放確認をこのまま続けられます。"
            : "無料版はそのまま使えます。購入後にプレミアム版として続けるときは、ここから状態を確認して次の画面へ進めます。";
      }
      logoutButton?.classList.add("hidden");
      return;
    }

    if (currentStatus) {
      currentStatus.textContent = status.active_plan === "premium" ? "プレミアム版利用中" : "無料版利用中";
    }
    if (statusCopy) {
      statusCopy.textContent =
        status.active_plan === "premium"
          ? "プレミアム版の状態で、購入後の画面導線や解放後の見え方をそのまま確認できます。"
          : status.purchase_state === "in_checkout"
            ? "購入手続き中の状態です。購入前チェックへ戻ると続きの導線を確認できます。"
            : "無料版の状態です。必要なタイミングでプレミアム版の購入前チェックへ進めます。";
    }
    logoutButton?.classList.remove("hidden");
  }

  async function refresh(): Promise<void> {
    renderMode();
    renderAuthCooldown();
    if (!authClient) {
      showInfo("ログイン状態の確認は、公開時にこの画面から続けられる形にします。");
      renderStatus({
        signed_in: false,
        active_plan: "free",
      });
      return;
    }

    try {
      const status = await authClient.fetchLicenseStatus();
      if (status.source === "supabase_config_missing") {
        showInfo("Supabase の設定値がまだ入っていません。runtime-config を確認してください。");
      } else if (String(status.source || "").startsWith("secure_api_") || status.source === "secure_api_unavailable") {
        showInfo(
          "ログイン自体は成功しています。いまは会員状態の確認だけ一時的に取れていないため、無料版として続けられる状態で表示しています。",
        );
      }
      renderStatus(status);
    } catch (error) {
      console.warn("login page status load failed", error);
      showInfo("購入状態の確認に失敗しました。時間をおいてもう一度お試しください。");
      renderStatus({
        signed_in: false,
        active_plan: "free",
      });
    }
  }

  async function signIn(planKey: "free" | "premium"): Promise<void> {
    if (!authClient) {
      return;
    }
    const activeButton = planKey === "premium" ? premiumButton : freeButton;
    const inactiveButton = planKey === "premium" ? freeButton : premiumButton;
    setButtonBusy(activeButton, true, "切り替え中...");
    if (inactiveButton) {
      inactiveButton.disabled = true;
    }
    try {
      const status =
        planKey === "premium" ? await authClient.signInAsPremium() : await authClient.signInAsFree();
      renderStatus(status);
      showInfo(
        planKey === "premium"
          ? "プレミアム版の状態で続けます。元の画面へ戻ります。"
          : "無料版の状態で続けます。元の画面へ戻ります。",
      );
      window.setTimeout(() => {
        window.location.href = getReturnToPath();
      }, 250);
    } catch (error) {
      console.warn("local sign in failed", error);
      showInfo("状態の切り替えに失敗しました。時間をおいてもう一度お試しください。");
    } finally {
      setButtonBusy(activeButton, false);
      if (inactiveButton) {
        inactiveButton.disabled = false;
      }
    }
  }

  async function signInWithEmailPassword(): Promise<void> {
    if (!authClient || !emailInput || !passwordInput) {
      return;
    }
    if (getRemainingCooldownSeconds() > 0) {
      renderAuthCooldown();
      return;
    }
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      showInfo("メールアドレスとパスワードを入力してください。");
      return;
    }
    setAuthButtonsDisabled(true);
    setButtonBusy(emailSignInButton, true, "ログイン中...");
    try {
      const status = await authClient.signInWithEmailPassword(email, password);
      clearLocalAuthFailure();
      renderStatus(status);
      showInfo(
        String(status.source || "").startsWith("secure_api_") || status.source === "secure_api_unavailable"
          ? "ログインしました。会員状態の確認はあとで再試行されます。いったん無料版の状態で元の画面へ戻ります。"
          : "ログインしました。元の画面へ戻ります。",
      );
      window.setTimeout(() => {
        window.location.href = getReturnToPath();
      }, 250);
    } catch (error) {
      console.warn("email sign in failed", error);
      registerLocalAuthFailure(
        typeof error === "object" && error && "retryAfterSeconds" in error
          ? Number((error as { retryAfterSeconds?: number }).retryAfterSeconds || 0)
          : undefined,
      );
      showInfo(formatSupabaseError(error, "signin"));
    } finally {
      setButtonBusy(emailSignInButton, false);
      if (getRemainingCooldownSeconds() <= 0) {
        setAuthButtonsDisabled(false);
      }
    }
  }

  async function signUpWithEmail(): Promise<void> {
    if (!authClient || !emailInput || !passwordInput) {
      return;
    }
    if (getRemainingCooldownSeconds() > 0) {
      renderAuthCooldown();
      return;
    }
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      showInfo("メールアドレスとパスワードを入力してください。");
      return;
    }
    setAuthButtonsDisabled(true);
    setButtonBusy(emailSignUpButton, true, "作成中...");
    try {
      const result = await authClient.signUpWithEmail(email, password);
      const hasSession = Boolean(result?.session);
      clearLocalAuthFailure();
      showInfo(
        hasSession
          ? "アカウントを作成してログインしました。元の画面へ戻ります。"
          : "入力内容を受け付けました。確認メールが届く場合は案内に沿って進めてください。登録済みの場合は、そのままログインをお試しください。",
      );
      if (hasSession) {
        const status = await authClient.fetchLicenseStatus();
        renderStatus(status);
        if (String(status.source || "").startsWith("secure_api_") || status.source === "secure_api_unavailable") {
          showInfo(
            "アカウント作成とログインは成功しました。会員状態の確認はあとで再試行されます。いったん無料版の状態で元の画面へ戻ります。",
          );
        }
        window.setTimeout(() => {
        window.location.href = getReturnToPath();
        }, 250);
      }
    } catch (error) {
      console.warn("email sign up failed", error);
      registerLocalAuthFailure(
        typeof error === "object" && error && "retryAfterSeconds" in error
          ? Number((error as { retryAfterSeconds?: number }).retryAfterSeconds || 0)
          : undefined,
      );
      showInfo(formatSupabaseError(error, "signup"));
    } finally {
      setButtonBusy(emailSignUpButton, false);
      if (getRemainingCooldownSeconds() <= 0) {
        setAuthButtonsDisabled(false);
      }
    }
  }

  freeButton?.addEventListener("click", () => {
    void signIn("free");
  });

  premiumButton?.addEventListener("click", () => {
    void signIn("premium");
  });

  emailSignInButton?.addEventListener("click", () => {
    void signInWithEmailPassword();
  });

  emailSignUpButton?.addEventListener("click", () => {
    void signUpWithEmail();
  });

  logoutButton?.addEventListener("click", async () => {
    await authClient?.signOut();
    showInfo("ログアウトしました。無料版の状態に戻ります。");
    void refresh();
  });

  void refresh();
})();
