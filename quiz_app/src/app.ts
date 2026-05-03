const state: QuizState = {
  questions: [],
  availableSets: [],
  currentSetId: "grade3_mixed_priority_50",
  currentSetLabel: "3級無料公開50問",
  currentSetDescription: "",
  currentSetTag: "無料公開",
  isLoadingSet: false,
  questionLoadError: "",
  mode: "sequential",
  selectedCategory: "",
  customQueue: null,
  queue: [],
  currentIndex: 0,
  score: 0,
  answers: [],
  currentQuestionAnswered: false,
  currentSelectedIndex: null,
  history: {
    sessions: [],
  },
  pausedSession: null,
  flaggedQuestions: {},
  currentPlan: "free",
};

const APP_VERSION = "20260429-plan-1";
const MODE_FEATURE_MAP: Record<Exclude<StudyMode, "retry_wrong">, FeatureKey> = {
  sequential: "sequential_mode",
  random: "random_mode",
  category: "category_mode",
  final14: "final14_mode",
  flagged: "flagged_mode",
};
const {
  PLAN_ORDER,
  PLAN_LABELS,
  PLAN_COPY,
  MODE_LABELS,
  normalizePlanKey,
  hasFeature: featureEnabledForPlan,
} = window.QuizFeatureFlags;
const {
  historyRepository,
  pausedSessionRepository,
  flaggedQuestionRepository,
} = window.QuizStorageRepositories;
const { load: loadPlanStatus, saveManualOverride: savePlanOverride } = window.QuizPlanStatusService;
const { loadPublicCatalog, loadLocalQuestions, resolveInitialSetId } = window.QuizQuestionRepository;
const {
  getFlaggedQuestionIds: resolveFlaggedQuestionIds,
  getFlaggedPriority: resolveFlaggedPriority,
  getQuestionsForMode,
  getRecommendedStudy: resolveRecommendedStudy,
} = window.QuizEngine;
const {
  summarizeHistory,
  buildStudyPlan: resolveStudyPlan,
  buildCategoryPerformance,
  buildRecentSessionViewModels,
} = window.QuizHistoryAnalytics;
const { evaluateAnswer, buildResultSummary, buildSessionRecord } = window.QuizScoring;
const {
  renderQuestionHeader,
  renderChoiceButtons,
  renderAnsweredState: renderAnsweredStateUi,
  renderFeedback: renderFeedbackUi,
  resetQuestionFeedback,
  showNextAction,
} = window.QuizScreenUi;
const {
  renderPlanState: renderStartPlanState,
  renderQuestionSetOptions,
  renderQuestionSetMeta,
  renderQuestionSetSummary,
  renderQuestionSetState,
  renderHistorySummary: renderHistorySummaryUi,
  renderQueuePreview,
  renderFlaggedSummary: renderFlaggedSummaryUi,
  renderRecommendation: renderRecommendationUi,
  renderCategoryButtons,
  setCategoryButtonSelection,
} = window.QuizStartScreenUi;
const { renderSummary, renderInfoCard, renderReviewItems } = window.QuizResultScreenUi;
const { showScreen: showScreenUi, renderResumePanel: renderResumePanelUi } = window.QuizScreenControllerUi;
const {
  buildPausedSession,
  restorePausedSession,
  buildWrongRetryQueue,
  getNextFlagPriority,
} = window.QuizStudySessionActions;
const {
  applyRecommendedStudy,
  applyWeakCategoryStudy,
  applyFlaggedStudy,
  applyModeSelection,
  applyPlanAdjustment,
  resetToStartState,
} = window.QuizStudyFlowActions;

