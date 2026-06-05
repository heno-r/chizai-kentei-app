type PurchaseState =
  | "not_started"
  | "in_checkout"
  | "paid_pending_entitlement"
  | "entitled"
  | "refunded"
  | "cancelled"
  | "expired"
  | "revoked";
type ActivePlan = "free" | "premium";

interface Env {
  LICENSE_DB: D1Database;
  PREMIUM_CONTENT: R2Bucket;
  SUPABASE_PROJECT_URL: string;
  SUPABASE_JWKS_URL: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_EXPECTED_AUDIENCE?: string;
  PREMIUM_PLAN_CODE?: string;
  PREMIUM_PRODUCT_CODE?: string;
  PREMIUM_PRICE_JPY?: string;
  APP_ENTRY_PATH?: string;
  PREMIUM_PLAN_REGISTRY_JSON?: string;
  STRIPE_PRICE_ID?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRODUCT_NAME?: string;
  PUBLIC_SITE_URL?: string;
  PURCHASE_ENABLED?: string;
  ADMIN_API_TOKEN?: string;
}

interface JwtClaims {
  sub: string;
  exp?: number;
  aud?: string | string[];
  iss?: string;
  email?: string;
  user_metadata?: {
    display_name?: string;
    name?: string;
  };
}

interface SupabaseUserResponse {
  id: string;
  email?: string;
  user_metadata?: {
    display_name?: string;
    name?: string;
  };
}

interface AuthContext {
  authUserId: string;
  email: string;
  displayName: string;
  claims: JwtClaims;
}

interface PremiumPlanRegistry {
  plans?: Record<string, PremiumPlanConfig>;
}

interface PremiumPlanConfig {
  label?: string;
  recommended_entry_path?: string;
  base_public_set_id?: string;
  merge_strategy?: string;
  checkout_product_code?: string;
  price_jpy?: number;
  question_sets?: Array<{
    set_id: string;
    delivery_mode?: string;
  }>;
  unlocked_features?: string[];
}

interface UserRow {
  id: string;
  auth_user_id: string;
  display_name: string;
}

interface BillingCatalogRow {
  product_code: string;
  stripe_product_id: string;
  stripe_price_id: string;
  amount_jpy: number;
  currency: string;
}

interface StripeProductResponse {
  id: string;
  default_price?: string | { id?: string } | null;
  name?: string;
}

interface StripePriceResponse {
  id: string;
  unit_amount?: number | null;
  currency?: string;
  product?: string | { id?: string } | null;
}

interface StripeCheckoutSessionResponse {
  id: string;
  url?: string;
  payment_intent?: string | null;
  amount_total?: number | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
  status?: string;
}

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

interface StripeErrorPayload {
  error?: {
    message?: string;
  };
}

interface ContactRequestPayload {
  name?: string;
  reply_email?: string;
  message?: string;
  source_page?: string;
}

interface AuthCredentialPayload {
  email?: string;
  password?: string;
  return_to?: string;
}

interface AuthAttemptBucket {
  bucket_key: string;
  action: string;
  attempt_count: number;
  blocked_until: string | null;
  last_attempt_at: string;
}

interface AuthRateLimitPolicy {
  action: "signin" | "signup" | "password_reset";
  windowMinutes: number;
  blockMinutes: number;
  maxAttemptsPerIp: number;
  maxAttemptsPerEmail: number;
  maxAttemptsPerIpEmail: number;
}

type ContactMessageStatus = "new" | "in_progress" | "done";

const DEFAULT_UNLOCKED_FEATURES = [
  "category_mode",
  "retry_wrong",
  "weak_category_analysis",
  "flagged_queue",
  "today_recommendation",
  "final14_mode",
  "study_plan",
  "detailed_history",
];

const AUTH_MIN_PASSWORD_LENGTH = 10;
const AUTH_MIN_RESPONSE_MS = 900;

const SIGNIN_RATE_LIMIT_POLICY: AuthRateLimitPolicy = {
  action: "signin",
  windowMinutes: 15,
  blockMinutes: 30,
  maxAttemptsPerIp: 20,
  maxAttemptsPerEmail: 8,
  maxAttemptsPerIpEmail: 5,
};

const SIGNUP_RATE_LIMIT_POLICY: AuthRateLimitPolicy = {
  action: "signup",
  windowMinutes: 30,
  blockMinutes: 60,
  maxAttemptsPerIp: 10,
  maxAttemptsPerEmail: 4,
  maxAttemptsPerIpEmail: 3,
};

const PASSWORD_RESET_RATE_LIMIT_POLICY: AuthRateLimitPolicy = {
  action: "password_reset",
  windowMinutes: 30,
  blockMinutes: 60,
  maxAttemptsPerIp: 8,
  maxAttemptsPerEmail: 4,
  maxAttemptsPerIpEmail: 3,
};

