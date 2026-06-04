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
  const loginFormMessage = document.getElementById("login-form-message") as HTMLElement | null;
  const passwordResetButton = document.getElementById("login-password-reset-button") as HTMLButtonElement | null;
  const recoveryModeWrap = document.getElementById("login-recovery-mode") as HTMLElement | null;
  const recoveryPasswordInput = document.getElementById("login-recovery-password") as HTMLInputElement | null;
  const recoveryPasswordConfirmInput = document.getElementById("login-recovery-password-confirm") as HTMLInputElement | null;
  const recoverySaveButton = document.getElementById("login-recovery-save-button") as HTMLButtonElement | null;
  const recoveryCancelButton = document.getElementById("login-recovery-cancel-button") as HTMLButtonElement | null;
  const recoveryMessage = document.getElementById("login-recovery-message") as HTMLElement | null;
  const logoutButton = document.getElementById("login-logout-button") as HTMLButtonElement | null;
  const infoMessage = document.getElementById("login-info-message") as HTMLElement | null;
  const supabaseChecklist = document.getElementById("login-supabase-checklist") as HTMLElement | null;
  let authCooldownTimerId = 0;
  let recoveryModeActive = false;

  interface AuthThrottleState {
    failed_attempts: number;
    locked_until: number;
  }

  function formatReturnToLabel(path: string): string {
    if (path.startsWith("/premium/ready/")) {
      return "購入前の確認";
    }
    if (path.startsWith("/premium/")) {
      return "プレミアム版について";
    }
    if (path.startsWith("/app/")) {
      return "学習ページ";
    }
    if (path === "/" || path === "") {
      return "トップページ";
    }
    return path;
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

  function hideInfo(): void {
    if (!infoMessage) {
      return;
    }
    infoMessage.textContent = "";
    infoMessage.classList.add("hidden");
  }

  function showInlineMessage(target: HTMLElement | null, message: string): void {
    if (!target) {
      showInfo(message);
      return;
    }
    target.textContent = message;
    target.classList.remove("hidden");
  }

  function hideInlineMessage(target: HTMLElement | null): void {
    if (!target) {
      return;
    }
    target.textContent = "";
    target.classList.add("hidden");
  }

  function clearInlineMessages(): void {
    hideInlineMessage(loginFormMessage);
    hideInlineMessage(recoveryMessage);
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
    if (passwordResetButton) {
      passwordResetButton.disabled = disabled;
    }
  }

  function setRecoveryButtonsDisabled(disabled: boolean): void {
    if (recoverySaveButton) {
      recoverySaveButton.disabled = disabled;
    }
    if (recoveryCancelButton) {
      recoveryCancelButton.disabled = disabled;
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

  function clearRecoveryTokensFromUrl(): void {
    if (typeof window === "undefined") {
      return;
    }
    const hash = window.location.hash || "";
    if (!hash.includes("access_token=") && !hash.includes("refresh_token=") && !hash.includes("type=recovery")) {
      return;
    }
    const cleanedUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState({}, document.title, cleanedUrl);
  }

  function renderRecoveryMode(enabled: boolean): void {
    recoveryModeActive = enabled;
    supabaseModeWrap?.classList.toggle("hidden", enabled);
    recoveryModeWrap?.classList.toggle("hidden", !enabled);
    supabaseChecklist?.classList.toggle("hidden", enabled);
    clearInlineMessages();
    if (!enabled) {
      recoveryPasswordInput && (recoveryPasswordInput.value = "");
      recoveryPasswordConfirmInput && (recoveryPasswordConfirmInput.value = "");
    }
  }

  function validatePasswordForRecovery(password: string, passwordConfirm: string): string | null {
    if (!password) {
      return "新しいパスワードを入力してください。";
    }
    if (password.length < 10) {
      return "パスワードは10文字以上で設定してください。";
    }
    if (password.length > 200) {
      return "パスワードが長すぎます。200文字以内で入力してください。";
    }
    if (password !== passwordConfirm) {
      return "確認用のパスワードが一致していません。";
    }
    return null;
  }

  function renderMode(): void {
    const mode = authClient?.getMode?.();
    const isSupabase = mode === "supabase";
    const isDisabledRemoteStub = mode === "disabled_remote_stub";
    localModeWrap?.classList.toggle("hidden", isSupabase || isDisabledRemoteStub);
    if (!recoveryModeActive) {
      supabaseModeWrap?.classList.toggle("hidden", !isSupabase);
    }
    supabaseChecklist?.classList.toggle("hidden", !isSupabase || recoveryModeActive);
    if (isDisabledRemoteStub) {
      showInfo("この環境ではメールログインで続けられます。");
    }
  }

  function formatSupabaseError(error: unknown, action: "signin" | "signup" | "reset" | "recovery"): string {
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

    if (action === "reset") {
      return "再設定メールを送信できませんでした。時間をおいてもう一度お試しください。";
    }
    if (action === "recovery") {
      return "新しいパスワードを設定できませんでした。再設定メールの案内からもう一度お試しください。";
    }
    return action === "signup"
      ? "アカウント作成を完了できませんでした。入力内容を確認し、時間をおいてもう一度お試しください。"
      : "ログインに失敗しました。入力内容を確認し、時間をおいてもう一度お試しください。";
  }

  function renderStatus(status: LicenseStatusResponse): void {
    if (returnToTarget) {
      returnToTarget.textContent = formatReturnToLabel(getReturnToPath());
    }

    if (!status.signed_in) {
      if (currentStatus) {
        currentStatus.textContent = "未ログイン";
      }
      if (statusCopy) {
        statusCopy.textContent =
          authClient?.getMode?.() === "supabase"
            ? "ログインすると、購入状況の確認やプレミアム版の利用再開をこのまま続けられます。"
            : "無料版はそのまま使えます。購入後にプレミアム版として続けるときは、ここから確認して次の画面へ進めます。";
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
          ? "プレミアム版を利用できる状態です。このまま元の画面へ戻れば、追加問題とプレミアム機能をそのまま使えます。"
          : status.purchase_state === "in_checkout"
            ? "購入手続きの途中として記録されています。購入前の確認ページへ戻ると、そのまま続きから確認できます。"
            : "ログイン済みです。価格や機能を確認したら、そのまま購入前の確認ページへ進めます。";
    }
    logoutButton?.classList.remove("hidden");
  }

  async function refresh(): Promise<void> {
    renderMode();
    renderAuthCooldown();
    clearInlineMessages();
    if (!authClient) {
      showInfo("ログイン画面の準備がまだ完了していません。時間をおいてもう一度お試しください。");
      renderStatus({
        signed_in: false,
        active_plan: "free",
      });
      return;
    }

    try {
      const isRecoverySession = await authClient.isPasswordRecoverySession();
      if (isRecoverySession) {
        clearRecoveryTokensFromUrl();
        renderRecoveryMode(true);
        if (currentStatus) {
          currentStatus.textContent = "再設定手続き中";
        }
        if (statusCopy) {
          statusCopy.textContent = "新しいパスワードを設定すると、そのまま購入状況の確認や学習の続きへ進めます。";
        }
        showInfo("新しいパスワードを入力してください。設定後はそのまま元の画面へ戻れます。");
        return;
      }
      renderRecoveryMode(false);
      const status = await authClient.fetchLicenseStatus();
      if (status.source === "supabase_config_missing") {
        showInfo("ログインの準備がまだ完了していません。時間をおいてもう一度お試しください。");
      } else if (String(status.source || "").startsWith("secure_api_") || status.source === "secure_api_unavailable") {
        showInfo(
          "ログインは完了しています。購入状況の確認だけ一時的に遅れているため、いったん無料版として表示しています。",
        );
      }
      renderStatus(status);
    } catch (error) {
      console.warn("login page status load failed", error);
      showInfo("購入状況の確認に失敗しました。時間をおいてもう一度お試しください。");
      renderStatus({
        signed_in: false,
        active_plan: "free",
      });
    }
  }

  async function requestPasswordReset(): Promise<void> {
    if (!authClient || !emailInput) {
      return;
    }
    const email = emailInput.value.trim();
    if (!email) {
      hideInfo();
      showInlineMessage(loginFormMessage, "再設定メールを受け取るメールアドレスを入力してください。");
      return;
    }

    hideInlineMessage(loginFormMessage);
    setAuthButtonsDisabled(true);
    setButtonBusy(passwordResetButton, true, "送信中...");
    try {
      await authClient.requestPasswordReset(email, getReturnToPath());
      hideInfo();
      showInlineMessage(loginFormMessage, "再設定メールを送信しました。メールの案内に沿って新しいパスワードを設定してください。");
    } catch (error) {
      console.warn("password reset request failed", error);
      hideInfo();
      showInlineMessage(loginFormMessage, formatSupabaseError(error, "reset"));
    } finally {
      setButtonBusy(passwordResetButton, false);
      if (getRemainingCooldownSeconds() <= 0) {
        setAuthButtonsDisabled(false);
      }
    }
  }

  async function updatePasswordWithRecovery(): Promise<void> {
    if (!authClient || !recoveryPasswordInput || !recoveryPasswordConfirmInput) {
      return;
    }
    const password = recoveryPasswordInput.value;
    const passwordConfirm = recoveryPasswordConfirmInput.value;
    const validationMessage = validatePasswordForRecovery(password, passwordConfirm);
    if (validationMessage) {
      hideInfo();
      showInlineMessage(recoveryMessage, validationMessage);
      return;
    }

    hideInlineMessage(recoveryMessage);
    setRecoveryButtonsDisabled(true);
    setButtonBusy(recoverySaveButton, true, "更新中...");
    try {
      const status = await authClient.updatePasswordWithRecovery(password);
      renderRecoveryMode(false);
      renderMode();
      renderStatus(status);
      showInfo("新しいパスワードを設定しました。元の画面へ戻ります。");
      window.setTimeout(() => {
        window.location.href = getReturnToPath();
      }, 350);
    } catch (error) {
      console.warn("password recovery update failed", error);
      hideInfo();
      showInlineMessage(recoveryMessage, formatSupabaseError(error, "recovery"));
    } finally {
      setButtonBusy(recoverySaveButton, false);
      setRecoveryButtonsDisabled(false);
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
      hideInfo();
      showInlineMessage(loginFormMessage, "メールアドレスとパスワードを入力してください。");
      return;
    }
    hideInlineMessage(loginFormMessage);
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
      hideInfo();
      showInlineMessage(loginFormMessage, formatSupabaseError(error, "signin"));
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
      hideInfo();
      showInlineMessage(loginFormMessage, "メールアドレスとパスワードを入力してください。");
      return;
    }
    hideInlineMessage(loginFormMessage);
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
      hideInfo();
      showInlineMessage(loginFormMessage, formatSupabaseError(error, "signup"));
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

  passwordResetButton?.addEventListener("click", () => {
    void requestPasswordReset();
  });

  recoverySaveButton?.addEventListener("click", () => {
    void updatePasswordWithRecovery();
  });

  recoveryCancelButton?.addEventListener("click", () => {
    renderRecoveryMode(false);
    renderMode();
    showInfo("ログイン画面へ戻りました。再設定メールの案内が必要な場合は、もう一度お試しください。");
  });

  logoutButton?.addEventListener("click", async () => {
    await authClient?.signOut();
    showInfo("ログアウトしました。無料版の状態に戻ります。");
    void refresh();
  });

  void refresh();
})();