const startScreen = document.getElementById("start-screen") as HTMLElement;
const quizScreen = document.getElementById("quiz-screen") as HTMLElement;
const resultScreen = document.getElementById("result-screen") as HTMLElement;
const questionCountEl = document.getElementById("question-count") as HTMLElement;
const questionSetLabelEl = document.getElementById("question-set-label") as HTMLElement;
const queuePreviewEl = document.getElementById("queue-preview") as HTMLElement;
const flaggedCountEl = document.getElementById("flagged-count") as HTMLElement;
const priorityCountEl = document.getElementById("priority-count") as HTMLElement;
const startButton = document.getElementById("start-button") as HTMLButtonElement;
const questionSetSelect = document.getElementById("question-set-select") as HTMLSelectElement;
const questionSetMeta = document.getElementById("question-set-meta") as HTMLElement;
const questionSetStatus = document.getElementById("question-set-status") as HTMLElement;
const questionSetRetryButton = document.getElementById("question-set-retry-button") as HTMLButtonElement;
const questionSetDescription = document.getElementById("question-set-description") as HTMLElement;
const questionSetTag = document.getElementById("question-set-tag") as HTMLElement;
const premiumUpsellPanel = document.getElementById("premium-upsell-panel") as HTMLElement;
const premiumUpsellTitle = document.getElementById("premium-upsell-title") as HTMLElement;
const premiumUpsellCopy = document.getElementById("premium-upsell-copy") as HTMLElement;
const premiumUnlockButton = document.getElementById("premium-unlock-button") as HTMLButtonElement;
const planTitle = document.getElementById("plan-title") as HTMLElement;
const planCopy = document.getElementById("plan-copy") as HTMLElement;
const planButtons = [...document.querySelectorAll<HTMLButtonElement>(".plan-button")];
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>(".mode-card")];
const categoryPicker = document.getElementById("category-picker") as HTMLElement;
const categoryButtonsWrap = document.getElementById("category-buttons") as HTMLElement;
const historySessionCount = document.getElementById("history-session-count") as HTMLElement;
const historyAnswerCount = document.getElementById("history-answer-count") as HTMLElement;
const historyAverageRate = document.getElementById("history-average-rate") as HTMLElement;
const historyWeakCategory = document.getElementById("history-weak-category") as HTMLElement;
const studyPlan = document.getElementById("study-plan") as HTMLElement;
const recommendTitle = document.getElementById("recommend-title") as HTMLElement;
const recommendCopy = document.getElementById("recommend-copy") as HTMLElement;
const recommendButton = document.getElementById("recommend-button") as HTMLButtonElement;
const categoryStats = document.getElementById("category-stats") as HTMLElement;
const recentSessions = document.getElementById("recent-sessions") as HTMLElement;
const resetHistoryButton = document.getElementById("reset-history-button") as HTMLButtonElement;
const studyPlanPanel = document.getElementById("study-plan-panel") as HTMLElement;
const recommendPanel = document.getElementById("recommend-panel") as HTMLElement;
const categoryStatsPanel = document.getElementById("category-stats-panel") as HTMLElement;
const recentSessionsPanel = document.getElementById("recent-sessions-panel") as HTMLElement;
const resumePanel = document.getElementById("resume-panel") as HTMLElement;
const resumeTitle = document.getElementById("resume-title") as HTMLElement;
const resumeDescription = document.getElementById("resume-description") as HTMLElement;
const resumeButton = document.getElementById("resume-button") as HTMLButtonElement;
const discardResumeButton = document.getElementById("discard-resume-button") as HTMLButtonElement;
const progressText = document.getElementById("progress-text") as HTMLElement;
const questionTitle = document.getElementById("question-title") as HTMLElement;
const categoryBadge = document.getElementById("category-badge") as HTMLElement;
const subtopicBadge = document.getElementById("subtopic-badge") as HTMLElement;
const flagToggleButton = document.getElementById("flag-toggle-button") as HTMLButtonElement;
const choicesWrap = document.getElementById("choices") as HTMLElement;
const scoreText = document.getElementById("score-text") as HTMLElement;
const feedbackCard = document.getElementById("feedback-card") as HTMLElement;
const feedbackStatus = document.getElementById("feedback-status") as HTMLElement;
const feedbackExplanation = document.getElementById("feedback-explanation") as HTMLElement;
const memoryTip = document.getElementById("memory-tip") as HTMLElement;
const optionReasons = document.getElementById("option-reasons") as HTMLElement;
const nextButton = document.getElementById("next-button") as HTMLButtonElement;
const pauseButton = document.getElementById("pause-button") as HTMLButtonElement;
const abortButton = document.getElementById("abort-button") as HTMLButtonElement;
const resultTitle = document.getElementById("result-title") as HTMLElement;
const resultRate = document.getElementById("result-rate") as HTMLElement;
const weakCategory = document.getElementById("weak-category") as HTMLElement;
const resultMode = document.getElementById("result-mode") as HTMLElement;
const reviewList = document.getElementById("review-list") as HTMLElement;
const resultPremiumPanel = document.getElementById("result-premium-panel") as HTMLElement;
const resultPremiumTitle = document.getElementById("result-premium-title") as HTMLElement;
const resultPremiumCopy = document.getElementById("result-premium-copy") as HTMLElement;
const resultUpgradeButton = document.getElementById("result-upgrade-button") as HTMLButtonElement;
const focusWeakButton = document.getElementById("focus-weak-button") as HTMLButtonElement;
const retryWrongButton = document.getElementById("retry-wrong-button") as HTMLButtonElement;
const retryFlaggedButton = document.getElementById("retry-flagged-button") as HTMLButtonElement;
const restartButton = document.getElementById("restart-button") as HTMLButtonElement;
const quizScreenBindings: QuizScreenBindings = {
  progressText,
  questionTitle,
  categoryBadge,
  subtopicBadge,
  choicesWrap,
  feedbackCard,
  feedbackStatus,
  feedbackExplanation,
  memoryTip,
  optionReasons,
  nextButton,
  pauseButton,
  abortButton,
};
const startScreenBindings: StartScreenBindings = {
  planTitle,
  planCopy,
  questionSetSelect,
  questionSetMeta,
  questionSetStatus,
  questionSetRetryButton,
  questionSetDescription,
  questionSetTag,
  planButtons,
  modeButtons,
  categoryPicker,
  studyPlanPanel,
  recommendPanel,
  categoryStatsPanel,
  recentSessionsPanel,
  queuePreview: queuePreviewEl,
  flaggedCount: flaggedCountEl,
  priorityCount: priorityCountEl,
  historySessionCount,
  historyAnswerCount,
  historyAverageRate,
  historyWeakCategory,
  categoryButtonsWrap,
  recommendTitle,
  recommendCopy,
};
const resultScreenBindings: ResultScreenBindings = {
  resultTitle,
  resultRate,
  weakCategory,
  resultMode,
  reviewList,
};
const screenBindings: ScreenBindings = {
  startScreen,
  quizScreen,
  resultScreen,
  resumePanel,
  resumeTitle,
  resumeDescription,
};

const PREMIUM_PRICE_LABEL = "3級プレミアム版 1,200円 / 追加月額料金なし";
const PREMIUM_FEATURE_COPY: Record<FeatureKey, string> = {
  sequential_mode: "無料版で利用できます。",
  random_mode: "無料版で利用できます。",
  category_mode: "カテゴリ別学習で苦手分野だけを集中して仕上げられます。",
  final14_mode: "直前14日モードで試験1か月前の反復を迷わず回せます。",
  flagged_mode: "要復習キューで自分の弱点だけをまとめて解き直せます。",
  pause_resume: "中断再開でスキマ時間の学習を無駄なく続けられます。",
  retry_wrong: "間違えた問題だけ復習して、取りこぼしを減らせます。",
  weak_focus: "苦手カテゴリだけを続けて学習して弱点を狙って埋められます。",
  study_plan: "試験日までの学習プランで、直前期の進め方を迷わず決められます。",
  recommendation: "今日のおすすめ問題で、次に解くべき内容を自動で案内します。",
  category_stats: "苦手カテゴリ分析で、重点的に復習すべき分野がすぐ分かります。",
  recent_sessions: "詳細な学習履歴で、直近の正答率と進み方を振り返れます。",
  flagged_priority: "最重点設定で、特に落としたくない問題を先頭で復習できます。",
};