const ALLOWED_CONTACT_STATUSES = new Set<ContactMessageStatus>(["new", "in_progress", "done"]);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return withCors(
          request,
          new Response(null, {
            status: 204,
            headers: {
              "access-control-max-age": "86400",
              "access-control-allow-headers":
                request.headers.get("Access-Control-Request-Headers") ||
                "authorization, content-type, apikey, x-client-info",
              "access-control-allow-private-network":
                request.headers.get("Access-Control-Request-Private-Network") === "true" ? "true" : "false",
            },
          }),
        );
      }

      if (url.pathname === "/api/secure/health") {
        return jsonResponse(request, {
          ok: true,
          service: "secure_api_worker",
          timestamp: new Date().toISOString(),
        });
      }

      if (request.method === "GET" && url.pathname === "/api/public/catalog") {
        const activePlan = url.searchParams.get("plan") || "free";
        const sets = await buildPublicCatalog(env, activePlan);
        return jsonResponse(request, { sets });
      }

      if (request.method === "GET" && url.pathname === "/api/public/questions") {
        const activePlan = url.searchParams.get("plan") || "free";
        const setId = url.searchParams.get("set_id");
        try {
          const payload = await buildPublicQuestionPayload(env, setId, activePlan);
          return jsonResponse(request, payload);
        } catch (error) {
          return jsonResponse(
            request,
            { error: error instanceof Error ? error.message : "not_found" },
            404,
          );
        }
      }

      if (request.method === "POST" && url.pathname === "/api/public/auth/signin") {
        const startedAt = Date.now();
        const payload = (await request.json()) as AuthCredentialPayload;
        const email = normalizeEmail(String(payload?.email || ""));
        const password = String(payload?.password || "");

        if (!isValidEmail(email) || !password) {
          await ensureMinimumResponseDuration(startedAt);
          return jsonResponse(request, { error: "入力内容を確認して、もう一度お試しください。" }, 400);
        }

        const limiterResponse = await consumeAuthAttempt(env, request, SIGNIN_RATE_LIMIT_POLICY, email);
        if (limiterResponse) {
          await ensureMinimumResponseDuration(startedAt);
          return limiterResponse;
        }

        const supabaseResponse = await postSupabaseAuthJson(env, "/auth/v1/token?grant_type=password", {
          email,
          password,
        });

        if (!supabaseResponse.ok) {
          await ensureMinimumResponseDuration(startedAt);
          return jsonResponse(
            request,
            { error: "メールアドレスまたはパスワードを確認して、しばらくしてからもう一度お試しください。" },
            401,
          );
        }

        const sessionPayload = (await supabaseResponse.json()) as Record<string, unknown>;
        await clearAuthAttempts(env, request, SIGNIN_RATE_LIMIT_POLICY, email);
        await ensureMinimumResponseDuration(startedAt);
        return jsonResponse(request, {
          ok: true,
          session: buildSupabaseSessionPayload(sessionPayload),
          user: buildSupabaseUserPayload(sessionPayload),
        });
      }

      if (request.method === "POST" && url.pathname === "/api/public/auth/signup") {
        const startedAt = Date.now();
        const payload = (await request.json()) as AuthCredentialPayload;
        const email = normalizeEmail(String(payload?.email || ""));
        const password = String(payload?.password || "");
        const passwordError = validatePasswordForSignup(password);

        if (!isValidEmail(email)) {
          await ensureMinimumResponseDuration(startedAt);
          return jsonResponse(request, { error: "入力内容を確認して、もう一度お試しください。" }, 400);
        }
        if (passwordError) {
          await ensureMinimumResponseDuration(startedAt);
          return jsonResponse(request, { error: passwordError }, 400);
        }

        const limiterResponse = await consumeAuthAttempt(env, request, SIGNUP_RATE_LIMIT_POLICY, email);
        if (limiterResponse) {
          await ensureMinimumResponseDuration(startedAt);
          return limiterResponse;
        }

        const redirectTo = buildLoginReturnUrl(request, env);
        const supabaseResponse = await postSupabaseAuthJson(env, "/auth/v1/signup", {
          email,
          password,
          email_redirect_to: redirectTo,
        });

        const payloadJson = await safeReadJsonRecord(supabaseResponse);
        if (!supabaseResponse.ok) {
          const message = String(payloadJson?.msg || payloadJson?.error_description || payloadJson?.error || "");
          if (isExistingAccountSignupResponse(message)) {
            await ensureMinimumResponseDuration(startedAt);
            return jsonResponse(request, {
              ok: true,
              accepted: true,
              needs_confirmation: true,
            });
          }
          await ensureMinimumResponseDuration(startedAt);
          return jsonResponse(
            request,
            { error: "アカウント作成を受け付けられませんでした。時間をおいてもう一度お試しください。" },
            400,
          );
        }

        const hasSession = Boolean(payloadJson?.access_token && payloadJson?.refresh_token);
        if (hasSession) {
          await clearAuthAttempts(env, request, SIGNUP_RATE_LIMIT_POLICY, email);
        }
        await ensureMinimumResponseDuration(startedAt);
        return jsonResponse(request, {
          ok: true,
          accepted: true,
          needs_confirmation: !hasSession,
          session: hasSession ? buildSupabaseSessionPayload(payloadJson) : null,
          user: hasSession ? buildSupabaseUserPayload(payloadJson) : null,
        });
      }

      if (request.method === "POST" && url.pathname === "/api/public/auth/password-reset") {
        const startedAt = Date.now();
        const payload = (await request.json()) as AuthCredentialPayload;
        const email = normalizeEmail(String(payload?.email || ""));
        const returnToPath = String(payload?.return_to || "");

        if (!isValidEmail(email)) {
          await ensureMinimumResponseDuration(startedAt);
          return jsonResponse(request, { error: "メールアドレスを確認して、もう一度お試しください。" }, 400);
        }

        const limiterResponse = await consumeAuthAttempt(env, request, PASSWORD_RESET_RATE_LIMIT_POLICY, email);
        if (limiterResponse) {
          await ensureMinimumResponseDuration(startedAt);
          return limiterResponse;
        }

        const redirectTo = buildLoginReturnUrl(request, env, returnToPath);
        const supabaseResponse = await postSupabaseAuthJson(env, "/auth/v1/recover", {
          email,
          redirect_to: redirectTo,
        });

        if (!supabaseResponse.ok) {
          await ensureMinimumResponseDuration(startedAt);
          return jsonResponse(
            request,
            { error: "再設定メールを送信できませんでした。時間をおいてもう一度お試しください。" },
            400,
          );
        }

        await ensureMinimumResponseDuration(startedAt);
        return jsonResponse(request, {
          ok: true,
          accepted: true,
        });
      }

      if (request.method === "GET" && url.pathname === "/api/secure/admin/contact-messages") {
        const adminResponse = requireAdminToken(request, env);
        if (adminResponse instanceof Response) {
          return adminResponse;
        }

        const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
        const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(200, requestedLimit)) : 50;
        const statusParam = String(url.searchParams.get("status") || "").trim();
        const searchText = String(url.searchParams.get("q") || "").trim();
        const messageId = String(url.searchParams.get("id") || "").trim();
        const sqlParams: Array<string | number> = [];
        const whereClauses: string[] = [];

        if (messageId) {
          whereClauses.push("id = ?");
          sqlParams.push(messageId);
        }

        if (statusParam) {
          if (!ALLOWED_CONTACT_STATUSES.has(statusParam as ContactMessageStatus)) {
            return jsonResponse(request, { error: "status must be one of new, in_progress, done" }, 400);
          }
          whereClauses.push("status = ?");
          sqlParams.push(statusParam);
        }

        if (searchText) {
          const likeValue = `%${escapeSqlLikePattern(searchText)}%`;
          whereClauses.push(
            "(message LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR reply_email LIKE ? ESCAPE '\\' OR source_page LIKE ? ESCAPE '\\')",
          );
          sqlParams.push(likeValue, likeValue, likeValue, likeValue);
        }

        const query = `
          SELECT
            id,
            name,
            reply_email,
            message,
            status,
            source_page,
            user_agent,
            created_at,
            updated_at
          FROM contact_messages
          ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
          ORDER BY created_at DESC
          LIMIT ?
          `;
        sqlParams.push(limit);

        const result = await env.LICENSE_DB.prepare(query)
          .bind(...sqlParams)
          .all<Record<string, unknown>>();

        return jsonResponse(request, {
          ok: true,
          messages: result.results ?? [],
          count: (result.results ?? []).length,
          filters: {
            limit,
            status: statusParam || null,
            q: searchText || null,
            id: messageId || null,
          },
        });
      }

      if (request.method === "POST" && url.pathname === "/api/secure/admin/contact-messages/status") {
        const adminResponse = requireAdminToken(request, env);
        if (adminResponse instanceof Response) {
          return adminResponse;
        }

        const payload = (await request.json()) as Record<string, unknown>;
        const messageId = String(payload?.id || "").trim();
        const status = String(payload?.status || "").trim();

        if (!messageId) {
          return jsonResponse(request, { error: "id is required" }, 400);
        }
        if (!ALLOWED_CONTACT_STATUSES.has(status as ContactMessageStatus)) {
          return jsonResponse(request, { error: "status must be one of new, in_progress, done" }, 400);
        }

        const updateResult = (await env.LICENSE_DB.prepare(
          `
          UPDATE contact_messages
          SET status = ?, updated_at = datetime('now')
          WHERE id = ?
          `,
        )
          .bind(status, messageId)
          .run()) as { meta?: { changes?: number } };

        const changed = Number(updateResult.meta?.changes ?? 0);
        if (changed < 1) {
          return jsonResponse(request, { error: "contact message not found" }, 404);
        }

        const row = await env.LICENSE_DB.prepare(
          `
          SELECT
            id,
            name,
            reply_email,
            message,
            status,
            source_page,
            user_agent,
            created_at,
            updated_at
          FROM contact_messages
          WHERE id = ?
          `,
        )
          .bind(messageId)
          .first<Record<string, unknown>>();

        return jsonResponse(request, {
          ok: true,
          message: row ?? null,
        });
      }

      if (request.method === "GET" && url.pathname === "/api/secure/license/status") {
        const auth = await requireAuth(request, env, ctx);
        if (auth instanceof Response) {
          return auth;
        }
        const user = await upsertUserAndGetRow(env, auth);
        const status = await buildLicenseStatus(env, auth, user);
        return jsonResponse(request, status);
      }

      if (request.method === "GET" && url.pathname === "/api/secure/premium/manifest") {
        const auth = await requireAuth(request, env, ctx);
        if (auth instanceof Response) {
          return auth;
        }
        const user = await upsertUserAndGetRow(env, auth);
        const status = await buildLicenseStatus(env, auth, user);
        if (status.active_plan !== "premium") {
          return jsonResponse(
            request,
            {
              error: "premium access required",
              signed_in: true,
              active_plan: status.active_plan,
            },
            403,
          );
        }

        const planCode = url.searchParams.get("plan_code") || env.PREMIUM_PLAN_CODE || "grade3_premium";
        const manifest = await buildPremiumManifest(env, planCode);
        return jsonResponse(request, {
          plan_code: planCode,
          active_plan: "premium",
          ...manifest,
        });
      }

      if (request.method === "GET" && url.pathname === "/api/secure/premium/questions") {
        const auth = await requireAuth(request, env, ctx);
        if (auth instanceof Response) {
          return auth;
        }
        const user = await upsertUserAndGetRow(env, auth);
        const status = await buildLicenseStatus(env, auth, user);
        if (status.active_plan !== "premium") {
          return jsonResponse(request, { error: "premium access required" }, 403);
        }

        const planCode = url.searchParams.get("plan_code") || env.PREMIUM_PLAN_CODE || "grade3_premium";
        const setId = url.searchParams.get("set_id");
        const manifest = await buildPremiumManifest(env, planCode);
        const registeredSetIds = manifest.question_sets.map((item) => String(item.set_id));
        if (!setId) {
          return jsonResponse(request, { error: "set_id is required" }, 400);
        }
        if (registeredSetIds.length > 0 && !registeredSetIds.includes(setId)) {
          return jsonResponse(request, { error: `Premium question set not allowed: ${setId}` }, 404);
        }

        const object = await env.PREMIUM_CONTENT.get(`premium-questions/${setId}.json`);
        if (!object) {
          return jsonResponse(request, { error: `Premium question set not found: ${setId}` }, 404);
        }

        const payload = await object.json<unknown>();
        return jsonResponse(request, payload);
      }

      if (request.method === "POST" && url.pathname === "/api/public/contact") {
        const payload = (await request.json()) as ContactRequestPayload;
        const name = String(payload?.name || "").trim();
        const replyEmail = String(payload?.reply_email || "").trim();
        const message = String(payload?.message || "").trim();
        const sourcePage = String(payload?.source_page || "").trim();

        if (!name || !replyEmail || !message) {
          return jsonResponse(request, { error: "name, reply_email, and message are required" }, 400);
        }
        if (!isValidEmail(replyEmail)) {
          return jsonResponse(request, { error: "reply_email is invalid" }, 400);
        }
        if (name.length > 80) {
          return jsonResponse(request, { error: "name is too long" }, 400);
        }
        if (message.length < 10 || message.length > 4000) {
          return jsonResponse(request, { error: "message length must be between 10 and 4000 characters" }, 400);
        }

        await env.LICENSE_DB.prepare(
          `
          INSERT INTO contact_messages (
            id, name, reply_email, message, status, source_page, user_agent, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, 'new', ?, ?, datetime('now'), datetime('now'))
          `,
        )
          .bind(
            crypto.randomUUID().replaceAll("-", ""),
            name,
            replyEmail,
            message,
            sourcePage,
            request.headers.get("user-agent") || "",
          )
          .run();

        return jsonResponse(request, {
          ok: true,
          received: true,
          status: "new",
        });
      }

      if (request.method === "POST" && url.pathname === "/api/secure/billing/checkout/start") {
        if (!isPurchaseEnabled(env)) {
          return jsonResponse(
            request,
            {
              error: "purchases are temporarily disabled",
              purchase_enabled: false,
            },
            403,
          );
        }

        const auth = await requireAuth(request, env, ctx);
        if (auth instanceof Response) {
          return auth;
        }

        const planCode = env.PREMIUM_PLAN_CODE || "grade3_premium";
        const planConfig = getPremiumPlanConfig(env, planCode);
        const productCode = planConfig.checkout_product_code || env.PREMIUM_PRODUCT_CODE || planCode;
        const user = await upsertUserAndGetRow(env, auth);
        const status = await buildLicenseStatus(env, auth, user);
        if (status.active_plan === "premium") {
          return jsonResponse(request, {
            checkout_provider: "stripe",
            purchase_state: "entitled",
            product_code: productCode,
            checkout_url: buildAppReturnUrl(request, env, planConfig.recommended_entry_path || env.APP_ENTRY_PATH || "/app/"),
            note: "already_entitled",
          });
        }

        const billingCatalog = await ensureBillingCatalog(env, planCode, productCode);
        const checkoutUrls = buildCheckoutUrls(
          request,
          env,
          planConfig.recommended_entry_path || env.APP_ENTRY_PATH || "/app/",
        );
        const checkoutSession = await createStripeCheckoutSession(env, {
          priceId: billingCatalog.stripe_price_id,
          authUserId: auth.authUserId,
          planCode,
          productCode,
          successUrl: checkoutUrls.successUrl,
          cancelUrl: checkoutUrls.cancelUrl,
        });

        await env.LICENSE_DB.prepare(
          `
          INSERT INTO orders (
            id, user_id, product_code, price_jpy, currency, payment_provider,
            provider_checkout_id, provider_payment_id, order_status, purchased_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, 'stripe', ?, NULL, 'pending', NULL, datetime('now'), datetime('now'))
          `,
        )
          .bind(
            crypto.randomUUID().replaceAll("-", ""),
            user.id,
            productCode,
            billingCatalog.amount_jpy,
            billingCatalog.currency.toUpperCase(),
            checkoutSession.id,
          )
          .run();

        return jsonResponse(request, {
          checkout_provider: "stripe",
          checkout_id: checkoutSession.id,
          checkout_url: checkoutSession.url || checkoutUrls.cancelUrl,
          purchase_state: "in_checkout",
          product_code: productCode,
          price_jpy: billingCatalog.amount_jpy,
          stripe_price_id: billingCatalog.stripe_price_id,
        });
      }

      if (request.method === "POST" && url.pathname === "/api/secure/billing/checkout/complete") {
        const auth = await requireAuth(request, env, ctx);
        if (auth instanceof Response) {
          return auth;
        }

        const planCode = env.PREMIUM_PLAN_CODE || "grade3_premium";
        const planConfig = getPremiumPlanConfig(env, planCode);
        const productCode = planConfig.checkout_product_code || env.PREMIUM_PRODUCT_CODE || planCode;
        const user = await upsertUserAndGetRow(env, auth);
        const orderId = crypto.randomUUID().replaceAll("-", "");

        await env.LICENSE_DB.prepare(
          `
          INSERT INTO orders (
            id, user_id, product_code, price_jpy, currency, payment_provider,
            provider_checkout_id, provider_payment_id, order_status, purchased_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, 'JPY', 'manual', ?, ?, 'paid', datetime('now'), datetime('now'), datetime('now'))
          `,
        )
          .bind(
            orderId,
            user.id,
            productCode,
            Number(env.PREMIUM_PRICE_JPY || String(planConfig.price_jpy || 1200)),
            `manual-${orderId}`,
            `manual-payment-${orderId}`,
          )
          .run();

        await grantPremiumEntitlement(env, {
          userId: user.id,
          productCode,
          planCode: "premium",
          scopeType: "plan",
          scopeId: planCode,
          sourceOrderId: orderId,
        });

        const status = await buildLicenseStatus(env, auth, user);
        return jsonResponse(request, status);
      }

      if (request.method === "POST" && url.pathname === "/api/secure/billing/webhook") {
        const payload = await request.text();
        const signature = request.headers.get("Stripe-Signature") || "";
        if (!env.STRIPE_WEBHOOK_SECRET) {
          return jsonResponse(request, { error: "missing webhook secret" }, 500);
        }

        try {
          await verifyStripeWebhookSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
        } catch (error) {
          return jsonResponse(request, { error: error instanceof Error ? error.message : "invalid signature" }, 400);
        }

        const event = JSON.parse(payload) as StripeWebhookEvent;
        if (event.type === "checkout.session.completed") {
          await handleCheckoutCompleted(env, event);
        } else if (event.type === "checkout.session.expired") {
          await handleCheckoutExpired(env, event);
        }

        return jsonResponse(request, { received: true, event_type: event.type });
      }

      return jsonResponse(request, { error: "not_found" }, 404);
    } catch (error) {
      return jsonResponse(
        request,
        {
          error: error instanceof Error ? error.message : "unexpected worker error",
        },
        500,
      );
    }
  },
};

