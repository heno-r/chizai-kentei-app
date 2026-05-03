(function attachQuizFeatureFlags() {
  const PLAN_ORDER = ["free", "standard", "premium"];

  const PLAN_LABELS = {
    free: "無料",
    standard: "スタンダード",
    premium: "プレミアム",
  };

  const PLAN_COPY = {
    free: "順番学習とランダム出題を試せる無料プラン想定です。",
    standard: "カテゴリ学習、要復習、中断再開まで使える中位プラン想定です。",
    premium: "直前14日モード、分析、おすすめ導線まで使える上位プラン想定です。",
  };

  const FEATURE_REQUIREMENTS = {
    sequential_mode: "free",
    random_mode: "free",
    category_mode: "standard",
    final14_mode: "premium",
    flagged_mode: "standard",
    pause_resume: "standard",
    retry_wrong: "standard",
    weak_focus: "premium",
    study_plan: "premium",
    recommendation: "premium",
    category_stats: "premium",
    recent_sessions: "premium",
    flagged_priority: "premium",
  };

  const MODE_LABELS = {
    sequential: "順番に学習",
    random: "ランダム出題",
    category: "カテゴリ別学習",
    final14: "直前14日モード",
    retry_wrong: "間違えた問題だけ復習",
    flagged: "要復習だけ学習",
  };

  function planRank(planKey) {
    return PLAN_ORDER.indexOf(planKey);
  }

  function hasFeature(planKey, featureKey) {
    const requiredPlan = FEATURE_REQUIREMENTS[featureKey] || "free";
    return planRank(planKey) >= planRank(requiredPlan);
  }

  function requiredPlanLabel(featureKey) {
    return PLAN_LABELS[FEATURE_REQUIREMENTS[featureKey] || "free"];
  }

  window.QuizFeatureFlags = {
    PLAN_ORDER,
    PLAN_LABELS,
    PLAN_COPY,
    FEATURE_REQUIREMENTS,
    MODE_LABELS,
    planRank,
    hasFeature,
    requiredPlanLabel,
  };
})();