function getNormalizedPlanLabel(planKey: string | null | undefined): string {
  return PLAN_LABELS[normalizePlanKey(planKey)];
}

function getPremiumLockMessage(featureKey: FeatureKey): string {
  return `プレミアム版で解放: ${PREMIUM_FEATURE_COPY[featureKey]}`;
}

function showPremiumPrompt(sourceLabel: string): void {
  window.alert(
    `${sourceLabel}\n\n` +
      `プレミアム版では、3級の全問題、カテゴリ別学習、間違えた問題だけ復習、要復習キュー、` +
      `苦手カテゴリ分析、今日のおすすめ、直前14日モード、試験日までの学習プランを利用できます。\n` +
      `想定価格: ${PREMIUM_PRICE_LABEL}`,
  );
}

function renderStartPremiumUpsell(): void {
  const isPremium = state.currentPlan === "premium";
  premiumUpsellPanel.classList.toggle("hidden", isPremium);
  if (isPremium) {
    return;
  }

  const lockedMode = !hasFeature(MODE_FEATURE_MAP[state.mode]) ? state.mode : null;
  if (lockedMode === "category") {
    premiumUpsellTitle.textContent = "カテゴリ別学習で苦手だけを一気に詰める";
    premiumUpsellCopy.textContent =
      "プレミアム版なら、著作権・商標・特許・意匠の苦手分野だけを選んで集中学習できます。";
    return;
  }
  if (lockedMode === "final14") {
    premiumUpsellTitle.textContent = "直前14日モードで試験1か月前を迷わず回す";
    premiumUpsellCopy.textContent =
      "プレミアム版なら、苦手優先の反復と学習プランで直前期の仕上げ導線をまとめて使えます。";
    return;
  }
  if (lockedMode === "flagged") {
    premiumUpsellTitle.textContent = "間違えた問題と要復習を自動で回し直す";
    premiumUpsellCopy.textContent =
      "プレミアム版なら、自分の弱点だけをキュー化して、復習を迷わず続けられます。";
    return;
  }

  premiumUpsellTitle.textContent = "無料で試したあと、そのまま仕上げまで進める";
  premiumUpsellCopy.textContent =
    "プレミアム版では、全問題に加えて苦手復習、今日のおすすめ、直前14日モードが使えます。";
}

function renderResultPremiumUpsell(summary: QuizResultSummary): void {
  const shouldShow = state.currentPlan === "free";
  resultPremiumPanel.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) {
    return;
  }

  if (summary.state === "not_answered") {
    resultPremiumTitle.textContent = "仕上げ段階では中断再開と復習導線が効きます";
    resultPremiumCopy.textContent =
      "プレミアム版なら、中断再開、要復習キュー、今日のおすすめを使って短い時間でも積み上げやすくなります。";
    return;
  }

  if (summary.state === "all_correct") {
    resultPremiumTitle.textContent = "次は問題数を広げて合格ラインを安定させる";
    resultPremiumCopy.textContent =
      "プレミアム版なら、全問題とカテゴリ別学習で理解を広げつつ、直前14日モードで仕上げまでつなげられます。";
    return;
  }

  resultPremiumTitle.textContent = "苦手を残さず仕上げる";
  resultPremiumCopy.textContent =
    "プレミアム版では、間違えた問題だけ復習、苦手カテゴリ分析、直前14日モードで弱点を自動で回せます。";
}

function syncCurrentSetIdToUrl(setId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set("set_id", setId);
  window.history.replaceState({}, "", url.toString());
}

function renderQuestionSetUiState(): void {
  const hasSets = state.availableSets.length > 0;
  const statusText = state.questionLoadError
    ? state.questionLoadError
    : state.isLoadingSet
      ? "問題セットを読み込んでいます..."
      : hasSets
        ? "準備完了"
        : "公開中の問題セットがありません。";

  renderQuestionSetState(startScreenBindings, {
    statusText,
    disableSelect: state.isLoadingSet || state.availableSets.length <= 1,
    showRetry: Boolean(state.questionLoadError),
  });

  startButton.disabled = state.isLoadingSet || !hasSets || Boolean(state.questionLoadError) || state.questions.length === 0;
  startButton.textContent = state.isLoadingSet ? "読み込み中..." : "学習をはじめる";
}

function beginQuestionSetLoading(): void {
  state.isLoadingSet = true;
  state.questionLoadError = "";
  renderQuestionSetUiState();
}

function finishQuestionSetLoading(errorMessage = ""): void {
  state.isLoadingSet = false;
  state.questionLoadError = errorMessage;
  renderQuestionSetUiState();
}