function jsonResponse(request: Request, payload: unknown, status = 200): Response {
  return withCors(
    request,
    new Response(JSON.stringify(payload, null, 2), {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }),
  );
}

function requireAdminToken(request: Request, env: Env): true | Response {
  const configuredToken = (env.ADMIN_API_TOKEN || "").trim();
  if (!configuredToken) {
    return jsonResponse(request, { error: "admin access is not configured" }, 503);
  }

  const providedToken = (request.headers.get("x-admin-token") || "").trim();
  if (!providedToken || !timingSafeEqual(providedToken, configuredToken)) {
    return jsonResponse(request, { error: "admin token is invalid" }, 403);
  }

  return true;
}

function withCors(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  const allowedOrigin = resolveAllowedCorsOrigin(request);
  if (allowedOrigin) {
    headers.set("access-control-allow-origin", allowedOrigin);
  }
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set(
    "access-control-allow-headers",
    request.headers.get("Access-Control-Request-Headers") || "authorization, content-type, apikey, x-client-info",
  );
  headers.set("access-control-expose-headers", "content-type");
  headers.set("vary", "origin, access-control-request-headers");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "same-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function resolveAllowedCorsOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return null;
  }
  if (!/^https?:\/\//.test(origin)) {
    return null;
  }
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const allowedOrigins = new Set<string>(["http://127.0.0.1:8780", "http://localhost:8780"]);
  if (normalizedOrigin.endsWith(".pages.dev")) {
    allowedOrigins.add(normalizedOrigin);
  }
  return allowedOrigins.has(normalizedOrigin) ? normalizedOrigin : null;
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

