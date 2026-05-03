(function attachQuizPlanStatusService(): void {
  type PlanStatusSource = "default" | "manual_override" | "license_api";

  interface PlanStatusState {
    activePlan: PlanKey;
    signedIn: boolean;
    source: PlanStatusSource;
  }

  function normalizeStoredPlan(rawValue: string | null | undefined): PlanKey | null {
    if (!rawValue) {
      return null;
    }
    if (rawValue === "premium" || rawValue === "standard") {
      return "premium";
    }
    if (rawValue === "free") {
      return "free";
    }
    return null;
  }

  function load(defaultPlan: PlanKey): PlanStatusState {
    const storageApi = window.QuizStorageRepositories?.planRepository;
    const storedPlan = storageApi?.load(defaultPlan, ["free", "premium"]) || defaultPlan;
    const normalizedPlan = normalizeStoredPlan(storedPlan) || defaultPlan;
    return {
      activePlan: normalizedPlan,
      signedIn: false,
      source: normalizedPlan === defaultPlan ? "default" : "manual_override",
    };
  }

  function saveManualOverride(planKey: PlanKey): void {
    window.QuizStorageRepositories?.planRepository.save(planKey);
  }

  function clearManualOverride(): void {
    window.QuizStorageRepositories?.planRepository.clear?.();
  }

  window.QuizPlanStatusService = {
    load,
    saveManualOverride,
    clearManualOverride,
  };
})();