function renderQuestionSetCatalog(): void {
  renderQuestionSetOptions(startScreenBindings, state.availableSets, state.currentSetId);
  const currentSet = state.availableSets.find((setItem) => setItem.set_id === state.currentSetId);
  const label = currentSet?.label || state.currentSetLabel || "承認済み問題";
  const count = currentSet?.question_count ?? state.questions.length;
  const level = currentSet?.level || "";
  const description = currentSet?.short_description || state.currentSetDescription || "公開中の問題セットです。";
  const audienceTag = currentSet?.audience_tag || state.currentSetTag || "標準セット";
  const planLabel = getNormalizedPlanLabel(currentSet?.required_plan);
  questionSetLabelEl.textContent = label;
  renderQuestionSetMeta(
    startScreenBindings,
    currentSet
      ? `${level} / ${planLabel} / ${count}問`
      : "公開中の問題セットから選べます。",
  );
  renderQuestionSetSummary(startScreenBindings, description, audienceTag);
  renderQuestionSetUiState();
}

async function loadCatalog(): Promise<void> {
  beginQuestionSetLoading();
  const sets = await loadPublicCatalog(APP_VERSION, state.currentPlan);
  state.availableSets = sets;
  const initialSetId = resolveInitialSetId();

  if (sets.length > 0) {
    const matchedSet = sets.find((setItem) => setItem.set_id === initialSetId);
    state.currentSetId = matchedSet?.set_id || sets[0].set_id;
    state.currentSetLabel = matchedSet?.label || sets[0].label;
    state.currentSetDescription = matchedSet?.short_description || sets[0].short_description;
    state.currentSetTag = matchedSet?.audience_tag || sets[0].audience_tag;
  } else if (initialSetId) {
    state.currentSetId = initialSetId;
  }

  renderQuestionSetCatalog();
  syncCurrentSetIdToUrl(state.currentSetId);
  finishQuestionSetLoading(sets.length === 0 ? "公開中の問題セットがありません。" : "");
}

async function loadQuestions(setId: string = state.currentSetId): Promise<void> {
  beginQuestionSetLoading();
  const payload = await loadLocalQuestions(APP_VERSION, setId, state.currentPlan);
  state.questions = payload.questions;
  state.currentSetId = setId;
  state.currentSetLabel = payload.set_name;
  state.currentSetDescription = payload.set_description || state.currentSetDescription;
  state.currentSetTag = payload.set_tag || state.currentSetTag;
  syncCurrentSetIdToUrl(setId);
  questionCountEl.textContent = `${state.questions.length}問`;
  questionSetLabelEl.textContent = payload.set_name;
  renderQuestionSetCatalog();
  buildCategoryButtons();
  renderPlanState();
  renderStudyPlan();
  updateQueuePreview();
  finishQuestionSetLoading(payload.question_count === 0 ? "この問題セットには問題がありません。" : "");
}

function loadHistory(): void {
  state.history = historyRepository.load();
}

function saveHistory(): void {
  historyRepository.save(state.history);
}

function loadPlan(): void {
  const planStatus = loadPlanStatus("free");
  state.currentPlan = planStatus.activePlan;
}

function savePlan(): void {
  savePlanOverride(state.currentPlan);
}

function loadFlaggedQuestions(): void {
  state.flaggedQuestions = flaggedQuestionRepository.load();
}

function saveFlaggedQuestions(): void {
  flaggedQuestionRepository.save(state.flaggedQuestions);
}

function hasFeature(featureKey: FeatureKey): boolean {
  return featureEnabledForPlan(state.currentPlan, featureKey);
}

function getFlaggedQuestionIds(): string[] {
  return resolveFlaggedQuestionIds(state.flaggedQuestions);
}

function getFlaggedPriority(questionId: string): number {
  return resolveFlaggedPriority(state.flaggedQuestions, questionId);
}

function loadPausedSession(): void {
  state.pausedSession = pausedSessionRepository.load();
}

function savePausedSession(): void {
  pausedSessionRepository.save(state.pausedSession);
}

function renderHistorySummary(): void {
  const summary = summarizeHistory(state.history);
  renderHistorySummaryUi(startScreenBindings, summary);
  renderStudyPlan();
  renderCategoryStats();
  renderRecentSessions();
  renderRecommendation();
  renderFlaggedSummary();
}

function renderPlanState(): void {
  renderStartPlanState(startScreenBindings, {
    planLabel: PLAN_LABELS[state.currentPlan],
    planCopy: PLAN_COPY[state.currentPlan],
    currentPlan: state.currentPlan,
    currentMode: state.mode,
    selectedCategory: state.selectedCategory,
    modeAvailability: {
      sequential: {
        enabled: hasFeature(MODE_FEATURE_MAP.sequential),
        lockedMessage: getPremiumLockMessage(MODE_FEATURE_MAP.sequential),
      },
      random: {
        enabled: hasFeature(MODE_FEATURE_MAP.random),
        lockedMessage: getPremiumLockMessage(MODE_FEATURE_MAP.random),
      },
      category: {
        enabled: hasFeature(MODE_FEATURE_MAP.category),
        lockedMessage: getPremiumLockMessage(MODE_FEATURE_MAP.category),
      },
      final14: {
        enabled: hasFeature(MODE_FEATURE_MAP.final14),
        lockedMessage: getPremiumLockMessage(MODE_FEATURE_MAP.final14),
      },
      flagged: {
        enabled: hasFeature(MODE_FEATURE_MAP.flagged),
        lockedMessage: getPremiumLockMessage(MODE_FEATURE_MAP.flagged),
      },
    },
    panelVisibility: {
      categoryPicker: state.mode === "category" && hasFeature("category_mode"),
      studyPlan: hasFeature("study_plan"),
      recommendation: hasFeature("recommendation"),
      categoryStats: hasFeature("category_stats"),
      recentSessions: hasFeature("recent_sessions"),
    },
  });
  pauseButton.classList.toggle("hidden", !hasFeature("pause_resume"));
  flagToggleButton.classList.toggle("hidden", !hasFeature("flagged_mode"));
  retryWrongButton.classList.toggle("hidden", !hasFeature("retry_wrong"));
  renderStartPremiumUpsell();

  if (!hasFeature("pause_resume")) {
    resumePanel.classList.add("hidden");
  } else {
    renderResumePanel();
  }
}