function readBearerToken(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function escapeSqlLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function validatePasswordForSignup(password: string): string | null {
  if (password.length < AUTH_MIN_PASSWORD_LENGTH) {
    return `パスワードは${AUTH_MIN_PASSWORD_LENGTH}文字以上で設定してください。`;
  }
  if (password.length > 200) {
    return "パスワードが長すぎます。200文字以内で入力してください。";
  }
  return null;
}

function isPurchaseEnabled(env: Env): boolean {
  return !["0", "false", "off"].includes(String(env.PURCHASE_ENABLED || "true").toLowerCase());
}

async function ensureAuthAttemptTable(env: Env): Promise<void> {
  await env.LICENSE_DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS auth_attempt_buckets (
      bucket_key TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      attempt_count INTEGER NOT NULL,
      blocked_until TEXT,
      last_attempt_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
    `,
  ).run();
  await env.LICENSE_DB.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_auth_attempt_buckets_action_updated
      ON auth_attempt_buckets(action, updated_at DESC)
    `,
  ).run();
}

async function consumeAuthAttempt(
  env: Env,
  request: Request,
  policy: AuthRateLimitPolicy,
  email: string,
): Promise<Response | null> {
  await ensureAuthAttemptTable(env);

  const clientIp = getClientIpAddress(request);
  const now = new Date();
  const bucketDefinitions = [
    {
      bucketKey: `${policy.action}:ip:${clientIp}`,
      limit: policy.maxAttemptsPerIp,
    },
    {
      bucketKey: `${policy.action}:email:${email}`,
      limit: policy.maxAttemptsPerEmail,
    },
    {
      bucketKey: `${policy.action}:ip-email:${clientIp}:${email}`,
      limit: policy.maxAttemptsPerIpEmail,
    },
  ];

  for (const definition of bucketDefinitions) {
    const existing = await env.LICENSE_DB.prepare(
      `
      SELECT bucket_key, action, attempt_count, blocked_until, last_attempt_at
      FROM auth_attempt_buckets
      WHERE bucket_key = ?
      LIMIT 1
      `,
    )
      .bind(definition.bucketKey)
      .first<AuthAttemptBucket>();

    const blockedUntil = parseStoredDate(existing?.blocked_until);
    if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
      const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000));
      return jsonResponse(
        request,
        {
          error: "試行回数が多いため、しばらく待ってからもう一度お試しください。",
          retry_after_seconds: retryAfterSeconds,
        },
        429,
      );
    }

    const lastAttemptAt = parseStoredDate(existing?.last_attempt_at);
    const withinWindow =
      lastAttemptAt && now.getTime() - lastAttemptAt.getTime() <= policy.windowMinutes * 60 * 1000;
    const nextCount = withinWindow ? Number(existing?.attempt_count || 0) + 1 : 1;
    const nextBlockedUntil =
      nextCount > definition.limit
        ? new Date(now.getTime() + policy.blockMinutes * 60 * 1000).toISOString()
        : null;

    await env.LICENSE_DB.prepare(
      `
      INSERT INTO auth_attempt_buckets (
        bucket_key, action, attempt_count, blocked_until, last_attempt_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(bucket_key) DO UPDATE SET
        attempt_count = excluded.attempt_count,
        blocked_until = excluded.blocked_until,
        last_attempt_at = excluded.last_attempt_at,
        updated_at = excluded.updated_at
      `,
    )
      .bind(
        definition.bucketKey,
        policy.action,
        nextCount,
        nextBlockedUntil,
        now.toISOString(),
        existing?.last_attempt_at ? existing.last_attempt_at : now.toISOString(),
        now.toISOString(),
      )
      .run();

    if (nextBlockedUntil) {
      return jsonResponse(
        request,
        {
          error: "試行回数が多いため、しばらく待ってからもう一度お試しください。",
          retry_after_seconds: policy.blockMinutes * 60,
        },
        429,
      );
    }
  }

  return null;
}

async function clearAuthAttempts(
  env: Env,
  request: Request,
  policy: AuthRateLimitPolicy,
  email: string,
): Promise<void> {
  await ensureAuthAttemptTable(env);
  const clientIp = getClientIpAddress(request);
  await env.LICENSE_DB.prepare(
    `
    DELETE FROM auth_attempt_buckets
    WHERE bucket_key IN (?, ?, ?)
    `,
  )
    .bind(
      `${policy.action}:ip:${clientIp}`,
      `${policy.action}:email:${email}`,
      `${policy.action}:ip-email:${clientIp}:${email}`,
    )
    .run();
}

