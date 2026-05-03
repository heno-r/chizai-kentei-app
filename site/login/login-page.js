(function attachLoginPage() {
    const authClient = window.SiteAuthClient;
    const currentStatus = document.getElementById("login-current-status");
    const statusCopy = document.getElementById("login-status-copy");
    const returnToTarget = document.getElementById("login-return-target");
    const localModeWrap = document.getElementById("login-local-mode");
    const supabaseModeWrap = document.getElementById("login-supabase-mode");
    const freeButton = document.getElementById("login-free-button");
    const premiumButton = document.getElementById("login-premium-button");
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const emailSignInButton = document.getElementById("login-email-signin-button");
    const emailSignUpButton = document.getElementById("login-email-signup-button");
    const logoutButton = document.getElementById("login-logout-button");
    const infoMessage = document.getElementById("login-info-message");
    const supabaseChecklist = document.getElementById("login-supabase-checklist");
    function getReturnToPath() {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get("returnTo");
        if (!raw || !raw.startsWith("/")) {
            return "/app/";
        }
        return raw;
    }
    function showInfo(message) {
        if (!infoMessage) {
            return;
        }
        infoMessage.textContent = message;
        infoMessage.classList.remove("hidden");
    }
    function renderMode() {
        const isSupabase = authClient?.getMode?.() === "supabase";
        localModeWrap?.classList.toggle("hidden", isSupabase);
        supabaseModeWrap?.classList.toggle("hidden", !isSupabase);
        supabaseChecklist?.classList.toggle("hidden", !isSupabase);
    }
    function formatSupabaseError(error, action) {
        const message = error instanceof Error ? error.message : typeof error === "string" ? error : "unknown_error";
        if (message.includes("Email not confirmed")) {
            return "確認メールが必要な設定です。受信メール内のリンクを開いてから、もう一度ログインしてください。";
        }
        if (message.includes("Invalid login credentials")) {
            return "ログインに失敗しました。メールアドレスかパスワードが違う可能性があります。";
        }
        if (message.includes("User already registered")) {
            return "このメールアドレスはすでに登録されています。『メールでログイン』をお試しください。";
        }
        if (message.includes("Password should be at least")) {
            return "パスワードが短すぎます。8文字以上で試してください。";
        }
        if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
            return "Supabase へ接続できませんでした。ログイン設定、起動URL、ネットワーク状態を確認してください。";
        }
        return action === "signup"
            ? "アカウント作成に失敗しました。Email 設定、確認メール設定、入力内容を確認してください。"
            : "ログインに失敗しました。Email 設定、入力内容、確認メールの完了状況を確認してください。";
    }
    function renderStatus(status) {
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
    async function refresh() {
        renderMode();
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
            }
            else if (String(status.source || "").startsWith("secure_api_") || status.source === "secure_api_unavailable") {
                showInfo("ログイン自体は成功しています。いまは会員状態の確認だけ一時的に取れていないため、無料版として続けられる状態で表示しています。");
            }
            renderStatus(status);
        }
        catch (error) {
            console.warn("login page status load failed", error);
            showInfo("購入状態の確認に失敗しました。時間をおいてもう一度お試しください。");
            renderStatus({
                signed_in: false,
                active_plan: "free",
            });
        }
    }
    async function signIn(planKey) {
        if (!authClient) {
            return;
        }
        const status = planKey === "premium" ? await authClient.signInAsPremium() : await authClient.signInAsFree();
        renderStatus(status);
        showInfo(planKey === "premium"
            ? "プレミアム版の状態で続けます。元の画面へ戻ります。"
            : "無料版の状態で続けます。元の画面へ戻ります。");
        window.setTimeout(() => {
            window.location.href = getReturnToPath();
        }, 250);
    }
    async function signInWithEmailPassword() {
        if (!authClient || !emailInput || !passwordInput) {
            return;
        }
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
            showInfo("メールアドレスとパスワードを入力してください。");
            return;
        }
        try {
            const status = await authClient.signInWithEmailPassword(email, password);
            renderStatus(status);
            showInfo(String(status.source || "").startsWith("secure_api_") || status.source === "secure_api_unavailable"
                ? "ログインしました。会員状態の確認はあとで再試行されます。いったん無料版の状態で元の画面へ戻ります。"
                : "ログインしました。元の画面へ戻ります。");
            window.setTimeout(() => {
                window.location.href = getReturnToPath();
            }, 250);
        }
        catch (error) {
            console.warn("email sign in failed", error);
            showInfo(formatSupabaseError(error, "signin"));
        }
    }
    async function signUpWithEmail() {
        if (!authClient || !emailInput || !passwordInput) {
            return;
        }
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
            showInfo("メールアドレスとパスワードを入力してください。");
            return;
        }
        try {
            const result = await authClient.signUpWithEmail(email, password);
            const hasSession = Boolean(result?.session);
            showInfo(hasSession
                ? "アカウントを作成してログインしました。元の画面へ戻ります。"
                : "アカウントを作成しました。確認メールが届く設定の場合は、メール内の案内を確認してください。");
            if (hasSession) {
                const status = await authClient.signInWithEmailPassword(email, password).catch(() => authClient.fetchLicenseStatus());
                renderStatus(status);
                if (String(status.source || "").startsWith("secure_api_") || status.source === "secure_api_unavailable") {
                    showInfo("アカウント作成とログインは成功しました。会員状態の確認はあとで再試行されます。いったん無料版の状態で元の画面へ戻ります。");
                }
                window.setTimeout(() => {
                    window.location.href = getReturnToPath();
                }, 250);
            }
        }
        catch (error) {
            console.warn("email sign up failed", error);
            showInfo(formatSupabaseError(error, "signup"));
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