function renderResumePanel(): void {
  if (!hasFeature("pause_resume")) {
    renderResumePanelUi(screenBindings, {
      visible: false,
      title: "",
      description: "",
    });
    return;
  }
  const paused = state.pausedSession;
  if (!paused) {
    renderResumePanelUi(screenBindings, {
      visible: false,
      title: "",
      description: "",
    });
    return;
  }

  const answeredCount = paused.answers.length;
  const pausedModeLabel = paused.customQueue ? MODE_LABELS.retry_wrong : MODE_LABELS[paused.mode];
  renderResumePanelUi(screenBindings, {
    visible: true,
    title: `${pausedModeLabel} を ${answeredCount}問回答済み`,
    description: `${paused.currentIndex + 1}問目から再開できます。カテゴリ: ${paused.selectedCategory || "全体"}`,
  });
}

function buildCategoryButtons(): void {
  const categories = [...new Set(state.questions.map((question) => question.category))];
  state.selectedCategory = categories[0] || "";
  renderCategoryButtons(startScreenBindings, categories, state.selectedCategory, (category) => {
    state.selectedCategory = category;
    setCategoryButtonSelection(startScreenBindings, category);
    updateQueuePreview();
  });
}

function getQuestionsForCurrentMode(): QuizQuestion[] {
  return getQuestionsForMode({
    questions: state.questions,
    mode: state.mode,
    selectedCategory: state.selectedCategory,
    customQueue: state.customQueue,
    historySessions: state.history.sessions,
    flaggedQuestions: state.flaggedQuestions,
    featureAvailability: {
      categoryMode: hasFeature("category_mode"),
      final14Mode: hasFeature("final14_mode"),
      flaggedMode: hasFeature("flagged_mode"),
    },
  });
}

function updateQueuePreview(): void {
  const previewQueue = getQuestionsForCurrentMode();
  if (state.customQueue) {
    renderQueuePreview(startScreenBindings, `復習セット ${previewQueue.length}問`);
    return;
  }
  if (state.mode === "category") {
    if (!hasFeature("category_mode")) {
      renderQueuePreview(startScreenBindings, "プレミアム版でカテゴリ別学習を解放");
      return;
    }
    renderQueuePreview(startScreenBindings, `${state.selectedCategory} ${previewQueue.length}問`);
    return;
  }
  if (state.mode === "final14") {
    if (!hasFeature("final14_mode")) {
      renderQueuePreview(startScreenBindings, "プレミアム版で直前14日モードを解放");
      return;
    }
    renderQueuePreview(startScreenBindings, `直前セット ${previewQueue.length}問`);
    return;
  }
  if (state.mode === "flagged") {
    if (!hasFeature("flagged_mode")) {
      renderQueuePreview(startScreenBindings, "プレミアム版で要復習キューを解放");
      return;
    }
    renderQueuePreview(startScreenBindings, `要復習セット ${previewQueue.length}問`);
    return;
  }
  renderQueuePreview(startScreenBindings, `全${previewQueue.length}問`);
}

function startQuiz(): void {
  if (
    (state.mode === "category" && !hasFeature("category_mode")) ||
    (state.mode === "final14" && !hasFeature("final14_mode")) ||
    (state.mode === "flagged" && !hasFeature("flagged_mode"))
  ) {
    showPremiumPrompt("この学習モードはプレミアム版で利用できます。");
    return;
  }
  state.queue = getQuestionsForCurrentMode();
  if (state.queue.length === 0) {
    window.alert("出題できる問題がありません。");
    return;
  }
  state.currentIndex = 0;
  state.score = 0;
  state.answers = [];
  state.currentQuestionAnswered = false;
  state.currentSelectedIndex = null;
  clearPausedSession();
  scoreText.textContent = "0";
  showScreen("quiz");
  renderQuestion();
}

function renderQuestion(): void {
  const question = state.queue[state.currentIndex];
  renderQuestionHeader(quizScreenBindings, {
    progressText: `${state.currentIndex + 1} / ${state.queue.length}`,
    title: question.prompt,
    category: question.category,
    subtopic: question.subtopic,
  });
  renderFlagButton(question.id);
  resetQuestionFeedback(quizScreenBindings);
  renderChoiceButtons(quizScreenBindings, question.options, handleAnswer);

  if (state.currentQuestionAnswered && state.currentSelectedIndex !== null) {
    const answeredEntry = [...state.answers]
      .reverse()
      .find((answer) => answer.questionId === question.id && answer.selectedIndex === state.currentSelectedIndex);
    renderAnsweredState(question, state.currentSelectedIndex);
    renderFeedback(
      question,
      answeredEntry ? answeredEntry.correct : state.currentSelectedIndex === question.answer_index,
      state.currentSelectedIndex,
    );
    showNextAction(quizScreenBindings);
  }
}

function renderFlagButton(questionId: string): void {
  const priority = getFlaggedPriority(questionId);
  flagToggleButton.classList.toggle("is-flagged", priority >= 1);
  flagToggleButton.classList.toggle("is-priority-high", priority >= 2);

  if (!hasFeature("flagged_mode")) {
    flagToggleButton.textContent = "プレミアム版で要復習キューを解放";
  } else if (priority === 0) {
    flagToggleButton.textContent = "この問題を要復習にする";
  } else if (priority === 1 && hasFeature("flagged_priority")) {
    flagToggleButton.textContent = "要復習 → 最重点にする";
  } else if (priority === 1) {
    flagToggleButton.textContent = "要復習 → 解除する";
  } else {
    flagToggleButton.textContent = "最重点 → 解除する";
  }
}

