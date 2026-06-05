// @ts-nocheck
(function attachPublicApiClient() {
  const config = window.APP_RUNTIME_CONFIG || {};

  function getPublicBase(): string {
    const baseUrl = (config.publicApiBaseUrl || "").replace(/\/$/, "");
    if (baseUrl) {
      return baseUrl;
    }
    const secureBaseUrl = (config.secureApiBaseUrl || "").replace(/\/$/, "");
    if (secureBaseUrl) {
      return secureBaseUrl;
    }
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin.replace(/\/$/, "");
    }
    return "";
  }

  async function fetchJson(url, init = {}) {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`request failed: ${response.status}`);
    }
    return response.json();
  }

  const PublicApiClient = {
    async fetchFreeQuestions(setId) {
      const publicBase = getPublicBase();
      const resolvedSetId = setId || config.freeQuestionSet || "grade3_mixed_priority_50";
      if (publicBase) {
        try {
          return await fetchJson(
            `${publicBase}/api/public/questions?set_id=${encodeURIComponent(resolvedSetId)}&plan=free`,
            { cache: "no-store" },
          );
        } catch (error) {
          console.warn("public API unavailable, fallback to bundled free questions", error);
        }
      }
      return fetchJson(config.freeQuestionPath || "./data/questions.json", { cache: "no-store" });
    },

    async fetchPublicCatalog() {
      return fetchJson(config.publicCatalogPath || "./data/public_catalog.json", { cache: "no-store" });
    },

    async fetchQuestionSetCatalog(plan = "free") {
      const publicBase = getPublicBase();
      if (!publicBase) {
        return { sets: [] };
      }
      return fetchJson(`${publicBase}/api/public/catalog?plan=${encodeURIComponent(plan)}`, {
        cache: "no-store",
      });
    },
  };

  const SecureApiExamples = {
    async fetchLicenseStatus(accessToken) {
      const secureBase = (config.secureApiBaseUrl || "").replace(/\/$/, "");
      if (!secureBase) {
        throw new Error("secureApiBaseUrl is not configured");
      }
      return fetchJson(`${secureBase}/license/status`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    },

    async fetchPaidQuestionManifest(accessToken, planCode) {
      const secureBase = (config.secureApiBaseUrl || "").replace(/\/$/, "");
      if (!secureBase) {
        throw new Error("secureApiBaseUrl is not configured");
      }
      return fetchJson(`${secureBase}/content/manifest?plan=${encodeURIComponent(planCode)}`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    },
  };

  window.PublicApiClient = PublicApiClient;
  window.SecureApiExamples = SecureApiExamples;
})();