function getClientIpAddress(request: Request): string {
  const direct = (request.headers.get("cf-connecting-ip") || "").trim();
  if (direct) {
    return direct;
  }

  const forwarded = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim();
  if (forwarded) {
    return forwarded;
  }

  return "unknown";
}

function parseStoredDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function ensureMinimumResponseDuration(startedAt: number, minMs = AUTH_MIN_RESPONSE_MS): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= minMs) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
}

async function postSupabaseAuthJson(
  env: Env,
  path: string,
  payload: Record<string, unknown>,
): Promise<Response> {
  if (!env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("SUPABASE_PUBLISHABLE_KEY is not configured");
  }

  return fetch(`${env.SUPABASE_PROJECT_URL.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function safeReadJsonRecord(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function buildSupabaseSessionPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    access_token: payload.access_token || null,
    refresh_token: payload.refresh_token || null,
    expires_in: payload.expires_in || null,
    expires_at: payload.expires_at || null,
    token_type: payload.token_type || "bearer",
  };
}

function buildSupabaseUserPayload(payload: Record<string, unknown>): Record<string, unknown> | null {
  const directUser = payload.user as Record<string, unknown> | undefined;
  const session = payload.session as { user?: Record<string, unknown> } | undefined;
  const user = directUser || session?.user;
  return user || null;
}

function buildLoginReturnUrl(request: Request, env: Env, returnToPath?: string): string {
  const siteBase = resolvePublicSiteBaseUrl(request, env);
  const loginPath = normalizePath("/login/");
  const normalizedReturnTo = normalizeReturnToPath(returnToPath);
  if (!normalizedReturnTo) {
    return `${siteBase}${loginPath}`;
  }
  const url = new URL(`${siteBase}${loginPath}`);
  url.searchParams.set("returnTo", normalizedReturnTo);
  return url.toString();
}

function normalizeReturnToPath(path?: string): string | null {
  if (!path) {
    return null;
  }
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  if (trimmed.startsWith("//")) {
    return null;
  }
  return trimmed;
}

function isExistingAccountSignupResponse(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("already registered") || normalized.includes("already been registered");
}

async function requireAuth(request: Request, env: Env, ctx: ExecutionContext): Promise<AuthContext | Response> {
  const token = readBearerToken(request);
  if (!token) {
    return jsonResponse(request, { error: "missing bearer token" }, 401);
  }

  try {
    const claims = await verifySupabaseJwt(token, env, ctx);
    return {
      authUserId: claims.sub,
      email: claims.email || "",
      displayName: claims.user_metadata?.display_name || claims.user_metadata?.name || "",
      claims,
    };
  } catch (error) {
    return jsonResponse(request, { error: error instanceof Error ? error.message : "invalid token" }, 401);
  }
}

async function verifySupabaseJwt(token: string, env: Env, ctx: ExecutionContext): Promise<JwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid JWT format");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseBase64UrlJson<{ alg?: string; kid?: string }>(encodedHeader);
  const claims = parseBase64UrlJson<JwtClaims>(encodedPayload);

  if (!claims.sub) {
    throw new Error("token missing sub");
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) {
    throw new Error("token expired");
  }

  const expectedIssuer = `${env.SUPABASE_PROJECT_URL.replace(/\/$/, "")}/auth/v1`;
  if (claims.iss !== expectedIssuer) {
    throw new Error("token issuer mismatch");
  }

  const expectedAudience = env.SUPABASE_EXPECTED_AUDIENCE || "authenticated";
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(expectedAudience)) {
    throw new Error("token audience mismatch");
  }

  if (header.alg !== "RS256" || !header.kid) {
    return verifySupabaseTokenViaUserEndpoint(token, claims, env);
  }

  const jwks = await getSupabaseJwks(env, ctx);
  const jwk = jwks.keys.find((item) => item.kid === header.kid);
  if (!jwk) {
    throw new Error("matching JWK not found");
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk as JsonWebKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  );

  const signatureBytes = base64UrlToBytes(encodedSignature);
  const payloadBytes = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    toArrayBuffer(signatureBytes),
    toArrayBuffer(payloadBytes),
  );
  if (!verified) {
    throw new Error("JWT signature verification failed");
  }

  return claims;
}

async function verifySupabaseTokenViaUserEndpoint(
  token: string,
  decodedClaims: JwtClaims,
  env: Env,
): Promise<JwtClaims> {
  if (!env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("unsupported JWT header and SUPABASE_PUBLISHABLE_KEY is not configured");
  }

  const response = await fetch(`${env.SUPABASE_PROJECT_URL.replace(/\/$/, "")}/auth/v1/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`supabase user lookup failed: ${response.status}`);
  }

  const user = (await response.json()) as SupabaseUserResponse;
  if (!user.id) {
    throw new Error("supabase user lookup returned no id");
  }

  return {
    ...decodedClaims,
    sub: user.id,
    email: user.email || decodedClaims.email,
    user_metadata: user.user_metadata || decodedClaims.user_metadata,
  };
}

async function getSupabaseJwks(env: Env, ctx: ExecutionContext): Promise<{ keys: Array<Record<string, unknown>> }> {
  const cache = (caches as CacheStorageWithDefault).default;
  const request = new Request(env.SUPABASE_JWKS_URL, { method: "GET" });
  const cached = await cache.match(request);
  if (cached) {
    return cached.json() as Promise<{ keys: Array<Record<string, unknown>> }>;
  }

  const response = await fetch(request);
  if (!response.ok) {
    throw new Error(`failed to fetch JWKS: ${response.status}`);
  }
  const clone = response.clone();
  ctx.waitUntil(cache.put(request, clone));
  return response.json() as Promise<{ keys: Array<Record<string, unknown>> }>;
}

function parseBase64UrlJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function upsertUserAndGetRow(env: Env, auth: AuthContext): Promise<UserRow> {
  await env.LICENSE_DB.prepare(
    `
    INSERT INTO users (id, auth_user_id, auth_provider, email, display_name, created_at, updated_at, last_login_at)
    VALUES (?, ?, 'supabase', ?, ?, datetime('now'), datetime('now'), datetime('now'))
    ON CONFLICT(auth_user_id) DO UPDATE SET
      email = excluded.email,
      display_name = CASE
        WHEN excluded.display_name <> '' THEN excluded.display_name
        ELSE users.display_name
      END,
      updated_at = datetime('now'),
      last_login_at = datetime('now')
    `,
  )
    .bind(crypto.randomUUID().replaceAll("-", ""), auth.authUserId, auth.email, auth.displayName)
    .run();

  const user = await env.LICENSE_DB.prepare(
    `
    SELECT id, auth_user_id, COALESCE(display_name, '') AS display_name
    FROM users
    WHERE auth_user_id = ?
    LIMIT 1
    `,
  )
    .bind(auth.authUserId)
    .first<UserRow>();

  if (!user) {
    throw new Error("user sync failed");
  }
  return user;
}