function handleAnswer(selectedIndex: number, selectedButton: HTMLButtonElement): void {
  const question = state.queue[state.currentIndex];
  const isCorrect = evaluateAnswer(question, selectedIndex);
  state.currentQuestionAnswered = true;
  state.currentSelectedIndex = selectedIndex;
  renderAnsweredState(question, selectedIndex, selectedButton, isCorrect);

  if (isCorrect) {
    state.score += 1;
    scoreText.textContent = String(state.score);
  }

  state.answers.push({
    questionId: question.id,
    category: question.category,
    correct: isCorrect,
    selectedIndex,
  });

  renderFeedback(question, isCorrect, selectedIndex);
  showNextAction(quizScreenBindings);
}

function renderAnsweredState(
  question: QuizQuestion,
  selectedIndex: number,
  selectedButton: HTMLButtonElement | null = null,
  precomputedCorrect: boolean | null = null,
): void {
  renderAnsweredStateUi(
    quizScreenBindings,
    question.answer_index,
    selectedIndex,
    selectedButton,
    precomputedCorrect ?? selectedIndex === question.answer_index,
  );
}

function renderFeedback(question: QuizQuestion, isCorrect: boolean, selectedIndex: number): void {
  renderFeedbackUi(quizScreenBindings, {
    statusText: isCorrect ? "正解" : "不正解",
    statusClassName: `feedback-status ${isCorrect ? "is-correct" : "is-wrong"}`,
    explanation: question.explanation,
    memoryTip: question.memory_tip,
    wrongReason: !isCorrect ? question.option_explanations[selectedIndex] || "" : "",
    correctOption: question.options[question.answer_index],
  });
}

function showNext(): void {
  state.currentIndex += 1;
  state.currentQuestionAnswered = false;
  state.currentSelectedIndex = null;
  if (state.currentIndex >= state.queue.length) {
    recordSession();
    renderResults();
    showScreen("result");
    return;
  }
  renderQuestion();
}

function renderResults(): void {
  const summary = buildResultSummary({
    answers: state.answers,
    queueLength: state.queue.length,
    score: state.score,
    modeLabel: state.customQueue ? "間違えた問題だけ復習" : MODE_LABELS[state.mode],
  });
  renderSummary(resultScreenBindings, summary);
  renderResultPremiumUpsell(summary);

  if (summary.state === "not_answered") {
    focusWeakButton.classList.add("hidden");
    retryWrongButton.classList.add("hidden");
    retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));
    renderInfoCard(
      resultScreenBindings,
      "回答前に中止しました",
      "この回では評価対象の回答がありません。次は1問だけでも解いてから振り返ると学習傾向が見えやすくなります。",
    );
    return;
  }

  if (summary.state === "all_correct") {
    focusWeakButton.classList.add("hidden");
    retryWrongButton.classList.add("hidden");
    retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));
    renderInfoCard(
      resultScreenBindings,
      "全問正解",
      "このセットは十分に理解できています。次は問題数を増やしても良さそうです。",
    );
    return;
  }

  focusWeakButton.classList.toggle("hidden", !hasFeature("weak_focus"));
  retryWrongButton.classList.toggle("hidden", !hasFeature("retry_wrong"));
  retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));

  const reviewItems: ResultReviewItem[] = [];
  summary.wrongAnswers.forEach((answer) => {
    const question = state.queue.find((item) => item.id === answer.questionId);
    if (!question) return;
    reviewItems.push({
      title: `${question.category} / ${question.subtopic}`,
      prompt: question.prompt,
      memoryTip: question.memory_tip,
    });
  });
  renderReviewItems(resultScreenBindings, reviewItems);
}

function recordSession(): void {
  const session = buildSessionRecord({
    answers: state.answers,
    queueLength: state.queue.length,
    score: state.score,
    mode: state.mode,
    customQueue: state.customQueue,
  });
  state.history.sessions.push(session);
  state.history.sessions = state.history.sessions.slice(-40);
  saveHistory();
  renderHistorySummary();
}

function pauseQuiz(): void {
  state.pausedSession = buildPausedSession({
    mode: state.mode,
    selectedCategory: state.selectedCategory,
    customQueue: state.customQueue,
    queue: state.queue,
    currentIndex: state.currentIndex,
    score: state.score,
    answers: state.answers,
    currentQuestionAnswered: state.currentQuestionAnswered,
    currentSelectedIndex: state.currentSelectedIndex,
  });
  savePausedSession();
  renderResumePanel();
  updateQueuePreview();
  showScreen("start");
}

function clearPausedSession(): void {
  state.pausedSession = null;
  savePausedSession();
  renderResumePanel();
}

function resumeQuiz(): void {
  const paused = state.pausedSession;
  if (!paused) return;

  const restored = restorePausedSession(paused);
  state.mode = restored.mode;
  state.selectedCategory = restored.selectedCategory;
  state.customQueue = restored.customQueue;
  state.queue = restored.queue;
  state.currentIndex = restored.currentIndex;
  state.score = restored.score;
  state.answers = restored.answers;
  state.currentQuestionAnswered = restored.currentQuestionAnswered;
  state.currentSelectedIndex = restored.currentSelectedIndex;

  scoreText.textContent = String(state.score);
  renderPlanState();
  showScreen("quiz");
  renderQuestion();
}

function abortQuiz(): void {
  clearPausedSession();
  recordSession();
  renderResults();
  showScreen("result");
}

function startWrongRetryQuiz(): void {
  state.customQueue = buildWrongRetryQueue(state.questions, state.answers);
  if (state.customQueue.length === 0) {
    return;
  }
  updateQueuePreview();
  startQuiz();
}

