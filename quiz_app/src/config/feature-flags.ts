(function attachQuizFeatureFlags(): void {
  const PLAN_ORDER: PlanKey[] = ["free", "premium"];

  const PLAN_LABELS: Record<PlanKey, string> = {
    free: "無料版",
    premium: "プレミアム版",
  };

  const PLAN_COPY: Record<PlanKey, string> = {
    free: "まずは無料で解ける感覚をつかむ体験版です。順番学習とランダム学習で3級の入口を試せます。",
    premium:
      "合格効率を上げるプレミアム版です。全問題に加えて、苦手復習、自動おすすめ、直前14日モードまで使えます。",
  };

  const FEATURE_REQUIREMENTS: Record<FeatureKey, PlanKey> = {
    sequential_mode: "free",
    random_mode: "free",
    category_mode: "premium",
    final14_mode: "premium",
    flagged_mode: "premium",
    pause_resume: "premium",
    retry_wrong: "premium",
    weak_focus: "premium",
    study_plan: "premium",
    recommendation: "premium",
    category_stats: "premium",
    recent_sessions: "premium",
    flagged_priority: "premium",
  };

  const MODE_LABELS: Record<StudyMode, string> = {
    sequential: "順番に学習",
    random: "ランダム出題",
    category: "カテゴリ別学習",
    final14: "直前14日モード",
    retry_wrong: "間違えた問題だけ復習",
    flagged: "要復習だけ学習",
  };

  function normalizePlanKey(planKey: string | null | undefined): PlanKey {
    return planKey === "premium" || planKey === "standard" ? "premium" : "free";
  }

  function planRank(planKey: PlanKey): number {
    return PLAN_ORDER.indexOf(planKey);
  }

  function hasFeature(planKey: PlanKey, featureKey: FeatureKey): boolean {
    const requiredPlan = FEATURE_REQUIREMENTS[featureKey] || "free";
    return planRank(normalizePlanKey(planKey)) >= planRank(requiredPlan);
  }

  function requiredPlanLabel(featureKey: FeatureKey): string {
    return PLAN_LABELS[FEATURE_REQUIREMENTS[featureKey] || "free"];
  }

  window.QuizFeatureFlags = {
    PLAN_ORDER,
    PLAN_LABELS,
    PLAN_COPY,
    FEATURE_REQUIREMENTS,
    MODE_LABELS,
    normalizePlanKey,
    planRank,
    hasFeature,
    requiredPlanLabel,
  };
})();