async function buildLicenseStatus(
  env: Env,
  auth: AuthContext,
  user: UserRow,
): Promise<{
  signed_in: boolean;
  purchase_state: PurchaseState;
  active_plan: ActivePlan;
  user: { user_id: string; display_name: string };
  entitlements: Array<Record<string, unknown>>;
  source: string;
}> {
  const entitlementsResult = await env.LICENSE_DB.prepare(
    `
    SELECT plan_code, product_code, scope_type, scope_id, status, granted_at, expires_at
    FROM entitlements
    WHERE user_id = ?
    ORDER BY updated_at DESC
    `,
  )
    .bind(user.id)
    .all<Record<string, unknown>>();

  const order = await env.LICENSE_DB.prepare(
    `
    SELECT order_status
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1
    `,
  )
    .bind(user.id)
    .first<{ order_status?: string }>();

  const entitlements = entitlementsResult.results || [];
  const activeEntitlements = entitlements.filter((item: Record<string, unknown>) => item.status === "active");
  const hasPremium = activeEntitlements.some((item: Record<string, unknown>) => item.plan_code === "premium");
  const latestPremiumEntitlement = entitlements.find((item: Record<string, unknown>) => item.plan_code === "premium");
  const purchaseState: PurchaseState = hasPremium
    ? "entitled"
    : latestPremiumEntitlement?.status === "expired"
      ? "expired"
      : latestPremiumEntitlement?.status === "revoked"
        ? order?.order_status === "refunded"
          ? "refunded"
          : "revoked"
        : order?.order_status === "refunded"
          ? "refunded"
          : order?.order_status === "cancelled" || order?.order_status === "failed" || order?.order_status === "expired"
            ? "cancelled"
    : order?.order_status === "pending"
      ? "in_checkout"
      : order?.order_status === "paid"
        ? "paid_pending_entitlement"
        : "not_started";

  return {
    signed_in: true,
    purchase_state: purchaseState,
    active_plan: hasPremium ? "premium" : "free",
    user: {
      user_id: user.auth_user_id || auth.authUserId,
      display_name: user.display_name || auth.displayName || "利用者",
    },
    entitlements: activeEntitlements,
    source: "cloudflare_d1",
  };
}

function parsePremiumPlanRegistry(env: Env): PremiumPlanRegistry {
  if (!env.PREMIUM_PLAN_REGISTRY_JSON) {
    return { plans: {} };
  }
  try {
    return JSON.parse(env.PREMIUM_PLAN_REGISTRY_JSON) as PremiumPlanRegistry;
  } catch {
    return { plans: {} };
  }
}

function getPremiumPlanConfig(env: Env, planCode: string): PremiumPlanConfig {
  const registry = parsePremiumPlanRegistry(env);
  return registry.plans?.[planCode] || {};
}

function normalizeAccessPlan(plan: string | null | undefined): "free" | "premium" {
  return plan === "premium" || plan === "standard" ? "premium" : "free";
}

function canAccessRequiredPlan(requiredPlan: string | null | undefined, activePlan: string): boolean {
  const normalizedRequiredPlan = normalizeAccessPlan(requiredPlan);
  const normalizedActivePlan = normalizeAccessPlan(activePlan);
  return normalizedRequiredPlan === "free" || normalizedActivePlan === "premium";
}

function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function extractReferenceLinks(sourceSnapshotJson: unknown): Array<Record<string, string>> {
  if (typeof sourceSnapshotJson !== "string" || !sourceSnapshotJson.trim()) {
    return [];
  }

  try {
    const snapshot = JSON.parse(sourceSnapshotJson) as { sources?: Array<Record<string, unknown>> };
    const rawSources = Array.isArray(snapshot.sources) ? snapshot.sources : [];
    const seenUrls = new Set<string>();
    const links: Array<Record<string, string>> = [];
    for (const source of rawSources) {
      if (!source || typeof source !== "object") {
        continue;
      }
      const url = String(source.url_or_location || "").trim();
      if (!/^https?:\/\//.test(url) || seenUrls.has(url)) {
        continue;
      }
      seenUrls.add(url);
      links.push({
        title: String(source.title || source.publisher || "参考資料").trim(),
        publisher: String(source.publisher || "").trim(),
        section: String(source.section || "").trim(),
        url,
      });
    }
    return links;
  } catch {
    return [];
  }
}

function buildQuestionPayloadFromRows(
  setRow: Record<string, unknown>,
  rows: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const questions = rows.map((row) => ({
    id: row.question_id,
    level: row.level,
    category: row.category,
    subtopic: row.subtopic,
    prompt: row.prompt,
    options: parseJsonArray<string>(row.options_json),
    answer_index: row.answer_index,
    explanation: row.explanation,
    option_explanations: parseJsonArray<string>(row.option_explanations_json),
    memory_tip: row.memory_tip || "",
    reference_links: extractReferenceLinks(row.source_snapshot_json),
  }));

  return {
    version: String(setRow.published_at || ""),
    set_id: String(setRow.set_id || ""),
    set_name: String(setRow.label || ""),
    set_description: String(setRow.short_description || ""),
    set_tag: String(setRow.audience_tag || ""),
    required_plan: normalizeAccessPlan(String(setRow.required_plan || "free")),
    question_count: questions.length,
    questions,
  };
}

async function buildPublicCatalog(env: Env, activePlan: string): Promise<Array<Record<string, unknown>>> {
  const normalizedActivePlan = normalizeAccessPlan(activePlan);
  const result = await env.LICENSE_DB.prepare(
    `
    SELECT
      qs.set_id,
      qs.label,
      qs.short_description,
      qs.audience_tag,
      qs.level,
      qs.visibility,
      qs.required_plan,
      qs.published_at,
      COUNT(qsi.question_id) AS question_count
    FROM question_sets qs
    LEFT JOIN question_set_items qsi ON qsi.set_id = qs.set_id
    WHERE qs.visibility = 'public' AND qs.is_active = 1
    GROUP BY
      qs.set_id,
      qs.label,
      qs.short_description,
      qs.audience_tag,
      qs.level,
      qs.visibility,
      qs.required_plan,
      qs.published_at
    ORDER BY qs.published_at DESC, qs.set_id
    `,
  ).all<Record<string, unknown>>();

  return (result.results || []).filter((item) =>
    canAccessRequiredPlan(String(item.required_plan || "free"), normalizedActivePlan),
  );
}

async function buildPublicQuestionPayload(
  env: Env,
  setId: string | null,
  activePlan: string,
): Promise<Record<string, unknown>> {
  const normalizedActivePlan = normalizeAccessPlan(activePlan);
  let resolvedSetId = setId ? String(setId) : "";

  if (!resolvedSetId) {
    const latest = await env.LICENSE_DB.prepare(
      `
      SELECT set_id, required_plan
      FROM question_sets
      WHERE visibility = 'public' AND is_active = 1
      ORDER BY published_at DESC, set_id
      `,
    ).all<Record<string, unknown>>();
    const firstVisible = (latest.results || []).find((item) =>
      canAccessRequiredPlan(String(item.required_plan || "free"), normalizedActivePlan),
    );
    if (!firstVisible?.set_id) {
      throw new Error("No public question set found.");
    }
    resolvedSetId = String(firstVisible.set_id);
  }

  const setRow = await env.LICENSE_DB.prepare(
    `
    SELECT set_id, label, short_description, audience_tag, level, published_at, required_plan
    FROM question_sets
    WHERE set_id = ?
      AND visibility = 'public'
      AND is_active = 1
    LIMIT 1
    `,
  )
    .bind(resolvedSetId)
    .first<Record<string, unknown>>();

  if (!setRow || !canAccessRequiredPlan(String(setRow.required_plan || "free"), normalizedActivePlan)) {
    throw new Error(`Public question set not found: ${resolvedSetId}`);
  }

  const rows = await env.LICENSE_DB.prepare(
    `
    SELECT
      pq.question_id,
      pq.level,
      pq.category,
      pq.subtopic,
      pq.prompt,
      pq.options_json,
      pq.answer_index,
      pq.explanation,
      pq.option_explanations_json,
      pq.memory_tip,
      pq.source_snapshot_json
    FROM question_set_items qsi
    JOIN published_questions pq ON pq.question_id = qsi.question_id
    WHERE qsi.set_id = ?
    ORDER BY qsi.sort_order ASC
    `,
  )
    .bind(resolvedSetId)
    .all<Record<string, unknown>>();

  return buildQuestionPayloadFromRows(setRow, rows.results || []);
}