function renderStudyPlan(): void {
  const cards = resolveStudyPlan(state.questions, state.history).map(
    (entry) => `
      <article class="plan-card">
        <span class="summary-label">Day ${entry.day}</span>
        <strong>${entry.category}</strong>
        <p>${entry.intensity}で 5問前後。${entry.note}</p>
      </article>
    `,
  );
  studyPlan.innerHTML = cards.join("");
}

function renderCategoryStats(): void {
  const cards = buildCategoryPerformance(state.questions, state.history).map((entry) => {
    if (entry.answered === 0 || entry.rate === null) {
      return `
        <article class="stat-card">
          <span class="summary-label">${entry.category}</span>
          <strong>まだ履歴なし</strong>
          <p>このカテゴリを解くと、正答率と学習量がここに表示されます。</p>
        </article>
      `;
    }
    return `
      <article class="stat-card">
        <span class="summary-label">${entry.category}</span>
        <strong>${entry.rate}% 正解</strong>
        <p>${entry.answered}問回答 / ${entry.correct}問正解</p>
      </article>
    `;
  });
  categoryStats.innerHTML = cards.join("");
}

function renderRecentSessions(): void {
  const sessions = buildRecentSessionViewModels(state.history, MODE_LABELS);
  if (sessions.length === 0) {
    recentSessions.innerHTML = `
      <article class="session-card">
        <span class="summary-label">まだ履歴なし</span>
        <strong>最初の1回を解くと、ここに記録されます。</strong>
        <p>途中中止も履歴に残るので、学習ペースを見返しやすくなります。</p>
      </article>
    `;
    return;
  }

  recentSessions.innerHTML = sessions
    .map((session) => {
      return `
        <article class="session-card">
          <span class="summary-label">${session.playedAtLabel}</span>
          <strong>${session.modeLabel}</strong>
          <p>${session.answeredCount}問回答 / ${session.correctCount}問正解 / 正答率 ${session.rate}%</p>
        </article>
      `;
    })
    .join("");
}

function getRecommendedStudy(): RecommendedStudy {
  return resolveRecommendedStudy({
    historySessions: state.history.sessions,
    flaggedQuestions: state.flaggedQuestions,
    recentWeakCategory: historyWeakCategory.textContent,
    featureAvailability: {
      categoryMode: hasFeature("category_mode"),
      final14Mode: hasFeature("final14_mode"),
      flaggedMode: hasFeature("flagged_mode"),
    },
  });
}

function renderRecommendation(): void {
  if (!hasFeature("recommendation")) {
    return;
  }
  const recommendation = getRecommendedStudy();
  renderRecommendationUi(startScreenBindings, recommendation);
}

function renderFlaggedSummary(): void {
  const flaggedIds = getFlaggedQuestionIds();
  const priorityCount = flaggedIds.filter((id) => getFlaggedPriority(id) >= 2).length;
  renderFlaggedSummaryUi(startScreenBindings, flaggedIds.length, priorityCount);
}

function resetHistory(): void {
  const confirmed = window.confirm("学習履歴をリセットします。よろしいですか。");
  if (!confirmed) {
    return;
  }
  state.history = { sessions: [] };
  saveHistory();
  renderHistorySummary();
}

function startRecommendedQuiz(): void {
  if (!hasFeature("recommendation")) {
    showPremiumPrompt("今日のおすすめ問題はプレミアム版で利用できます。");
    return;
  }
  const recommendation = getRecommendedStudy();
  const nextState = applyRecommendedStudy(
    {
      mode: state.mode,
      selectedCategory: state.selectedCategory,
      customQueue: state.customQueue,
    },
    recommendation,
  );
  state.customQueue = nextState.customQueue;
  state.mode = nextState.mode;
  state.selectedCategory = nextState.selectedCategory;
  renderPlanState();
  updateQueuePreview();
  startQuiz();
}

function toggleCurrentQuestionFlag(): void {
  const question = state.queue[state.currentIndex];
  if (!question) return;
  if (!hasFeature("flagged_mode")) {
    showPremiumPrompt("要復習キューはプレミアム版で利用できます。");
    return;
  }

  const currentPriority = getFlaggedPriority(question.id);
  const nextPriority = getNextFlagPriority(currentPriority, hasFeature("flagged_priority"));
  if (nextPriority === 0) {
    delete state.flaggedQuestions[question.id];
  } else {
    state.flaggedQuestions[question.id] = nextPriority;
  }
  saveFlaggedQuestions();
  renderFlaggedSummary();
  renderRecommendation();
  renderFlagButton(question.id);
  updateQueuePreview();
  retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));
}

function focusWeakCategoryStudy(): void {
  const category = weakCategory.textContent;
  if (!hasFeature("weak_focus")) {
    showPremiumPrompt("苦手カテゴリ学習はプレミアム版で利用できます。");
    return;
  }
  if (!category || category === "なし" || category === "まだなし") {
    return;
  }
  const nextState = applyWeakCategoryStudy(
    {
      mode: state.mode,
      selectedCategory: state.selectedCategory,
      customQueue: state.customQueue,
    },
    category,
  );
  state.customQueue = nextState.customQueue;
  state.mode = nextState.mode;
  state.selectedCategory = nextState.selectedCategory;
  renderPlanState();
  updateQueuePreview();
  startQuiz();
}

function startFlaggedQuiz(): void {
  if (!hasFeature("flagged_mode")) {
    showPremiumPrompt("要復習だけ学習はプレミアム版で利用できます。");
    return;
  }
  if (getFlaggedQuestionIds().length === 0) {
    window.alert("要復習に入っている問題がまだありません。");
    return;
  }
  const nextState = applyFlaggedStudy({
    mode: state.mode,
    selectedCategory: state.selectedCategory,
    customQueue: state.customQueue,
  });
  state.customQueue = nextState.customQueue;
  state.mode = nextState.mode;
  state.selectedCategory = nextState.selectedCategory;
  renderPlanState();
  updateQueuePreview();
  startQuiz();
}

