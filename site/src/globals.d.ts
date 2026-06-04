interface AppRuntimeConfig {
  publicApiBaseUrl?: string;
  secureApiBaseUrl?: string;
  authMode?: "local_stub" | "supabase" | "disabled_remote_stub";
  checkoutProvider?: "local_stub" | "stripe";
  freeQuestionPath?: string;
  publicCatalogPath?: string;
  freeQuestionSet?: string;
  cloudflarePagesProject?: string;
  premiumGuidePath?: string;
  premiumPurchasePath?: string;
  premiumPriceText?: string;
  serviceName?: string;
  operatorTradeName?: string;
  operatorName?: string;
  legalEffectiveDate?: string;
  loginPath?: string;
  appEntryPath?: string;
  purchaseEnabled?: boolean;
  stripePublishableKey?: string;
  stripePriceId?: string;
  supportEmail?: string;
  supabaseUrl?: string;
  supabasePublishableKey?: string;
}

interface LicenseStatusResponse {
  signed_in: boolean;
  purchase_state?:
    | "not_started"
    | "in_checkout"
    | "paid_pending_entitlement"
    | "entitled"
    | "refunded"
    | "cancelled"
    | "expired"
    | "revoked";
  active_plan: "free" | "premium";
  user?: {
    user_id: string;
    display_name: string;
  } | null;
  entitlements?: Array<{
    code: string;
    status: string;
    label: string;
  }>;
  source?: string;
}

interface StoredAuthSession {
  access_token: string;
  assumed_plan: "free" | "premium";
  signed_in_at: string;
}

interface PublicApiClientApi {
  fetchFreeQuestions?: (setId?: string) => Promise<any>;
  fetchPublicCatalog?: () => Promise<any>;
  fetchQuestionSetCatalog?: (plan?: string) => Promise<any>;
}

interface QuestionReferenceLink {
  title: string;
  publisher?: string;
  section?: string;
  url: string;
}

interface SiteAuthClientApi {
  getMode: () => "local_stub" | "supabase" | "disabled_remote_stub";
  isSupabaseConfigured: () => boolean;
  fetchLicenseStatus: () => Promise<LicenseStatusResponse>;
  fetchSecureHealth?: () => Promise<any>;
  fetchPremiumManifest: (planCode?: string) => Promise<any>;
  fetchPremiumQuestions: (setId?: string) => Promise<any>;
  signInAsFree: () => Promise<LicenseStatusResponse>;
  signInAsPremium: () => Promise<LicenseStatusResponse>;
  signUpWithEmail: (email: string, password: string) => Promise<any>;
  signInWithEmailPassword: (email: string, password: string) => Promise<LicenseStatusResponse>;
  requestPasswordReset: (email: string, returnToPath?: string) => Promise<any>;
  isPasswordRecoverySession: () => Promise<boolean>;
  updatePasswordWithRecovery: (password: string) => Promise<LicenseStatusResponse>;
  startCheckout: () => Promise<any>;
  completeCheckout: () => Promise<LicenseStatusResponse>;
  signOut: () => void;
  getStoredSession: () => StoredAuthSession | null;
}

interface SecureApiExamplesApi {
  fetchLicenseStatus?: (accessToken: string) => Promise<any>;
  fetchPaidQuestionManifest?: (accessToken: string, planCode: string) => Promise<any>;
}

interface Window {
  APP_RUNTIME_CONFIG?: AppRuntimeConfig;
  PublicApiClient?: PublicApiClientApi;
  SiteAuthClient?: SiteAuthClientApi;
  SecureApiExamples?: SecureApiExamplesApi;
}