async function buildPremiumManifest(
  env: Env,
  planCode: string,
): Promise<{
  label: string;
  recommended_entry_path: string;
  base_public_set_id: string;
  merge_strategy: string;
  question_sets: Array<Record<string, unknown>>;
  unlocked_features: string[];
}> {
  const config = getPremiumPlanConfig(env, planCode);
  const configuredSetIds = Array.isArray(config.question_sets)
    ? config.question_sets.map((item: { set_id: string }) => item.set_id).filter(Boolean)
    : [];

  let questionSets: Array<Record<string, unknown>> = [];
  if (configuredSetIds.length > 0) {
    const placeholders = configuredSetIds.map(() => "?").join(", ");
    const result = await env.LICENSE_DB.prepare(
      `
      SELECT
        qs.set_id,
        qs.label,
        qs.short_description,
        qs.audience_tag,
        qs.level,
        qs.required_plan,
        qs.published_at,
        COUNT(qsi.question_id) AS question_count
      FROM question_sets qs
      LEFT JOIN question_set_items qsi ON qsi.set_id = qs.set_id
      WHERE qs.set_id IN (${placeholders})
        AND qs.is_active = 1
      GROUP BY
        qs.set_id,
        qs.label,
        qs.short_description,
        qs.audience_tag,
        qs.level,
        qs.required_plan,
        qs.published_at
      `,
    )
      .bind(...configuredSetIds)
      .all<Record<string, unknown>>();
    const bySetId = new Map((result.results || []).map((item) => [String(item.set_id), item]));
    questionSets = configuredSetIds
      .map((setId) => {
        const item = bySetId.get(setId);
        if (!item) {
          return null;
        }
        const registryItem = config.question_sets?.find((candidate) => candidate.set_id === setId);
        return {
          ...item,
          delivery_mode: registryItem?.delivery_mode || config.merge_strategy || "append_non_duplicate",
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
  }

  return {
    label: config.label || env.STRIPE_PRODUCT_NAME || "3級プレミアム版",
    recommended_entry_path: config.recommended_entry_path || env.APP_ENTRY_PATH || "/app/",
    base_public_set_id: config.base_public_set_id || "grade3_mixed_priority_50",
    merge_strategy: config.merge_strategy || "append_non_duplicate",
    question_sets: questionSets,
    unlocked_features: config.unlocked_features || DEFAULT_UNLOCKED_FEATURES,
  };
}

async function ensureBillingCatalog(
  env: Env,
  planCode: string,
  productCode: string,
): Promise<BillingCatalogRow> {
  const existing = await env.LICENSE_DB.prepare(
    `
    SELECT product_code, stripe_product_id, stripe_price_id, amount_jpy, currency
    FROM billing_catalog
    WHERE product_code = ? AND active = 1
    LIMIT 1
    `,
  )
    .bind(productCode)
    .first<BillingCatalogRow>();
  if (existing) {
    return existing;
  }

  const planConfig = getPremiumPlanConfig(env, planCode);
  const amountJpy = Number(env.PREMIUM_PRICE_JPY || String(planConfig.price_jpy || 1200));

  if (env.STRIPE_PRICE_ID) {
    const stripePrice = await stripeGet<StripePriceResponse>(
      env,
      `/v1/prices/${encodeURIComponent(env.STRIPE_PRICE_ID)}?expand[]=product`,
    );
    const productValue = stripePrice.product;
    const stripeProductId =
      typeof productValue === "string"
        ? productValue
        : typeof productValue?.id === "string"
          ? productValue.id
          : `configured-${productCode}`;
    await upsertBillingCatalog(env, {
      productCode,
      stripeProductId,
      stripePriceId: stripePrice.id,
      amountJpy: stripePrice.unit_amount || amountJpy,
      currency: (stripePrice.currency || "jpy").toUpperCase(),
    });
  } else {
    const stripeProduct = await stripePostForm<StripeProductResponse>(env, "/v1/products", {
      name: planConfig.label || env.STRIPE_PRODUCT_NAME || "3級プレミアム版",
      default_price_data: {
        currency: "jpy",
        unit_amount: amountJpy,
      },
    });
    const stripePriceId = extractStripeId(stripeProduct.default_price);
    if (!stripePriceId) {
      throw new Error("Stripe product default price was not returned");
    }
    await upsertBillingCatalog(env, {
      productCode,
      stripeProductId: stripeProduct.id,
      stripePriceId,
      amountJpy,
      currency: "JPY",
    });
  }

  const persisted = await env.LICENSE_DB.prepare(
    `
    SELECT product_code, stripe_product_id, stripe_price_id, amount_jpy, currency
    FROM billing_catalog
    WHERE product_code = ? AND active = 1
    LIMIT 1
    `,
  )
    .bind(productCode)
    .first<BillingCatalogRow>();

  if (!persisted) {
    throw new Error("billing catalog create failed");
  }
  return persisted;
}

async function upsertBillingCatalog(
  env: Env,
  catalog: {
    productCode: string;
    stripeProductId: string;
    stripePriceId: string;
    amountJpy: number;
    currency: string;
  },
): Promise<void> {
  await env.LICENSE_DB.prepare(
    `
    INSERT INTO billing_catalog (
      product_code, stripe_product_id, stripe_price_id, amount_jpy, currency, active, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    ON CONFLICT(product_code) DO UPDATE SET
      stripe_product_id = excluded.stripe_product_id,
      stripe_price_id = excluded.stripe_price_id,
      amount_jpy = excluded.amount_jpy,
      currency = excluded.currency,
      active = 1,
      updated_at = datetime('now')
    `,
  )
    .bind(
      catalog.productCode,
      catalog.stripeProductId,
      catalog.stripePriceId,
      catalog.amountJpy,
      catalog.currency,
    )
    .run();
}

function buildCheckoutUrls(
  request: Request,
  env: Env,
  appEntryPath: string,
): { successUrl: string; cancelUrl: string } {
  const siteBase = resolvePublicSiteBaseUrl(request, env);
  const normalizedEntryPath = normalizePath(appEntryPath || "/app/");
  return {
    successUrl: `${siteBase}${normalizedEntryPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${siteBase}/premium/ready/?checkout=cancelled`,
  };
}

function buildAppReturnUrl(request: Request, env: Env, appEntryPath: string): string {
  const siteBase = resolvePublicSiteBaseUrl(request, env);
  return `${siteBase}${normalizePath(appEntryPath || "/app/")}`;
}

function resolvePublicSiteBaseUrl(request: Request, env: Env): string {
  if (env.PUBLIC_SITE_URL) {
    return env.PUBLIC_SITE_URL.replace(/\/+$/, "");
  }

  const origin = resolveAllowedCorsOrigin(request);
  if (origin) {
    return origin;
  }

  throw new Error("PUBLIC_SITE_URL is not configured");
}

function normalizePath(path: string): string {
  if (!path) {
    return "/app/";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

async function createStripeCheckoutSession(
  env: Env,
  input: {
    priceId: string;
    authUserId: string;
    planCode: string;
    productCode: string;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<StripeCheckoutSessionResponse> {
  return stripePostForm<StripeCheckoutSessionResponse>(env, "/v1/checkout/sessions", {
    line_items: [
      {
        price: input.priceId,
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.authUserId,
    metadata: {
      auth_user_id: input.authUserId,
      plan_code: input.planCode,
      product_code: input.productCode,
    },
  });
}

async function stripePostForm<T>(env: Env, path: string, params: Record<string, unknown>): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const body = new URLSearchParams();
  appendFormValues(body, "", params);

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  return parseStripeResponse<T>(response);
}

async function stripeGet<T>(env: Env, path: string): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
  });

  return parseStripeResponse<T>(response);
}

async function parseStripeResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as Record<string, unknown>;
  const stripePayload = payload as StripeErrorPayload;
  if (!response.ok) {
    const message =
      typeof stripePayload.error?.message === "string"
        ? stripePayload.error.message
        : `stripe request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function appendFormValues(target: URLSearchParams, prefix: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      appendFormValues(target, `${prefix}[${index}]`, item);
    });
    return;
  }

  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, nestedValue]) => {
      const nextPrefix = prefix ? `${prefix}[${key}]` : key;
      appendFormValues(target, nextPrefix, nestedValue);
    });
    return;
  }

  target.append(prefix, String(value));
}

function extractStripeId(value: string | { id?: string } | null | undefined): string {
  if (!value) {
    return "";
  }
  return typeof value === "string" ? value : value.id || "";
}

async function verifyStripeWebhookSignature(payload: string, header: string, secret: string): Promise<void> {
  if (!header) {
    throw new Error("missing Stripe-Signature header");
  }

  const parsed = parseStripeSignatureHeader(header);
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    throw new Error("invalid Stripe-Signature header");
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > 300) {
    throw new Error("webhook timestamp is too old");
  }

  const signedPayload = `${parsed.timestamp}.${payload}`;
  const computedSignature = await computeHmacHex(secret, signedPayload);
  const matches = parsed.signatures.some((candidate) => safeEqualHex(candidate, computedSignature));
  if (!matches) {
    throw new Error("webhook signature verification failed");
  }
}

function parseStripeSignatureHeader(header: string): { timestamp: number; signatures: string[] } {
  const result = { timestamp: 0, signatures: [] as string[] };
  header.split(",").forEach((segment) => {
    const [rawKey, rawValue] = segment.split("=", 2);
    const key = rawKey?.trim();
    const value = rawValue?.trim();
    if (!key || !value) {
      return;
    }
    if (key === "t") {
      result.timestamp = Number(value);
    }
    if (key === "v1") {
      result.signatures.push(value);
    }
  });
  return result;
}

async function computeHmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function handleCheckoutCompleted(env: Env, event: StripeWebhookEvent): Promise<void> {
  const session = event.data.object as unknown as StripeCheckoutSessionResponse & {
    metadata?: Record<string, string>;
  };
  const authUserId = session.client_reference_id || session.metadata?.auth_user_id;
  const productCode =
    session.metadata?.product_code || env.PREMIUM_PRODUCT_CODE || env.PREMIUM_PLAN_CODE || "grade3_premium";
  const planCode = session.metadata?.plan_code || env.PREMIUM_PLAN_CODE || "grade3_premium";
  if (!authUserId || !session.id) {
    return;
  }

  const user = await env.LICENSE_DB.prepare(
    `
    SELECT id
    FROM users
    WHERE auth_user_id = ?
    LIMIT 1
    `,
  )
    .bind(authUserId)
    .first<{ id: string }>();
  if (!user?.id) {
    return;
  }

  const existingOrder = await env.LICENSE_DB.prepare(
    `
    SELECT id
    FROM orders
    WHERE provider_checkout_id = ?
    LIMIT 1
    `,
  )
    .bind(session.id)
    .first<{ id: string }>();

  const amountJpy =
    typeof session.amount_total === "number"
      ? Math.round(session.amount_total / 1)
      : Number(env.PREMIUM_PRICE_JPY || "1200");

  let orderId = existingOrder?.id || "";
  if (orderId) {
    await env.LICENSE_DB.prepare(
      `
      UPDATE orders
      SET order_status = 'paid',
          provider_payment_id = ?,
          purchased_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
      `,
    )
      .bind(session.payment_intent || "", orderId)
      .run();
  } else {
    orderId = crypto.randomUUID().replaceAll("-", "");
    await env.LICENSE_DB.prepare(
      `
      INSERT INTO orders (
        id, user_id, product_code, price_jpy, currency, payment_provider,
        provider_checkout_id, provider_payment_id, order_status, purchased_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 'JPY', 'stripe', ?, ?, 'paid', datetime('now'), datetime('now'), datetime('now'))
      `,
    )
      .bind(orderId, user.id, productCode, amountJpy, session.id, session.payment_intent || "")
      .run();
  }

  await grantPremiumEntitlement(env, {
    userId: user.id,
    productCode,
    planCode: "premium",
    scopeType: "plan",
    scopeId: planCode,
    sourceOrderId: orderId,
  });
}

async function handleCheckoutExpired(env: Env, event: StripeWebhookEvent): Promise<void> {
  const session = event.data.object as unknown as StripeCheckoutSessionResponse;
  if (!session.id) {
    return;
  }

  await env.LICENSE_DB.prepare(
    `
    UPDATE orders
    SET order_status = 'expired',
        updated_at = datetime('now')
    WHERE provider_checkout_id = ?
      AND order_status = 'pending'
    `,
  )
    .bind(session.id)
    .run();
}

async function grantPremiumEntitlement(
  env: Env,
  input: {
    userId: string;
    productCode: string;
    planCode: string;
    scopeType: string;
    scopeId: string;
    sourceOrderId: string;
  },
): Promise<void> {
  const existing = await env.LICENSE_DB.prepare(
    `
    SELECT id
    FROM entitlements
    WHERE user_id = ? AND product_code = ? AND scope_type = ? AND scope_id = ? AND status = 'active'
    LIMIT 1
    `,
  )
    .bind(input.userId, input.productCode, input.scopeType, input.scopeId)
    .first<{ id: string }>();

  if (existing?.id) {
    await env.LICENSE_DB.prepare(
      `
      UPDATE entitlements
      SET source_order_id = ?,
          updated_at = datetime('now')
      WHERE id = ?
      `,
    )
      .bind(input.sourceOrderId, existing.id)
      .run();
    return;
  }

  await env.LICENSE_DB.prepare(
    `
    INSERT INTO entitlements (
      id, user_id, plan_code, product_code, scope_type, scope_id,
      status, granted_at, expires_at, source_order_id, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), NULL, ?, datetime('now'))
    `,
  )
    .bind(
      crypto.randomUUID().replaceAll("-", ""),
      input.userId,
      input.planCode,
      input.productCode,
      input.scopeType,
      input.scopeId,
      input.sourceOrderId,
    )
    .run();
}

interface CacheStorageWithDefault extends CacheStorage {
  default: Cache;
}
