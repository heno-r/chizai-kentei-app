(function attachSiteAuthClient(): void {
  const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
  const STORAGE_KEY = "chizai-site-auth-session-v1";
  const SUPABASE_BROWSER_SDK_URL = "https://esm.sh/@supabase/supabase-js@2";
  const configuredAuthMode = runtimeConfig.authMode || "local_stub";
  const authMode =
    configuredAuthMode !== "supabase" && typeof window !== "undefined" && !["127.0.0.1", "localhost"].includes(window.location?.hostname || "")
      ? "disabled_remote_stub"
      : configuredAuthMode;
  let supabaseClientPromise: Promise<any> | null = null;

  class PublicAuthError extends Error {
    status: number;
    retryAfterSeconds?: number;

    constructor(message: string, status: number, retryAfterSeconds?: number) {
      super(message);
      this.name = "PublicAuthError";
      this.status = status;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }

  function isSupabaseConfigured(): boolean {
    return Boolean(runtimeConfig.supabaseUrl && runtimeConfig.supabasePublishableKey);
  }

  async function getSupabaseClient(): Promise<any | null> {
    if (authMode !== "supabase") {
      return null;
    }
    if (!isSupabaseConfigured()) {
      return null;
    }
    if (!supabaseClientPromise) {
      const importSupabaseModule = new Function("specifier", "return import(specifier);") as (
        specifier: string,
      ) => Promise<any>;
      supabaseClientPromise = importSupabaseModule(SUPABASE_BROWSER_SDK_URL).then((mod) =>
        mod.createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabasePublishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        }),
      );
    }
    return supabaseClientPromise;
  }

  function buildApiUrl(path: string): string {
    const baseUrl = (runtimeConfig.secureApiBaseUrl || "").replace(/\/+$/, "");
    return baseUrl ? `${baseUrl}${path}` : path;
  }

  async function postPublicAuth(path: string, payload: Record<string, unknown>): Promise<any> {
    const response = await fetch(buildApiUrl(path), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    let body: any = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }

    if (!response.ok) {
      throw new PublicAuthError(
        String(body?.error || "ログイン処理に失敗しました。"),
        response.status,
        Number.isFinite(Number(body?.retry_after_seconds)) ? Number(body.retry_after_seconds) : undefined,
      );
    }

    return body;
  }

  function isLocalHostRuntime(): boolean {
    if (typeof window === "undefined" || !window.location?.hostname) {
      return false;
    }
    return ["127.0.0.1", "localhost"].includes(window.location.hostname);
  }

  function buildLocalApiUrl(path: string): string {
    if (typeof window === "undefined" || !window.location?.origin) {
      return path;
    }
    return `${window.location.origin}${path}`;
  }

  async function fetchSecureJsonWithLocalFallback(
    path: string,
    accessToken: string,
    preferLocalOnLocalhost = false,
  ): Promise<any> {
    const requestInit = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store" as RequestCache,
    };

    async function fetchJson(url: string): Promise<any> {
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
      } catch (localError) {
        try {
          return await fetchJson(buildApiUrl(path));
        } catch {
          throw localError;
        }
      }
    }

    try {
      return await fetchJson(buildApiUrl(path));
    } catch (error) {
      if (!isLocalHostRuntime()) {
        throw error;
      }
      return fetchJson(buildLocalApiUrl(path));
    }
  }

  function readSession(): StoredAuthSession | null {
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
    } catch (error) {
      console.warn("site auth session load failed", error);
      return null;
    }
  }

  function writeSession(planKey: "free" | "premium"): StoredAuthSession {
    const session: StoredAuthSession = {
      access_token: planKey === "premium" ? "local-premium-session" : "local-free-session",
      assumed_plan: planKey,
      signed_in_at: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  }

  async function clearSupabaseSession(): Promise<void> {
    const client = await getSupabaseClient();
    if (!client) {
      return;
    }
    await client.auth.signOut();
  }

  function clearLocalSession(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  function buildGuestStatus(source = "guest_local"): LicenseStatusResponse {
    return {
      signed_in: false,
      purchase_state: "not_started",
      active_plan: "free",
      user: null,
      entitlements: [],
      source,
    };
  }

  async function getAccessToken(): Promise<string | null> {
    if (authMode === "supabase") {
      if (!isSupabaseConfigured()) {
        return null;
      }
      const client = await getSupabaseClient();
      if (!client) {
        return null;
      }
      const {
        data: { session },
      } = await client.auth.getSession();
      return session?.access_token || null;
    }
    return readSession()?.access_token || null;
  }

  async function applySupabaseSession(sessionPayload: any): Promise<void> {
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

  async function buildSupabaseSignedInFallback(source = "secure_api_unavailable"): Promise<LicenseStatusResponse> {
    const client = await getSupabaseClient();
    const {
      data: { user },
    } = client ? await client.auth.getUser() : { data: { user: null } };
    return {
      signed_in: true,
      purchase_state: "not_started",
      active_plan: "free",
      user: {
        user_id: user?.id || "supabase-user",
        display_name:
          user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email || "利用者",
      },
      entitlements: [],
      source,
    };
  }

  async function ensureSignedInStatusAfterAuth(source = "supabase_signed_in"): Promise<LicenseStatusResponse> {
    const status = await fetchLicenseStatus();
    if (status.signed_in) {
      return status;
    }
    return buildSupabaseSignedInFallback(source);
  }

  async function fetchLicenseStatus(): Promise<LicenseStatusResponse> {
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
        const {
          data: { user },
        } = client ? await client.auth.getUser() : { data: { user: null } };
        if (user) {
          return buildSupabaseSignedInFallback("supabase_session_syncing");
        }
      }
      return buildGuestStatus(authMode === "supabase" ? "guest_supabase" : "guest_local");
    }

    let response: Response;
    try {
      response = await fetch(buildApiUrl("/api/secure/license/status"), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });
    } catch (error) {
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

    const payload = (await response.json()) as LicenseStatusResponse;
    return {
      ...payload,
      active_plan: payload.active_plan === "premium" ? "premium" : "free",
      entitlements: Array.isArray(payload.entitlements) ? payload.entitlements : [],
    };
  }

  async function postSecure(path: string): Promise<any> {
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
      } catch {
        // ignore json parse failure
      }
      throw new Error(message);
    }
    return response.json();
  }

  async function fetchPremiumManifest(planCode = "grade3_premium"): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("sign in required");
    }
    return fetchSecureJsonWithLocalFallback(
      `/api/secure/premium/manifest?plan_code=${encodeURIComponent(planCode)}`,
      accessToken,
      true,
    );
  }

  async function fetchPremiumQuestions(setId?: string): Promise<any> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("sign in required");
    }
    const suffix = setId ? `?set_id=${encodeURIComponent(setId)}` : "";
    return fetchSecureJsonWithLocalFallback(`/api/secure/premium/questions${suffix}`, accessToken, true);
  }

  async function fetchSecureHealth(): Promise<any> {
    const response = await fetch(buildApiUrl("/api/secure/health"), {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`secure health request failed: ${response.status}`);
    }
    return response.json();
  }

  async function signInAs(planKey: "free" | "premium"): Promise<LicenseStatusResponse> {
    if (authMode === "disabled_remote_stub") {
      throw new Error("local stub sign-in is disabled outside localhost");
    }
    if (authMode === "supabase") {
      return buildGuestStatus("supabase_login_required");
    }
    writeSession(planKey);
    try {
      return await fetchLicenseStatus();
    } catch (error) {
      console.warn("license status fetch after sign-in failed", error);
      return {
        signed_in: true,
        purchase_state: planKey === "premium" ? "entitled" : "not_started",
        active_plan: planKey,
        user: {
          user_id: planKey === "premium" ? "local-premium-user" : "local-free-user",
          display_name: planKey === "premium" ? "プレミアム版ユーザー" : "無料版ユーザー",
        },
        entitlements:
          planKey === "premium"
            ? [{ code: "grade3_premium", status: "active", label: "3級プレミアム版" }]
            : [],
        source: "local_session_fallback",
      };
    }
  }

  async function signUpWithEmail(email: string, password: string): Promise<any> {
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

  async function signInWithEmailPassword(email: string, password: string): Promise<LicenseStatusResponse> {
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

  async function signOut(): Promise<void> {
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
    startCheckout: () => postSecure("/api/secure/billing/checkout/start"),
    completeCheckout: () => postSecure("/api/secure/billing/checkout/complete"),
    signOut,
    getStoredSession: readSession,
  };
})();
