(function attachSiteAuthClient() {
    const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
    const STORAGE_KEY = "chizai-site-auth-session-v1";
    const SUPABASE_BROWSER_SDK_URL = "https://esm.sh/@supabase/supabase-js@2";
    const configuredAuthMode = runtimeConfig.authMode || "local_stub";
    const authMode = configuredAuthMode !== "supabase" && typeof window !== "undefined" && !["127.0.0.1", "localhost"].includes(window.location?.hostname || "")
        ? "disabled_remote_stub"
        : configuredAuthMode;
    let supabaseClientPromise = null;
    class PublicAuthError extends Error {
        constructor(message, status, retryAfterSeconds) {
            super(message);
            this.name = "PublicAuthError";
            this.status = status;
            this.retryAfterSeconds = retryAfterSeconds;
        }
    }
    function isSupabaseConfigured() {
        return Boolean(runtimeConfig.supabaseUrl && runtimeConfig.supabasePublishableKey);
    }
    async function getSupabaseClient() {
        if (authMode !== "supabase") {
            return null;
        }
        if (!isSupabaseConfigured()) {
            return null;
        }
        if (!supabaseClientPromise) {
            supabaseClientPromise = import(SUPABASE_BROWSER_SDK_URL).then((mod) => mod.createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                },
            }));
        }
        return supabaseClientPromise;
    }
    function buildApiUrl(path) {
        const baseUrl = (runtimeConfig.secureApiBaseUrl || "").replace(/\/+$/, "");
        return baseUrl ? `${baseUrl}${path}` : path;
    }
    async function postPublicAuth(path, payload) {
        const response = await fetch(buildApiUrl(path), {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify(payload),
        });
        let body = {};
        try {
            body = await response.json();
        }
        catch {
            body = {};
        }
        if (!response.ok) {
            throw new PublicAuthError(String(body?.error || "ログイン処理に失敗しました。"), response.status, Number.isFinite(Number(body?.retry_after_seconds)) ? Number(body.retry_after_seconds) : undefined);
        }
        return body;
    }
    function isLocalHostRuntime() {
        if (typeof window === "undefined" || !window.location?.hostname) {
            return false;
        }
        return ["127.0.0.1", "localhost"].includes(window.location.hostname);
    }
    function buildLocalApiUrl(path) {
        if (typeof window === "undefined" || !window.location?.origin) {
            return path;
        }
        return `${window.location.origin}${path}`;
    }
    async function fetchSecureJsonWithLocalFallback(path, accessToken, preferLocalOnLocalhost = false) {
        const requestInit = {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
        };
        async function fetchJson(url) {
            const response = await fetch(url, requestInit);
            if (!response.ok) {
                throw new Error(`secure request failed: ${response.status}`);
            }
            return response.json();
        }
        const useLocalFirst = preferLocalOnLocalhost && isLocalHostRuntime();
        if (useLocalFirst) {
            try {
                return await fetchJson(buildLocalApiUrl(path));
            }
            catch (localError) {
                try {
                    return await fetchJson(buildApiUrl(path));
                }
                catch {
                    throw localError;
                }
            }
        }
        try {
            return await fetchJson(buildApiUrl(path));
        }
        catch (error) {
            if (!isLocalHostRuntime()) {
                throw error;
            }
            return fetchJson(buildLocalApiUrl(path));
        }
    }
    function readSession() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return null;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed.access_token !== "string") {
                return null;
            }
            return {
                access_token: parsed.access_token,
                assumed_plan: parsed.assumed_plan === "premium" ? "premium" : "free",
                signed_in_at: parsed.signed_in_at || "",
            };
        }
        catch (error) {
            console.warn("site auth session load failed", error);
            return null;
        }
    }
    function writeSession(planKey) {
        const session = {
            access_token: planKey === "premium" ? "local-premium-session" : "local-free-session",
            assumed_plan: planKey,
            signed_in_at: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        return session;
    }
    async function clearSupabaseSession() {
        const client = await getSupabaseClient();
        if (!client) {
            return;
        }
        await client.auth.signOut();
    }
    function clearLocalSession() {
        localStorage.removeItem(STORAGE_KEY);
    }
    function buildGuestStatus(source = "guest_local") {
        return {
            signed_in: false,
            purchase_state: "not_started",
            active_plan: "free",
            user: null,
            entitlements: [],
            source,
        };
    }
    async function getAccessToken() {
        if (authMode === "supabase") {
            if (!isSupabaseConfigured()) {
                return null;
            }
            const client = await getSupabaseClient();
            if (!client) {
                return null;
            }
            const { data: { session }, } = await client.auth.getSession();
            return session?.access_token || null;
        }
        return readSession()?.access_token || null;
    }
    async function applySupabaseSession(sessionPayload) {
        if (authMode !== "supabase" || !sessionPayload?.access_token || !sessionPayload?.refresh_token) {
            return;
        }
        const client = await getSupabaseClient();
        if (!client) {
            throw new Error("supabase client unavailable");
        }
        const { error } = await client.auth.setSession({
            access_token: sessionPayload.access_token,
            refresh_token: sessionPayload.refresh_token,
        });
        if (error) {
            throw error;
        }
    }
    async function buildSupabaseSignedInFallback(source = "secure_api_unavailable") {
        const client = await getSupabaseClient();
        const { data: { user }, } = client ? await client.auth.getUser() : { data: { user: null } };
        return {
            signed_in: true,
            purchase_state: "not_started",
            active_plan: "free",
            user: {
                user_id: user?.id || "supabase-user",
                display_name: user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email || "利用者",
            },
            entitlements: [],
            source,
        };
    }
    async function ensureSignedInStatusAfterAuth(source = "supabase_signed_in") {
        const status = await fetchLicenseStatus();
        if (status.signed_in) {
            return status;
        }
        return buildSupabaseSignedInFallback(source);
    }
    async function fetchLicenseStatus() {
        if (authMode === "disabled_remote_stub") {
            console.warn("local stub auth mode is disabled outside localhost");
            return buildGuestStatus("remote_stub_disabled");
        }
        if (authMode === "supabase" && !isSupabaseConfigured()) {
            console.warn("supabase auth mode is selected, but required config is missing");
            return buildGuestStatus("supabase_config_missing");
        }
        const accessToken = await getAccessToken();
        if (!accessToken) {
            if (authMode === "supabase") {
                const client = await getSupabaseClient();
                const { data: { user }, } = client ? await client.auth.getUser() : { data: { user: null } };
                if (user) {
                    return buildSupabaseSignedInFallback("supabase_session_syncing");
                }
            }
            return buildGuestStatus(authMode === "supabase" ? "guest_supabase" : "guest_local");
        }
        let response;
        try {
            response = await fetch(buildApiUrl("/api/secure/license/status"), {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                cache: "no-store",
            });
        }
        catch (error) {
            if (authMode === "supabase") {
                console.warn("secure API unavailable, use signed-in fallback", error);
                return buildSupabaseSignedInFallback();
            }
            throw error;
        }
        if (!response.ok) {
            if (authMode === "supabase") {
                console.warn(`license status request failed: ${response.status}; use signed-in fallback`);
                return buildSupabaseSignedInFallback(`secure_api_${response.status}`);
            }
            throw new Error(`license status request failed: ${response.status}`);
        }
        const payload = (await response.json());
        return {
            ...payload,
            active_plan: payload.active_plan === "premium" ? "premium" : "free",
            entitlements: Array.isArray(payload.entitlements) ? payload.entitlements : [],
        };
    }
    async function postSecure(path) {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            throw new Error("sign in required");
        }
        const response = await fetch(buildApiUrl(path), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
        });
        if (!response.ok) {
            let message = `secure post failed: ${response.status}`;
            try {
                const payload = await response.json();
                if (payload?.error) {
                    message = String(payload.error);
                }
            }
            catch {
                // ignore json parse failure
            }
            if (message.includes("PUBLIC_SITE_URL is not configured") ||
                message.includes("STRIPE_SECRET_KEY is not configured") ||
                message.includes("STRIPE_PRICE_ID") ||
                message.includes("stripe request failed")) {
                throw new Error("現在は購入受付の準備中です。時間をおいてから、もう一度ご確認ください。");
            }
            throw new Error(message);
        }
        return response.json();
    }
    async function fetchPremiumManifest(planCode = "grade3_premium") {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            throw new Error("sign in required");
        }
        return fetchSecureJsonWithLocalFallback(`/api/secure/premium/manifest?plan_code=${encodeURIComponent(planCode)}`, accessToken, true);
    }
    async function fetchPremiumQuestions(setId) {
        const accessToken = await getAccessToken();
        if (!accessToken) {
            throw new Error("sign in required");
        }
        const suffix = setId ? `?set_id=${encodeURIComponent(setId)}` : "";
        return fetchSecureJsonWithLocalFallback(`/api/secure/premium/questions${suffix}`, accessToken, true);
    }
    async function fetchSecureHealth() {
        const response = await fetch(buildApiUrl("/api/secure/health"), {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(`secure health request failed: ${response.status}`);
        }
        return response.json();
    }
    async function signInAs(planKey) {
        if (authMode === "disabled_remote_stub") {
            throw new Error("local stub sign-in is disabled outside localhost");
        }
        if (authMode === "supabase") {
            return buildGuestStatus("supabase_login_required");
        }
        writeSession(planKey);
        try {
            return await fetchLicenseStatus();
        }
        catch (error) {
            console.warn("license status fetch after sign-in failed", error);
            return {
                signed_in: true,
                purchase_state: planKey === "premium" ? "entitled" : "not_started",
                active_plan: planKey,
                user: {
                    user_id: planKey === "premium" ? "local-premium-user" : "local-free-user",
                    display_name: planKey === "premium" ? "プレミアム版ユーザー" : "無料版ユーザー",
                },
                entitlements: planKey === "premium"
                    ? [{ code: "grade3_premium", status: "active", label: "3級プレミアム版" }]
                    : [],
                source: "local_session_fallback",
            };
        }
    }
    async function signUpWithEmail(email, password) {
        if (authMode !== "supabase") {
            throw new Error("sign up is only available in supabase mode");
        }
        const result = await postPublicAuth("/api/public/auth/signup", {
            email,
            password,
        });
        if (result?.session) {
            await applySupabaseSession(result.session);
        }
        return result;
    }
    async function requestPasswordReset(email) {
        if (authMode !== "supabase") {
            throw new Error("password reset is only available in supabase mode");
        }
        return postPublicAuth("/api/public/auth/password-reset", {
            email,
        });
    }
    async function signInWithEmailPassword(email, password) {
        if (authMode !== "supabase") {
            throw new Error("email sign in is only available in supabase mode");
        }
        const result = await postPublicAuth("/api/public/auth/signin", {
            email,
            password,
        });
        if (result?.session) {
            await applySupabaseSession(result.session);
        }
        return ensureSignedInStatusAfterAuth("supabase_signin_completed");
    }
    async function isPasswordRecoverySession() {
        if (authMode !== "supabase" || !isSupabaseConfigured()) {
            return false;
        }
        if (typeof window === "undefined") {
            return false;
        }
        const recoveryHint = `${window.location.search}${window.location.hash}`;
        if (!recoveryHint.includes("type=recovery") && !recoveryHint.includes("access_token=")) {
            return false;
        }
        const client = await getSupabaseClient();
        if (!client) {
            return false;
        }
        const { data: { session }, } = await client.auth.getSession();
        return Boolean(session?.access_token);
    }
    async function updatePasswordWithRecovery(password) {
        if (authMode !== "supabase") {
            throw new Error("password update is only available in supabase mode");
        }
        const client = await getSupabaseClient();
        if (!client) {
            throw new Error("login client unavailable");
        }
        const { error } = await client.auth.updateUser({
            password,
        });
        if (error) {
            throw error;
        }
        return ensureSignedInStatusAfterAuth("supabase_password_updated");
    }
    async function signOut() {
        clearLocalSession();
        if (authMode === "supabase") {
            await clearSupabaseSession();
        }
    }
    window.SiteAuthClient = {
        getMode: () => authMode,
        isSupabaseConfigured,
        fetchLicenseStatus,
        fetchSecureHealth,
        fetchPremiumManifest,
        fetchPremiumQuestions,
        signInAsFree: () => signInAs("free"),
        signInAsPremium: () => signInAs("premium"),
        signUpWithEmail,
        signInWithEmailPassword,
        requestPasswordReset,
        isPasswordRecoverySession,
        updatePasswordWithRecovery,
        startCheckout: () => postSecure("/api/secure/billing/checkout/start"),
        completeCheckout: () => postSecure("/api/secure/billing/checkout/complete"),
        signOut,
        getStoredSession: readSession,
    };
})();