function showScreen(screen: "start" | "quiz" | "result"): void {
  showScreenUi(screenBindings, screen);
}

async function refreshSetsForCurrentPlan(): Promise<void> {
  await loadCatalog();
  if (state.availableSets.length === 0) {
    state.questions = [];
    questionCountEl.textContent = "0問";
    questionSetLabelEl.textContent = "公開中セットなし";
    return;
  }
  const nextSetId = state.availableSets.some((setItem) => setItem.set_id === state.currentSetId)
    ? state.currentSetId
    : state.availableSets[0].set_id;
  await loadQuestions(nextSetId);
}

async function setCurrentPlan(planKey: PlanKey): Promise<void> {
  if (!PLAN_ORDER.includes(planKey)) return;
  state.currentPlan = planKey;
  savePlan();

  const adjustedState = applyPlanAdjustment({
    currentMode: state.mode,
    planKey,
    featureAvailability: {
      categoryMode: hasFeature("category_mode"),
      final14Mode: hasFeature("final14_mode"),
      flaggedMode: hasFeature("flagged_mode"),
    },
  });
  state.mode = adjustedState.mode;
  state.customQueue = adjustedState.customQueue;
  if (adjustedState.selectedCategory) {
    state.selectedCategory = adjustedState.selectedCategory;
  }

  renderHistorySummary();
  renderPlanState();
  renderFlagButton(state.queue[state.currentIndex]?.id || "");
  updateQueuePreview();
  try {
    await refreshSetsForCurrentPlan();
  } catch (error: unknown) {
    console.error(error);
    finishQuestionSetLoading(error instanceof Error ? error.message : "問題セットの読み込みに失敗しました。");
    renderQuestionSetCatalog();
  }
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const featureKey = button.dataset.feature as FeatureKey;
    if (!hasFeature(featureKey)) {
      showPremiumPrompt(getPremiumLockMessage(featureKey));
      return;
    }
    const nextState = applyModeSelection(
      {
        mode: state.mode,
        selectedCategory: state.selectedCategory,
        customQueue: state.customQueue,
      },
      button.dataset.mode as Exclude<StudyMode, "retry_wrong">,
    );
    state.mode = nextState.mode;
    state.customQueue = nextState.customQueue;
    state.selectedCategory = nextState.selectedCategory;
    renderPlanState();
    updateQueuePreview();
  });
});

planButtons.forEach((button) => {
  button.addEventListener("click", () => {
    void setCurrentPlan(button.dataset.plan as PlanKey);
  });
});

questionSetSelect.addEventListener("change", async () => {
  const nextSetId = questionSetSelect.value;
  if (!nextSetId || nextSetId === state.currentSetId) {
    return;
  }

  state.customQueue = null;
  state.mode = "sequential";
  state.selectedCategory = "";

  try {
    await loadQuestions(nextSetId);
  } catch (error: unknown) {
    console.error(error);
    finishQuestionSetLoading(error instanceof Error ? error.message : "問題セットの読み込みに失敗しました。");
    renderQuestionSetCatalog();
    return;
  }

  renderPlanState();
  updateQueuePreview();
});

questionSetRetryButton.addEventListener("click", async () => {
  try {
    await refreshSetsForCurrentPlan();
  } catch (error: unknown) {
    console.error(error);
    finishQuestionSetLoading(error instanceof Error ? error.message : "問題セットの読み込みに失敗しました。");
    renderQuestionSetCatalog();
  }
});

startButton.addEventListener("click", startQuiz);
nextButton.addEventListener("click", showNext);
pauseButton.addEventListener("click", pauseQuiz);
abortButton.addEventListener("click", abortQuiz);
resumeButton.addEventListener("click", resumeQuiz);
discardResumeButton.addEventListener("click", clearPausedSession);
retryWrongButton.addEventListener("click", startWrongRetryQuiz);
retryFlaggedButton.addEventListener("click", startFlaggedQuiz);
focusWeakButton.addEventListener("click", focusWeakCategoryStudy);
recommendButton.addEventListener("click", startRecommendedQuiz);
flagToggleButton.addEventListener("click", toggleCurrentQuestionFlag);
resetHistoryButton.addEventListener("click", resetHistory);
premiumUnlockButton.addEventListener("click", () => showPremiumPrompt("プレミアム版の内容を確認します。"));
resultUpgradeButton.addEventListener("click", () => showPremiumPrompt("プレミアム版で復習導線を解放します。"));
restartButton.addEventListener("click", () => {
  const nextState = resetToStartState({
    mode: state.mode,
    selectedCategory: state.selectedCategory,
    customQueue: state.customQueue,
  });
  state.customQueue = nextState.customQueue;
  state.mode = nextState.mode;
  state.selectedCategory = nextState.selectedCategory;
  renderPlanState();
  updateQueuePreview();
  showScreen("start");
});

loadHistory();
loadPausedSession();
loadFlaggedQuestions();
loadPlan();
renderHistorySummary();
renderResumePanel();
renderPlanState();
(async () => {
  try {
    await loadCatalog();
    await loadQuestions(state.currentSetId);
  } catch (error: unknown) {
    console.error(error);
    questionCountEl.textContent = "読み込み失敗";
    questionSetLabelEl.textContent = "取得失敗";
    finishQuestionSetLoading(error instanceof Error ? error.message : "問題セットの読み込みに失敗しました。");
    renderQuestionSetCatalog();
  }
})();
