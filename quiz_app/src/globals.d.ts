declare global {
  type PlanKey = "free" | "premium";

  type StudyMode =
    | "sequential"
    | "random"
    | "category"
    | "final14"
    | "retry_wrong"
    | "flagged";

  type FeatureKey =
    | "sequential_mode"
    | "random_mode"
    | "category_mode"
    | "final14_mode"
    | "flagged_mode"
    | "pause_resume"
    | "retry_wrong"
    | "weak_focus"
    | "study_plan"
    | "recommendation"
    | "category_stats"
    | "recent_sessions"
    | "flagged_priority";

  interface QuizQuestion {
    id: string;
    level: string;
    category: string;
    subtopic: string;
    prompt: string;
    options: string[];
    answer_index: number;
    explanation: string;
    option_explanations: string[];
    memory_tip: string;
  }

  interface QuestionPayload {
    version: string;
    set_name: string;
    set_description?: string;
    set_tag?: string;
    required_plan?: string;
    question_count: number;
    questions: QuizQuestion[];
  }

  interface QuestionSetCatalogItem {
    set_id: string;
    label: string;
    short_description: string;
    audience_tag: string;
    level: string;
    visibility: string;
    required_plan: string;
    published_at: string;
    question_count: number;
  }

  interface AnswerRecord {
    questionId: string;
    category: string;
    correct: boolean;
    selectedIndex: number;
  }

  interface SessionAnswerDetail {
    questionId: string;
    category: string;
    correct: boolean;
  }

  interface SessionRecord {
    playedAt: string;
    mode: StudyMode;
    totalQuestions: number;
    answeredCount: number;
    correctCount: number;
    answerDetails: SessionAnswerDetail[];
    wrongQuestionIds: string[];
    wrongCategories: string[];
  }

  interface QuizHistory {
    sessions: SessionRecord[];
  }

  interface PausedSession {
    mode: StudyMode;
    selectedCategory: string;
    customQueue: QuizQuestion[] | null;
    queue: QuizQuestion[];
    currentIndex: number;
    score: number;
    answers: AnswerRecord[];
    currentQuestionAnswered: boolean;
    currentSelectedIndex: number | null;
  }

  interface RecommendedStudy {
    title: string;
    copy: string;
    mode: Exclude<StudyMode, "retry_wrong">;
    category: string;
  }

  interface QuizState {
    questions: QuizQuestion[];
    availableSets: QuestionSetCatalogItem[];
    currentSetId: string;
    currentSetLabel: string;
    currentSetDescription: string;
    currentSetTag: string;
    isLoadingSet: boolean;
    questionLoadError: string;
    mode: Exclude<StudyMode, "retry_wrong">;
    selectedCategory: string;
    customQueue: QuizQuestion[] | null;
    queue: QuizQuestion[];
    currentIndex: number;
    score: number;
    answers: AnswerRecord[];
    currentQuestionAnswered: boolean;
    currentSelectedIndex: number | null;
    history: QuizHistory;
    pausedSession: PausedSession | null;
    flaggedQuestions: Record<string, number>;
    currentPlan: PlanKey;
  }

  interface QuizFeatureFlagsApi {
    PLAN_ORDER: PlanKey[];
    PLAN_LABELS: Record<PlanKey, string>;
    PLAN_COPY: Record<PlanKey, string>;
    FEATURE_REQUIREMENTS: Record<FeatureKey, PlanKey>;
    MODE_LABELS: Record<StudyMode, string>;
    normalizePlanKey: (planKey: string | null | undefined) => PlanKey;
    planRank: (planKey: PlanKey) => number;
    hasFeature: (planKey: PlanKey, featureKey: FeatureKey) => boolean;
    requiredPlanLabel: (featureKey: FeatureKey) => string;
  }

  interface QuizQuestionRepositoryApi {
    loadPublicCatalog: (appVersion: string, planKey?: PlanKey) => Promise<QuestionSetCatalogItem[]>;
    loadLocalQuestions: (appVersion: string, setId?: string | null, planKey?: PlanKey) => Promise<QuestionPayload>;
    resolveInitialSetId: () => string | null;
  }

  interface QuizStorageRepositoriesApi {
    historyRepository: {
      load: () => QuizHistory;
      save: (history: QuizHistory) => void;
    };
    pausedSessionRepository: {
      load: () => PausedSession | null;
      save: (pausedSession: PausedSession | null) => void;
    };
    flaggedQuestionRepository: {
      load: () => Record<string, number>;
      save: (flaggedQuestions: Record<string, number>) => void;
    };
    planRepository: {
      load: (defaultPlan: PlanKey, planOrder: PlanKey[]) => PlanKey;
      save: (planKey: PlanKey) => void;
      clear?: () => void;
    };
  }

  interface PlanStatusState {
    activePlan: PlanKey;
    signedIn: boolean;
    source: "default" | "manual_override" | "license_api";
  }

  interface QuizPlanStatusServiceApi {
    load: (defaultPlan: PlanKey) => PlanStatusState;
    saveManualOverride: (planKey: PlanKey) => void;
    clearManualOverride: () => void;
  }

  interface QuizQueueContext {
    questions: QuizQuestion[];
    mode: Exclude<StudyMode, "retry_wrong">;
    selectedCategory: string;
    customQueue: QuizQuestion[] | null;
    historySessions: SessionRecord[];
    flaggedQuestions: Record<string, number>;
    featureAvailability: {
      categoryMode: boolean;
      final14Mode: boolean;
      flaggedMode: boolean;
    };
  }

  interface QuizRecommendationContext {
    historySessions: SessionRecord[];
    flaggedQuestions: Record<string, number>;
    recentWeakCategory: string;
    featureAvailability: {
      categoryMode: boolean;
      final14Mode: boolean;
      flaggedMode: boolean;
    };
  }

  interface QuizEngineApi {
    getFlaggedQuestionIds: (flaggedQuestions: Record<string, number>) => string[];
    getFlaggedPriority: (flaggedQuestions: Record<string, number>, questionId: string) => number;
    getQuestionsForMode: (context: QuizQueueContext) => QuizQuestion[];
    getRecommendedStudy: (context: QuizRecommendationContext) => RecommendedStudy;
  }

  interface HistorySummary {
    sessionCount: number;
    totalAnswers: number;
    averageRate: number;
    recentWeakCategory: string;
  }

  interface CategoryPerformance {
    category: string;
    answered: number;
    correct: number;
    rate: number | null;
  }

  interface RecentSessionViewModel {
    playedAtLabel: string;
    modeLabel: string;
    answeredCount: number;
    correctCount: number;
    rate: number;
  }

  interface StudyPlanDay {
    day: number;
    category: string;
    intensity: string;
    note: string;
  }

  interface HistoryAnalyticsApi {
    summarizeHistory: (history: QuizHistory) => HistorySummary;
    buildStudyPlan: (questions: QuizQuestion[], history: QuizHistory) => StudyPlanDay[];
    buildCategoryPerformance: (questions: QuizQuestion[], history: QuizHistory) => CategoryPerformance[];
    buildRecentSessionViewModels: (
      history: QuizHistory,
      modeLabels: Record<StudyMode, string>,
      locale?: string,
    ) => RecentSessionViewModel[];
  }

  interface QuizResultSummary {
    evaluatedCount: number;
    rate: number;
    title: string;
    modeLabel: string;
    weakCategory: string;
    state: "not_answered" | "all_correct" | "needs_review";
    wrongAnswers: AnswerRecord[];
  }

  interface SessionRecordContext {
    answers: AnswerRecord[];
    queueLength: number;
    score: number;
    mode: Exclude<StudyMode, "retry_wrong">;
    customQueue: QuizQuestion[] | null;
  }

  interface ResultSummaryContext {
    answers: AnswerRecord[];
    queueLength: number;
    score: number;
    modeLabel: string;
  }

  interface QuizScoringApi {
    evaluateAnswer: (question: QuizQuestion, selectedIndex: number) => boolean;
    buildResultSummary: (context: ResultSummaryContext) => QuizResultSummary;
    buildSessionRecord: (context: SessionRecordContext) => SessionRecord;
  }

  interface QuizQuestionViewModel {
    progressText: string;
    title: string;
    category: string;
    subtopic: string;
  }

  interface FeedbackViewModel {
    statusText: string;
    statusClassName: string;
    explanation: string;
    memoryTip: string;
    wrongReason: string;
    correctOption: string;
  }

  interface QuizScreenBindings {
    progressText: HTMLElement;
    questionTitle: HTMLElement;
    categoryBadge: HTMLElement;
    subtopicBadge: HTMLElement;
    choicesWrap: HTMLElement;
    feedbackCard: HTMLElement;
    feedbackStatus: HTMLElement;
    feedbackExplanation: HTMLElement;
    memoryTip: HTMLElement;
    optionReasons: HTMLElement;
    nextButton: HTMLButtonElement;
    pauseButton: HTMLButtonElement;
    abortButton: HTMLButtonElement;
  }

  interface QuizScreenUiApi {
    renderQuestionHeader: (bindings: QuizScreenBindings, viewModel: QuizQuestionViewModel) => void;
    renderChoiceButtons: (
      bindings: QuizScreenBindings,
      options: string[],
      onSelect: (selectedIndex: number, button: HTMLButtonElement) => void,
    ) => void;
    renderAnsweredState: (
      bindings: QuizScreenBindings,
      answerIndex: number,
      selectedIndex: number,
      selectedButton?: HTMLButtonElement | null,
      isCorrect?: boolean | null,
    ) => void;
    renderFeedback: (bindings: QuizScreenBindings, feedback: FeedbackViewModel) => void;
    resetQuestionFeedback: (bindings: QuizScreenBindings) => void;
    showNextAction: (bindings: QuizScreenBindings) => void;
  }

  interface StartScreenBindings {
    planTitle: HTMLElement;
    planCopy: HTMLElement;
    questionSetSelect: HTMLSelectElement;
    questionSetMeta: HTMLElement;
    questionSetStatus: HTMLElement;
    questionSetRetryButton: HTMLButtonElement;
    questionSetDescription: HTMLElement;
    questionSetTag: HTMLElement;
    planButtons: HTMLButtonElement[];
    modeButtons: HTMLButtonElement[];
    categoryPicker: HTMLElement;
    studyPlanPanel: HTMLElement;
    recommendPanel: HTMLElement;
    categoryStatsPanel: HTMLElement;
    recentSessionsPanel: HTMLElement;
    queuePreview: HTMLElement;
    flaggedCount: HTMLElement;
    priorityCount: HTMLElement;
    historySessionCount: HTMLElement;
    historyAnswerCount: HTMLElement;
    historyAverageRate: HTMLElement;
    historyWeakCategory: HTMLElement;
    categoryButtonsWrap: HTMLElement;
    recommendTitle: HTMLElement;
    recommendCopy: HTMLElement;
  }

  interface StartScreenPlanStateViewModel {
    planLabel: string;
    planCopy: string;
    currentPlan: PlanKey;
    currentMode: Exclude<StudyMode, "retry_wrong">;
    selectedCategory: string;
    modeAvailability: Record<
      Exclude<StudyMode, "retry_wrong">,
      {
        enabled: boolean;
        lockedMessage: string;
      }
    >;
    panelVisibility: {
      categoryPicker: boolean;
      studyPlan: boolean;
      recommendation: boolean;
      categoryStats: boolean;
      recentSessions: boolean;
    };
  }

  interface QuestionSetStateViewModel {
    statusText: string;
    disableSelect: boolean;
    showRetry: boolean;
  }

  interface StartScreenUiApi {
    renderPlanHeader: (
      bindings: StartScreenBindings,
      planLabel: string,
      planCopy: string,
    ) => void;
    renderPlanState: (
      bindings: StartScreenBindings,
      viewModel: StartScreenPlanStateViewModel,
    ) => void;
    renderQuestionSetOptions: (
      bindings: StartScreenBindings,
      sets: QuestionSetCatalogItem[],
      currentSetId: string,
    ) => void;
    renderQuestionSetMeta: (
      bindings: StartScreenBindings,
      text: string,
    ) => void;
    renderQuestionSetSummary: (
      bindings: StartScreenBindings,
      description: string,
      audienceTag: string,
    ) => void;
    renderQuestionSetState: (
      bindings: StartScreenBindings,
      viewModel: QuestionSetStateViewModel,
    ) => void;
    renderHistorySummary: (
      bindings: StartScreenBindings,
      summary: HistorySummary,
    ) => void;
    renderQueuePreview: (
      bindings: StartScreenBindings,
      text: string,
    ) => void;
    renderFlaggedSummary: (
      bindings: StartScreenBindings,
      flaggedCount: number,
      priorityCount: number,
    ) => void;
    renderRecommendation: (
      bindings: StartScreenBindings,
      recommendation: RecommendedStudy,
    ) => void;
    renderCategoryButtons: (
      bindings: StartScreenBindings,
      categories: string[],
      selectedCategory: string,
      onSelect: (category: string, button: HTMLButtonElement) => void,
    ) => void;
    setCategoryButtonSelection: (
      bindings: StartScreenBindings,
      selectedCategory: string,
    ) => void;
  }

  interface ResultReviewItem {
    title: string;
    prompt: string;
    memoryTip: string;
  }

  interface ResultScreenBindings {
    resultTitle: HTMLElement;
    resultRate: HTMLElement;
    weakCategory: HTMLElement;
    resultMode: HTMLElement;
    reviewList: HTMLElement;
  }

  interface ResultScreenUiApi {
    renderSummary: (
      bindings: ResultScreenBindings,
      summary: Pick<QuizResultSummary, "title" | "rate" | "weakCategory" | "modeLabel">,
    ) => void;
    renderInfoCard: (
      bindings: ResultScreenBindings,
      heading: string,
      body: string,
    ) => void;
    renderReviewItems: (
      bindings: ResultScreenBindings,
      items: ResultReviewItem[],
    ) => void;
  }

  interface ScreenBindings {
    startScreen: HTMLElement;
    quizScreen: HTMLElement;
    resultScreen: HTMLElement;
    resumePanel: HTMLElement;
    resumeTitle: HTMLElement;
    resumeDescription: HTMLElement;
  }

  interface ResumePanelViewModel {
    visible: boolean;
    title: string;
    description: string;
  }

  interface ScreenControllerUiApi {
    showScreen: (
      bindings: ScreenBindings,
      screen: "start" | "quiz" | "result",
    ) => void;
    renderResumePanel: (
      bindings: ScreenBindings,
      viewModel: ResumePanelViewModel,
    ) => void;
  }

  interface PausedSessionSnapshot {
    mode: Exclude<StudyMode, "retry_wrong">;
    selectedCategory: string;
    customQueue: QuizQuestion[] | null;
    queue: QuizQuestion[];
    currentIndex: number;
    score: number;
    answers: AnswerRecord[];
    currentQuestionAnswered: boolean;
    currentSelectedIndex: number | null;
  }

  interface StudySessionActionsApi {
    buildPausedSession: (snapshot: PausedSessionSnapshot) => PausedSession;
    restorePausedSession: (
      pausedSession: PausedSession,
    ) => PausedSessionSnapshot;
    buildWrongRetryQueue: (
      questions: QuizQuestion[],
      answers: AnswerRecord[],
    ) => QuizQuestion[];
    getNextFlagPriority: (
      currentPriority: number,
      allowHighPriority: boolean,
    ) => number;
  }

  interface StudyFlowFeatureAvailability {
    categoryMode: boolean;
    final14Mode: boolean;
    flaggedMode: boolean;
  }

  interface StudyFlowState {
    mode: Exclude<StudyMode, "retry_wrong">;
    selectedCategory: string;
    customQueue: QuizQuestion[] | null;
  }

  interface PlanAdjustmentContext {
    currentMode: Exclude<StudyMode, "retry_wrong">;
    planKey: PlanKey;
    featureAvailability: StudyFlowFeatureAvailability;
  }

  interface StudyFlowActionsApi {
    applyRecommendedStudy: (
      currentState: StudyFlowState,
      recommendation: RecommendedStudy,
    ) => StudyFlowState;
    applyWeakCategoryStudy: (
      currentState: StudyFlowState,
      category: string,
    ) => StudyFlowState;
    applyFlaggedStudy: (
      currentState: StudyFlowState,
    ) => StudyFlowState;
    applyModeSelection: (
      currentState: StudyFlowState,
      mode: Exclude<StudyMode, "retry_wrong">,
    ) => StudyFlowState;
    applyPlanAdjustment: (
      context: PlanAdjustmentContext,
    ) => StudyFlowState;
    resetToStartState: (
      currentState: StudyFlowState,
    ) => StudyFlowState;
  }

  interface Window {
    QuizFeatureFlags: QuizFeatureFlagsApi;
    QuizQuestionRepository: QuizQuestionRepositoryApi;
    QuizStorageRepositories: QuizStorageRepositoriesApi;
    QuizPlanStatusService: QuizPlanStatusServiceApi;
    QuizEngine: QuizEngineApi;
    QuizHistoryAnalytics: HistoryAnalyticsApi;
    QuizScoring: QuizScoringApi;
    QuizScreenUi: QuizScreenUiApi;
    QuizStartScreenUi: StartScreenUiApi;
    QuizResultScreenUi: ResultScreenUiApi;
    QuizScreenControllerUi: ScreenControllerUiApi;
    QuizStudySessionActions: StudySessionActionsApi;
    QuizStudyFlowActions: StudyFlowActionsApi;
  }
}

export {};
