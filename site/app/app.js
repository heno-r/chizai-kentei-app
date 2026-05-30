// @ts-nocheck
const state = {
    questions: [],
    freeQuestionsCount: 0,
    premiumQuestionsCount: 0,
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
    authStatus: {
        signedIn: false,
        displayName: "",
        source: "guest_local",
    },
    premiumManifest: null,
};
const APP_VERSION = "20260429-2";
const STORAGE_KEY = "chizai-quiz-history-v1";
const PAUSED_STORAGE_KEY = "chizai-quiz-paused-v1";
const FLAGGED_STORAGE_KEY = "chizai-quiz-flagged-v1";
const PLAN_STORAGE_KEY = "chizai-quiz-plan-v1";
const RUNTIME_CONFIG = window.APP_RUNTIME_CONFIG || {};
const AUTH_CLIENT = window.SiteAuthClient;
const PLAN_ORDER = ["free", "premium"];
const PLAN_LABELS = {
    free: "無料版",
    premium: "プレミアム版",
};
const PLAN_COPY = {
    free: "まずは無料で解ける感覚をつかむ体験版です。",
    premium: "プレミアム版では、全問題、苦手復習、今日のおすすめ、直前14日モードが使えます。",
};
const MANIFEST_FEATURE_LABELS = {
    category_mode: "カテゴリ別学習",
    retry_wrong: "間違えた問題だけ復習",
    weak_category_analysis: "苦手カテゴリ分析",
    flagged_queue: "要復習キュー",
    today_recommendation: "今日のおすすめ問題",
    final14_mode: "直前14日モード",
    study_plan: "試験日までの学習プラン",
    detailed_history: "詳細な学習履歴",
};
const FEATURE_REQUIREMENTS = {
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
const MODE_LABELS = {
    sequential: "順番に学習",
    random: "ランダム出題",
    category: "カテゴリ別学習",
    final14: "直前14日モード",
    retry_wrong: "間違えた問題だけ復習",
    flagged: "要復習だけ学習",
};
const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const questionCountEl = document.getElementById("question-count");
const queuePreviewEl = document.getElementById("queue-preview");
const flaggedCountEl = document.getElementById("flagged-count");
const priorityCountEl = document.getElementById("priority-count");
const startButton = document.getElementById("start-button");
const planTitle = document.getElementById("plan-title");
const planCopy = document.getElementById("plan-copy");
const planButtons = [...document.querySelectorAll(".plan-button")];
const publicCatalogWrap = document.getElementById("public-catalog");
const modeButtons = [...document.querySelectorAll(".mode-card")];
const categoryPicker = document.getElementById("category-picker");
const categoryButtonsWrap = document.getElementById("category-buttons");
const historySessionCount = document.getElementById("history-session-count");
const historyAnswerCount = document.getElementById("history-answer-count");
const historyAverageRate = document.getElementById("history-average-rate");
const historyWeakCategory = document.getElementById("history-weak-category");
const studyPlan = document.getElementById("study-plan");
const recommendTitle = document.getElementById("recommend-title");
const recommendCopy = document.getElementById("recommend-copy");
const recommendButton = document.getElementById("recommend-button");
const categoryStats = document.getElementById("category-stats");
const recentSessions = document.getElementById("recent-sessions");
const resetHistoryButton = document.getElementById("reset-history-button");
const studyPlanPanel = document.getElementById("study-plan-panel");
const recommendPanel = document.getElementById("recommend-panel");
const categoryStatsPanel = document.getElementById("category-stats-panel");
const recentSessionsPanel = document.getElementById("recent-sessions-panel");
const resumePanel = document.getElementById("resume-panel");
const resumeTitle = document.getElementById("resume-title");
const resumeDescription = document.getElementById("resume-description");
const resumeButton = document.getElementById("resume-button");
const discardResumeButton = document.getElementById("discard-resume-button");
const progressText = document.getElementById("progress-text");
const questionTitle = document.getElementById("question-title");
const categoryBadge = document.getElementById("category-badge");
const subtopicBadge = document.getElementById("subtopic-badge");
const flagToggleButton = document.getElementById("flag-toggle-button");
const choicesWrap = document.getElementById("choices");
const scoreText = document.getElementById("score-text");
const feedbackCard = document.getElementById("feedback-card");
const feedbackStatus = document.getElementById("feedback-status");
const feedbackExplanation = document.getElementById("feedback-explanation");
const memoryTip = document.getElementById("memory-tip");
const optionReasons = document.getElementById("option-reasons");
const referenceLinksEl = document.getElementById("reference-links");
const nextButton = document.getElementById("next-button");
const pauseButton = document.getElementById("pause-button");
const abortButton = document.getElementById("abort-button");
const resultTitle = document.getElementById("result-title");
const resultRate = document.getElementById("result-rate");
const weakCategory = document.getElementById("weak-category");
const resultMode = document.getElementById("result-mode");
const reviewList = document.getElementById("review-list");
const premiumUpsellPanel = document.getElementById("premium-upsell-panel");
const premiumUpsellTitle = document.getElementById("premium-upsell-title");
const premiumUpsellCopy = document.getElementById("premium-upsell-copy");
const premiumPriceNote = document.getElementById("premium-price-note");
const premiumGuideLink = document.getElementById("premium-guide-link");
const premiumReadyLink = document.getElementById("premium-ready-link");
const premiumManifestPanel = document.getElementById("premium-manifest-panel");
const premiumManifestTitle = document.getElementById("premium-manifest-title");
const premiumManifestCopy = document.getElementById("premium-manifest-copy");
const premiumManifestFeatures = document.getElementById("premium-manifest-features");
const resultPremiumPanel = document.getElementById("result-premium-panel");
const resultPremiumTitle = document.getElementById("result-premium-title");
const resultPremiumCopy = document.getElementById("result-premium-copy");
const resultPremiumPriceNote = document.getElementById("result-premium-price-note");
const resultGuideLink = document.getElementById("result-guide-link");
const focusWeakButton = document.getElementById("focus-weak-button");
const retryWrongButton = document.getElementById("retry-wrong-button");
const retryFlaggedButton = document.getElementById("retry-flagged-button");
const restartButton = document.getElementById("restart-button");
function isPurchaseEnabled() {
    return RUNTIME_CONFIG.purchaseEnabled !== false;
}
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
function createEmptyStateCard(title, copy, className = "review-item") {
    const card = document.createElement("div");
    card.className = className;
    const heading = document.createElement("h4");
    heading.textContent = title;
    const body = document.createElement("p");
    body.textContent = copy;
    card.append(heading, body);
    return card;
}
function createInfoCard(labelText, titleText, bodyText, className = "stat-card") {
    const card = document.createElement("article");
    card.className = className;
    const label = document.createElement("span");
    label.className = "summary-label";
    label.textContent = labelText;
    const heading = document.createElement("strong");
    heading.textContent = titleText;
    const body = document.createElement("p");
    body.textContent = bodyText;
    card.append(label, heading, body);
    return card;
}
function normalizeReferenceLinks(question) {
    const candidates = Array.isArray(question?.reference_links)
        ? question.reference_links
        : Array.isArray(question?.sources)
            ? question.sources.map((source) => ({
                title: source?.title || source?.publisher || "参考資料",
                publisher: source?.publisher || "",
                section: source?.section || "",
                url: source?.url_or_location || "",
            }))
            : [];
    const seenUrls = new Set();
    return candidates
        .map((item) => ({
        title: String(item?.title || item?.publisher || "参考資料").trim(),
        publisher: String(item?.publisher || "").trim(),
        section: String(item?.section || "").trim(),
        url: String(item?.url || item?.url_or_location || "").trim(),
    }))
        .filter((item) => item.url.startsWith("http://") || item.url.startsWith("https://"))
        .filter((item) => {
        if (seenUrls.has(item.url)) {
            return false;
        }
        seenUrls.add(item.url);
        return true;
    });
}
function normalizeQuestion(question) {
    return {
        ...question,
        reference_links: normalizeReferenceLinks(question),
    };
}
function renderReferenceLinks(referenceLinks = []) {
    if (!referenceLinksEl) {
        return;
    }
    if (!Array.isArray(referenceLinks) || referenceLinks.length === 0) {
        referenceLinksEl.classList.add("hidden");
        referenceLinksEl.innerHTML = "";
        return;
    }
    const listHtml = referenceLinks
        .map((item) => {
        const metaParts = [item.publisher, item.section].filter(Boolean);
        const metaHtml = metaParts.length
            ? `<span class="reference-link-meta">(${escapeHtml(metaParts.join(" / "))})</span>`
            : "";
        return `
        <li>
          <a class="reference-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(item.title)}</a>
          ${metaHtml}
        </li>
      `;
    })
        .join("");
    referenceLinksEl.classList.remove("hidden");
    referenceLinksEl.innerHTML = `
    <span class="reference-links-title">参考URL</span>
    <ul class="reference-links-list">${listHtml}</ul>
  `;
}
async function loadQuestions() {
    const basePublicSetId = state.currentPlan === "premium" && state.premiumManifest?.base_public_set_id
        ? state.premiumManifest.base_public_set_id
        : RUNTIME_CONFIG.freeQuestionSet || "grade3_mixed_priority_50";
    const freePayload = window.PublicApiClient?.fetchFreeQuestions
        ? await window.PublicApiClient.fetchFreeQuestions(basePublicSetId)
        : await fetch(`./data/questions.json?v=${APP_VERSION}`, { cache: "no-store" }).then((response) => response.json());
    const combinedQuestions = Array.isArray(freePayload?.questions)
        ? freePayload.questions.map((question) => normalizeQuestion(question))
        : [];
    const freeQuestionsCount = combinedQuestions.length;
    let premiumQuestionsCount = 0;
    if (state.currentPlan === "premium" && AUTH_CLIENT?.fetchPremiumQuestions) {
        const premiumSetIds = Array.isArray(state.premiumManifest?.question_sets)
            ? state.premiumManifest.question_sets.map((setInfo) => setInfo?.set_id).filter(Boolean)
            : [];
        for (const premiumSetId of premiumSetIds) {
            try {
                const premiumPayload = await AUTH_CLIENT.fetchPremiumQuestions(premiumSetId);
                const premiumQuestions = Array.isArray(premiumPayload?.questions)
                    ? premiumPayload.questions.map((question) => normalizeQuestion(question))
                    : [];
                premiumQuestions.forEach((question) => {
                    if (!combinedQuestions.some((existing) => existing.id === question.id)) {
                        combinedQuestions.push(question);
                        premiumQuestionsCount += 1;
                    }
                });
            }
            catch (error) {
                console.warn("premium questions load failed, keep free questions", error);
            }
        }
    }
    state.questions = combinedQuestions;
    state.freeQuestionsCount = freeQuestionsCount;
    state.premiumQuestionsCount = premiumQuestionsCount;
    questionCountEl.textContent = `${state.questions.length}問`;
    buildCategoryButtons();
    renderStudyPlan();
    updateQueuePreview();
    renderPremiumManifest();
}
function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.sessions)) {
            state.history = parsed;
        }
    }
    catch (error) {
        console.warn("history load failed", error);
    }
}
function saveHistory() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}
async function loadPlan() {
    state.currentPlan = "free";
    state.premiumManifest = null;
    state.authStatus = {
        signedIn: false,
        displayName: "",
        source: "guest_local",
    };
    if (!AUTH_CLIENT?.fetchLicenseStatus) {
        return;
    }
    try {
        const status = await AUTH_CLIENT.fetchLicenseStatus();
        state.currentPlan = normalizePlanKey(status.active_plan);
        state.authStatus = {
            signedIn: Boolean(status.signed_in),
            displayName: status.user?.display_name || "",
            source: status.source || "secure_api",
        };
        if (state.currentPlan === "premium" && AUTH_CLIENT?.fetchPremiumManifest) {
            try {
                state.premiumManifest = await AUTH_CLIENT.fetchPremiumManifest();
            }
            catch (error) {
                console.warn("premium manifest load failed", error);
            }
        }
    }
    catch (error) {
        console.warn("plan status load failed", error);
    }
}
function savePlan() {
    return;
}
function normalizePlanKey(planKey) {
    return planKey === "premium" || planKey === "standard" ? "premium" : "free";
}
function loadFlaggedQuestions() {
    try {
        const raw = localStorage.getItem(FLAGGED_STORAGE_KEY);
        if (!raw)
            return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            state.flaggedQuestions = Object.fromEntries(parsed.map((id) => [id, 1]));
            return;
        }
        if (parsed && typeof parsed === "object") {
            state.flaggedQuestions = parsed;
        }
    }
    catch (error) {
        console.warn("flagged questions load failed", error);
    }
}
function saveFlaggedQuestions() {
    localStorage.setItem(FLAGGED_STORAGE_KEY, JSON.stringify(state.flaggedQuestions));
}
function planRank(planKey) {
    return PLAN_ORDER.indexOf(planKey);
}
function hasFeature(featureKey) {
    const requiredPlan = FEATURE_REQUIREMENTS[featureKey] || "free";
    return planRank(normalizePlanKey(state.currentPlan)) >= planRank(requiredPlan);
}
function requiredPlanLabel(featureKey) {
    return PLAN_LABELS[FEATURE_REQUIREMENTS[featureKey] || "free"];
}
function getPremiumGuidePath() {
    return RUNTIME_CONFIG.premiumGuidePath || "/#premium-plan";
}
function getPremiumPurchasePath() {
    return RUNTIME_CONFIG.premiumPurchasePath || "/premium/ready/";
}
function getLoginPath() {
    return RUNTIME_CONFIG.loginPath || "/login/";
}
function buildLoginHref() {
    const target = new URL(getLoginPath(), window.location.origin);
    target.searchParams.set("returnTo", `${window.location.pathname}${window.location.search}`);
    return target.toString();
}
function getPremiumPriceText() {
    return RUNTIME_CONFIG.premiumPriceText || "3級プレミアム版 1,200円 / 追加月額料金なし";
}
function showPremiumPrompt(reasonText) {
    if (!isPurchaseEnabled()) {
        window.alert(`${reasonText}\n\nプレミアム版の購入受付は、Stripe の本番審査が完了するまで一時停止しています。いまは無料版とプレミアム版の案内ページを確認できます。`);
        window.location.href = getPremiumGuidePath();
        return;
    }
    const shouldMove = window.confirm(`${reasonText}\n\n` +
        `プレミアム版では、3級の全問題、カテゴリ別学習、間違えた問題だけ復習、要復習キュー、` +
        `苦手カテゴリ分析、今日のおすすめ、直前14日モード、学習プランを利用できます。\n` +
        `価格: ${getPremiumPriceText()}\n\n` +
        `OK を押すと、${state.authStatus.signedIn ? "購入前チェック" : "ログイン"}へ進みます。`);
    if (!shouldMove) {
        return;
    }
    window.location.href = state.authStatus.signedIn ? getPremiumPurchasePath() : buildLoginHref();
}
function getFlaggedQuestionIds() {
    return Object.keys(state.flaggedQuestions).filter((id) => Number(state.flaggedQuestions[id]) > 0);
}
function getFlaggedPriority(questionId) {
    return Number(state.flaggedQuestions[questionId] || 0);
}
function loadPausedSession() {
    try {
        const raw = localStorage.getItem(PAUSED_STORAGE_KEY);
        if (!raw)
            return;
        state.pausedSession = JSON.parse(raw);
    }
    catch (error) {
        console.warn("paused session load failed", error);
    }
}
function savePausedSession() {
    if (!state.pausedSession) {
        localStorage.removeItem(PAUSED_STORAGE_KEY);
        return;
    }
    localStorage.setItem(PAUSED_STORAGE_KEY, JSON.stringify(state.pausedSession));
}
function renderHistorySummary() {
    const sessions = state.history.sessions;
    historySessionCount.textContent = `${sessions.length}回`;
    const totalAnswers = sessions.reduce((sum, session) => sum + session.answeredCount, 0);
    historyAnswerCount.textContent = `${totalAnswers}問`;
    const sessionsWithAnswers = sessions.filter((session) => session.answeredCount > 0);
    const average = sessionsWithAnswers.length
        ? Math.round(sessionsWithAnswers.reduce((sum, session) => sum + session.correctCount / session.answeredCount, 0) /
            sessionsWithAnswers.length *
            100)
        : 0;
    historyAverageRate.textContent = `${average}%`;
    const recentWrongCounts = {};
    sessions.slice(-5).forEach((session) => {
        session.wrongCategories.forEach((category) => {
            recentWrongCounts[category] = (recentWrongCounts[category] || 0) + 1;
        });
    });
    const recentWeakest = Object.entries(recentWrongCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    historyWeakCategory.textContent = recentWeakest || "まだなし";
    renderStudyPlan();
    renderCategoryStats();
    renderRecentSessions();
    renderRecommendation();
    renderFlaggedSummary();
}
function renderPlanState() {
    const signedInName = state.authStatus.displayName ? `（${state.authStatus.displayName}）` : "";
    planTitle.textContent =
        state.currentPlan === "premium" ? `プレミアム版を利用中${signedInName}` : `無料版を利用中${signedInName}`;
    planCopy.textContent =
        state.currentPlan === "premium"
            ? "プレミアム版の状態です。カテゴリ別学習、要復習キュー、今日のおすすめ、直前14日モードまでそのまま確認できます。"
            : state.authStatus.signedIn
                ? "無料版の状態です。まずは無料で試して、必要になったタイミングでプレミアム版へ進めます。"
                : "まずは無料版で、3級の基本問題と学習の流れを試せます。購入済みの状態で続けたいときはログインから進めます。";
    premiumPriceNote.textContent = getPremiumPriceText();
    resultPremiumPriceNote.textContent = getPremiumPriceText();
    premiumGuideLink.setAttribute("href", getPremiumGuidePath());
    premiumReadyLink?.setAttribute("href", state.authStatus.signedIn ? getPremiumPurchasePath() : buildLoginHref());
    resultGuideLink.setAttribute("href", getPremiumGuidePath());
    if (state.currentPlan === "premium") {
        premiumUpsellTitle.textContent = "プレミアム版でそのまま仕上げに進める状態です";
        premiumUpsellCopy.textContent =
            "追加問題、苦手復習、今日のおすすめ、直前14日モードまでそのまま使えます。";
    }
    else if (state.authStatus.signedIn) {
        premiumUpsellTitle.textContent = isPurchaseEnabled() ? "次は購入前チェックへ進む" : "プレミアム版の購入受付は準備中です";
        premiumUpsellCopy.textContent = isPurchaseEnabled()
            ? "無料版の相性確認が済んだら、ログイン済みのまま購入前チェックで価格と機能を確認できます。"
            : "無料版の相性確認とプレミアム版の案内確認はできますが、購入受付は Stripe の本番審査が完了するまで一時停止しています。";
    }
    else {
        premiumUpsellTitle.textContent = isPurchaseEnabled() ? "無料版の次は、ログインして購入準備へ進む" : "プレミアム版は公開準備中です";
        premiumUpsellCopy.textContent = isPurchaseEnabled()
            ? "無料版で相性を確認したあとに、ログイン、購入前チェック、購入の順で進めます。"
            : "無料版はそのまま使えます。プレミアム版の購入受付は Stripe の本番審査が完了するまで一時停止しています。";
    }
    renderPremiumManifest();
    planButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.plan === state.currentPlan);
    });
    modeButtons.forEach((button) => {
        const featureKey = button.dataset.feature;
        const allowed = hasFeature(featureKey);
        const lockNote = button.querySelector(".mode-lock-note");
        button.classList.toggle("is-plan-locked", !allowed);
        button.setAttribute("aria-disabled", String(!allowed));
        button.title = allowed ? "" : `プレミアム版で利用できます`;
        if (lockNote) {
            lockNote.textContent = allowed ? "" : "プレミアム版で解放";
        }
    });
    studyPlanPanel.classList.toggle("hidden", !hasFeature("study_plan"));
    recommendPanel.classList.toggle("hidden", !hasFeature("recommendation"));
    categoryStatsPanel.classList.toggle("hidden", !hasFeature("category_stats"));
    recentSessionsPanel.classList.toggle("hidden", !hasFeature("recent_sessions"));
    categoryPicker.classList.toggle("hidden", state.mode !== "category" || !hasFeature("category_mode"));
    pauseButton.classList.toggle("hidden", !hasFeature("pause_resume"));
    flagToggleButton.classList.toggle("hidden", !hasFeature("flagged_mode"));
    retryWrongButton.classList.toggle("hidden", !hasFeature("retry_wrong"));
    if (!hasFeature("pause_resume")) {
        resumePanel.classList.add("hidden");
    }
    else {
        renderResumePanel();
    }
    premiumUpsellPanel.classList.toggle("hidden", state.currentPlan === "premium");
}
function renderPremiumManifest() {
    if (!premiumManifestPanel || !premiumManifestFeatures || !premiumManifestTitle || !premiumManifestCopy) {
        return;
    }
    if (state.currentPlan !== "premium" || !state.premiumManifest) {
        premiumManifestPanel.classList.add("hidden");
        premiumManifestFeatures.innerHTML = "";
        return;
    }
    premiumManifestPanel.classList.remove("hidden");
    premiumManifestTitle.textContent = "プレミアム版で使える内容";
    const questionSets = Array.isArray(state.premiumManifest.question_sets)
        ? state.premiumManifest.question_sets
        : [];
    premiumManifestCopy.textContent =
        questionSets.length > 0
            ? "無料版に加えて、プレミアム版の追加問題と復習機能が使える状態です。"
            : "プレミアム問題セットはまだ未登録のため、現在は無料公開50問を表示しています。";
    premiumManifestFeatures.innerHTML = "";
    const totalCountItem = document.createElement("article");
    totalCountItem.className = "stat-card";
    const totalCountLabel = document.createElement("strong");
    totalCountLabel.textContent = `現在の出題数 ${state.questions.length}問`;
    const totalCountCopy = document.createElement("span");
    totalCountCopy.className = "summary-subtext";
    totalCountCopy.textContent = `無料 ${state.freeQuestionsCount}問 + プレミアム追加 ${state.premiumQuestionsCount}問`;
    totalCountItem.append(totalCountLabel, totalCountCopy);
    premiumManifestFeatures.appendChild(totalCountItem);
    const features = Array.isArray(state.premiumManifest.unlocked_features)
        ? state.premiumManifest.unlocked_features
        : [];
    features.forEach((featureKey) => {
        const item = document.createElement("article");
        item.className = "stat-card";
        const label = document.createElement("strong");
        label.textContent = MANIFEST_FEATURE_LABELS[featureKey] || featureKey;
        const copy = document.createElement("span");
        copy.className = "summary-subtext";
        copy.textContent = featureKey;
        item.append(label, copy);
        premiumManifestFeatures.appendChild(item);
    });
    if (questionSets.length > 0) {
        const item = document.createElement("article");
        item.className = "stat-card";
        const label = document.createElement("strong");
        label.textContent = "追加問題";
        const copy = document.createElement("span");
        copy.className = "summary-subtext";
        copy.textContent = `重複を除いて ${state.premiumQuestionsCount}問を追加`;
        item.append(label, copy);
        premiumManifestFeatures.appendChild(item);
    }
    else {
        const item = document.createElement("article");
        item.className = "stat-card";
        const label = document.createElement("strong");
        label.textContent = "プレミアム問題セットは準備中";
        const copy = document.createElement("span");
        copy.className = "summary-subtext";
        copy.textContent = "登録後はここから自動で切り替わります";
        item.append(label, copy);
        premiumManifestFeatures.appendChild(item);
    }
}
function renderPublicCatalog(plans) {
    if (!publicCatalogWrap) {
        return;
    }
    if (!plans.length) {
        publicCatalogWrap.replaceChildren(createEmptyStateCard("プラン情報を読み込めませんでした。", "無料版だけでもそのまま学習を始められます。", "stat-card"));
        return;
    }
    publicCatalogWrap.replaceChildren(...plans.map((plan) => {
        const article = document.createElement("article");
        article.className = `stat-card${plan.available === false ? " is-disabled" : ""}`;
        article.setAttribute("aria-disabled", plan.available === false ? "true" : "false");
        const label = document.createElement("span");
        label.className = "summary-label";
        label.textContent = String(plan.label || "");
        article.appendChild(label);
        if (plan.available === false) {
            const statusChip = document.createElement("span");
            statusChip.className = "status-chip status-chip-muted";
            statusChip.textContent = String(plan.status_label || "準備中");
            article.appendChild(statusChip);
        }
        const price = document.createElement("strong");
        price.textContent = String(plan.price_text || "");
        const description = document.createElement("p");
        description.textContent = String(plan.description || "");
        article.append(price, description);
        const metaRow = document.createElement("div");
        metaRow.className = "meta-row";
        (plan.features || []).forEach((feature) => {
            const badge = document.createElement("span");
            badge.className = "badge badge-soft";
            badge.textContent = String(feature);
            metaRow.appendChild(badge);
        });
        article.appendChild(metaRow);
        return article;
    }));
}
async function loadPublicCatalog() {
    if (!publicCatalogWrap) {
        return;
    }
    try {
        const payload = window.PublicApiClient?.fetchPublicCatalog
            ? await window.PublicApiClient.fetchPublicCatalog()
            : { plans: [] };
        renderPublicCatalog(payload.plans || []);
    }
    catch (error) {
        console.warn("public catalog load failed", error);
        renderPublicCatalog([]);
    }
}
function renderResumePanel() {
    if (!hasFeature("pause_resume")) {
        resumePanel.classList.add("hidden");
        return;
    }
    const paused = state.pausedSession;
    resumePanel.classList.toggle("hidden", !paused);
    if (!paused)
        return;
    const answeredCount = paused.answers.length;
    const pausedModeLabel = paused.customQueue ? MODE_LABELS.retry_wrong : MODE_LABELS[paused.mode];
    resumeTitle.textContent = `${pausedModeLabel} を ${answeredCount}問回答済み`;
    resumeDescription.textContent = `${paused.currentIndex + 1}問目から再開できます。カテゴリ: ${paused.selectedCategory || "全体"}`;
}
function shuffle(array) {
    const copied = [...array];
    for (let i = copied.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copied[i], copied[j]] = [copied[j], copied[i]];
    }
    return copied;
}
function buildCategoryButtons() {
    const categories = [...new Set(state.questions.map((question) => question.category))];
    categoryButtonsWrap.innerHTML = "";
    state.selectedCategory = categories[0] || "";
    categories.forEach((category, index) => {
        const button = document.createElement("button");
        button.className = `category-button ${index === 0 ? "is-active" : ""}`;
        button.textContent = category;
        button.addEventListener("click", () => {
            state.selectedCategory = category;
            [...categoryButtonsWrap.querySelectorAll(".category-button")].forEach((node) => node.classList.toggle("is-active", node === button));
            updateQueuePreview();
        });
        categoryButtonsWrap.appendChild(button);
    });
}
function getQuestionsForCurrentMode() {
    if (state.customQueue) {
        return [...state.customQueue];
    }
    if (state.mode === "random") {
        return shuffle(state.questions);
    }
    if (state.mode === "category" && hasFeature("category_mode")) {
        return state.questions.filter((question) => question.category === state.selectedCategory);
    }
    if (state.mode === "final14" && hasFeature("final14_mode")) {
        return buildFinal14Queue();
    }
    if (state.mode === "flagged" && hasFeature("flagged_mode")) {
        const wrongCounts = {};
        state.history.sessions.forEach((session) => {
            session.wrongQuestionIds.forEach((questionId) => {
                wrongCounts[questionId] = (wrongCounts[questionId] || 0) + 1;
            });
        });
        return state.questions
            .filter((question) => getFlaggedPriority(question.id) > 0)
            .sort((a, b) => {
            const priorityDiff = getFlaggedPriority(b.id) - getFlaggedPriority(a.id);
            if (priorityDiff !== 0)
                return priorityDiff;
            const wrongDiff = (wrongCounts[b.id] || 0) - (wrongCounts[a.id] || 0);
            if (wrongDiff !== 0)
                return wrongDiff;
            return a.id.localeCompare(b.id, "ja");
        });
    }
    return [...state.questions];
}
function buildFinal14Queue() {
    const wrongCounts = {};
    state.history.sessions.forEach((session) => {
        session.wrongQuestionIds.forEach((questionId) => {
            wrongCounts[questionId] = (wrongCounts[questionId] || 0) + 1;
        });
    });
    const weighted = [...state.questions].sort((a, b) => {
        const diff = (wrongCounts[b.id] || 0) - (wrongCounts[a.id] || 0);
        if (diff !== 0)
            return diff;
        return a.id.localeCompare(b.id, "ja");
    });
    const prioritized = weighted.slice(0, Math.min(5, weighted.length));
    if (prioritized.length < 5) {
        return shuffle(state.questions).slice(0, 5);
    }
    return shuffle(prioritized);
}
function updateQueuePreview() {
    const previewQueue = getQuestionsForCurrentMode();
    const totalLabel = `総問題数${state.questions.length}問`;
    if (state.customQueue) {
        queuePreviewEl.textContent = `復習セット ${previewQueue.length}問 / ${totalLabel}`;
        return;
    }
    if (state.mode === "category") {
        if (!hasFeature("category_mode")) {
            queuePreviewEl.textContent = "プレミアム版でカテゴリ別学習を解放";
            return;
        }
        queuePreviewEl.textContent = `${state.selectedCategory} ${previewQueue.length}問 / ${totalLabel}`;
        return;
    }
    if (state.mode === "final14") {
        if (!hasFeature("final14_mode")) {
            queuePreviewEl.textContent = "プレミアム版で直前14日モードを解放";
            return;
        }
        queuePreviewEl.textContent = `直前セット ${previewQueue.length}問 / ${totalLabel}`;
        return;
    }
    if (state.mode === "flagged") {
        if (!hasFeature("flagged_mode")) {
            queuePreviewEl.textContent = "プレミアム版で要復習キューを解放";
            return;
        }
        queuePreviewEl.textContent = `要復習セット ${previewQueue.length}問 / ${totalLabel}`;
        return;
    }
    if (state.currentPlan === "premium") {
        queuePreviewEl.textContent = `全${previewQueue.length}問（無料${state.freeQuestionsCount} + 追加${state.premiumQuestionsCount}） / ${totalLabel}`;
        return;
    }
    queuePreviewEl.textContent = `全${previewQueue.length}問 / ${totalLabel}`;
}
function startQuiz() {
    if ((state.mode === "category" && !hasFeature("category_mode")) ||
        (state.mode === "final14" && !hasFeature("final14_mode")) ||
        (state.mode === "flagged" && !hasFeature("flagged_mode"))) {
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
function renderQuestion() {
    const question = state.queue[state.currentIndex];
    progressText.textContent = `${state.currentIndex + 1} / ${state.queue.length}`;
    questionTitle.textContent = question.prompt;
    categoryBadge.textContent = question.category;
    subtopicBadge.textContent = question.subtopic;
    renderFlagButton(question.id);
    choicesWrap.innerHTML = "";
    feedbackCard.classList.add("hidden");
    renderReferenceLinks([]);
    nextButton.classList.add("hidden");
    pauseButton.classList.remove("hidden");
    abortButton.classList.remove("hidden");
    question.options.forEach((choice, index) => {
        const button = document.createElement("button");
        button.className = "choice-button";
        button.textContent = `${index + 1}. ${choice}`;
        button.addEventListener("click", () => handleAnswer(index, button));
        choicesWrap.appendChild(button);
    });
    if (state.currentQuestionAnswered && state.currentSelectedIndex !== null) {
        const answeredEntry = [...state.answers]
            .reverse()
            .find((answer) => answer.questionId === question.id && answer.selectedIndex === state.currentSelectedIndex);
        renderAnsweredState(question, state.currentSelectedIndex);
        renderFeedback(question, answeredEntry ? answeredEntry.correct : state.currentSelectedIndex === question.answer_index, state.currentSelectedIndex);
        nextButton.classList.remove("hidden");
    }
}
function renderFlagButton(questionId) {
    const priority = getFlaggedPriority(questionId);
    flagToggleButton.classList.toggle("is-flagged", priority >= 1);
    flagToggleButton.classList.toggle("is-priority-high", priority >= 2);
    if (!hasFeature("flagged_mode")) {
        flagToggleButton.textContent = "プレミアム版で要復習キューを解放";
    }
    else if (priority === 0) {
        flagToggleButton.textContent = "この問題を要復習にする";
    }
    else if (priority === 1 && hasFeature("flagged_priority")) {
        flagToggleButton.textContent = "要復習 → 最重点にする";
    }
    else if (priority === 1) {
        flagToggleButton.textContent = "要復習 → 解除する";
    }
    else {
        flagToggleButton.textContent = "最重点 → 解除する";
    }
}
function handleAnswer(selectedIndex, selectedButton) {
    const question = state.queue[state.currentIndex];
    const isCorrect = selectedIndex === question.answer_index;
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
    nextButton.classList.remove("hidden");
}
function renderAnsweredState(question, selectedIndex, selectedButton = null, precomputedCorrect = null) {
    const isCorrect = precomputedCorrect ?? selectedIndex === question.answer_index;
    const buttons = [...choicesWrap.querySelectorAll(".choice-button")];
    buttons.forEach((button, index) => {
        button.disabled = true;
        if (index === question.answer_index) {
            button.classList.add("is-correct");
        }
    });
    if (!isCorrect) {
        const wrongButton = selectedButton ?? buttons[selectedIndex];
        wrongButton?.classList.add("is-wrong");
    }
}
function renderFeedback(question, isCorrect, selectedIndex) {
    feedbackCard.classList.remove("hidden");
    feedbackStatus.textContent = isCorrect ? "正解" : "不正解";
    feedbackStatus.className = `feedback-status ${isCorrect ? "is-correct" : "is-wrong"}`;
    feedbackExplanation.textContent = question.explanation;
    memoryTip.textContent = question.memory_tip;
    optionReasons.innerHTML = "";
    const wrongReason = question.option_explanations[selectedIndex];
    if (!isCorrect && wrongReason) {
        const wrongBlock = document.createElement("div");
        wrongBlock.className = "option-reason";
        wrongBlock.textContent = `選んだ選択肢: ${wrongReason}`;
        optionReasons.appendChild(wrongBlock);
    }
    const correctBlock = document.createElement("div");
    correctBlock.className = "option-reason";
    correctBlock.textContent = `正解: ${question.options[question.answer_index]}`;
    optionReasons.appendChild(correctBlock);
    renderReferenceLinks(question.reference_links || []);
}
function showNext() {
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
function renderResults() {
    const evaluatedCount = state.answers.length;
    const safeCount = evaluatedCount || 1;
    resultTitle.textContent =
        evaluatedCount === state.queue.length
            ? `${evaluatedCount}問中 ${state.score}問正解`
            : `${evaluatedCount}問回答時点で ${state.score}問正解`;
    const rate = Math.round((state.score / safeCount) * 100);
    resultRate.textContent = `${rate}%`;
    resultMode.textContent = state.customQueue ? "間違えた問題だけ復習" : MODE_LABELS[state.mode];
    resultPremiumPanel.classList.toggle("hidden", state.currentPlan === "premium");
    const wrongAnswers = state.answers.filter((answer) => !answer.correct);
    if (evaluatedCount === 0) {
        resultPremiumTitle.textContent = "短い時間でも積み上げたい人向け";
        resultPremiumCopy.textContent =
            "プレミアム版なら、中断再開と要復習キューでスキマ時間でも仕上げやすくなります。";
        weakCategory.textContent = "まだなし";
        focusWeakButton.classList.add("hidden");
        retryWrongButton.classList.add("hidden");
        retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));
        reviewList.replaceChildren(createEmptyStateCard("回答前に中止しました", "この回では評価対象の回答がありません。次は1問だけでも解いてから振り返ると学習傾向が見えやすくなります。"));
        return;
    }
    if (wrongAnswers.length === 0) {
        resultPremiumTitle.textContent = "次は問題数を広げて安定させる";
        resultPremiumCopy.textContent =
            "プレミアム版なら、全問題とカテゴリ別学習で理解を広げつつ、直前14日モードまでつなげられます。";
        weakCategory.textContent = "なし";
        focusWeakButton.classList.add("hidden");
        retryWrongButton.classList.add("hidden");
        retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));
        reviewList.replaceChildren(createEmptyStateCard("全問正解", "このセットは十分に理解できています。次は問題数を増やしても良さそうです。"));
        return;
    }
    const categoryCounts = {};
    wrongAnswers.forEach((answer) => {
        categoryCounts[answer.category] = (categoryCounts[answer.category] || 0) + 1;
    });
    const [weakestCategory] = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
    resultPremiumTitle.textContent = "苦手を残さず仕上げる";
    resultPremiumCopy.textContent =
        "プレミアム版では、間違えた問題だけ復習、苦手カテゴリ分析、直前14日モードで弱点を回し続けられます。";
    weakCategory.textContent = weakestCategory;
    focusWeakButton.classList.toggle("hidden", !hasFeature("weak_focus"));
    retryWrongButton.classList.toggle("hidden", !hasFeature("retry_wrong"));
    retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));
    reviewList.innerHTML = "";
    wrongAnswers.forEach((answer) => {
        const question = state.queue.find((item) => item.id === answer.questionId);
        const item = document.createElement("article");
        item.className = "review-item";
        const heading = document.createElement("h4");
        heading.textContent = `${question.category} / ${question.subtopic}`;
        const prompt = document.createElement("p");
        prompt.textContent = question.prompt;
        const memory = document.createElement("p");
        memory.textContent = `覚え方: ${question.memory_tip}`;
        item.append(heading, prompt, memory);
        reviewList.appendChild(item);
    });
}
function recordSession() {
    const wrongAnswers = state.answers.filter((answer) => !answer.correct);
    const answeredCount = state.answers.length;
    const session = {
        playedAt: new Date().toISOString(),
        mode: state.customQueue ? "retry_wrong" : state.mode,
        totalQuestions: state.queue.length,
        answeredCount,
        correctCount: state.score,
        answerDetails: state.answers.map((answer) => ({
            questionId: answer.questionId,
            category: answer.category,
            correct: answer.correct,
        })),
        wrongQuestionIds: wrongAnswers.map((answer) => answer.questionId),
        wrongCategories: [...new Set(wrongAnswers.map((answer) => answer.category))],
    };
    state.history.sessions.push(session);
    state.history.sessions = state.history.sessions.slice(-40);
    saveHistory();
    renderHistorySummary();
}
function pauseQuiz() {
    state.pausedSession = {
        mode: state.mode,
        selectedCategory: state.selectedCategory,
        customQueue: state.customQueue,
        queue: state.queue,
        currentIndex: state.currentIndex,
        score: state.score,
        answers: state.answers,
        currentQuestionAnswered: state.currentQuestionAnswered,
        currentSelectedIndex: state.currentSelectedIndex,
    };
    savePausedSession();
    renderResumePanel();
    updateQueuePreview();
    showScreen("start");
}
function clearPausedSession() {
    state.pausedSession = null;
    savePausedSession();
    renderResumePanel();
}
function resumeQuiz() {
    const paused = state.pausedSession;
    if (!paused)
        return;
    state.mode = paused.mode;
    state.selectedCategory = paused.selectedCategory;
    state.customQueue = paused.customQueue;
    state.queue = paused.queue;
    state.currentIndex = paused.currentIndex;
    state.score = paused.score;
    state.answers = paused.answers;
    state.currentQuestionAnswered = paused.currentQuestionAnswered;
    state.currentSelectedIndex = paused.currentSelectedIndex;
    scoreText.textContent = String(state.score);
    modeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.mode === state.mode);
    });
    categoryPicker.classList.toggle("hidden", state.mode !== "category");
    if (state.mode === "category") {
        [...categoryButtonsWrap.querySelectorAll(".category-button")].forEach((button) => {
            button.classList.toggle("is-active", button.textContent === state.selectedCategory);
        });
    }
    showScreen("quiz");
    renderQuestion();
}
function abortQuiz() {
    clearPausedSession();
    recordSession();
    renderResults();
    showScreen("result");
}
function startWrongRetryQuiz() {
    const wrongIds = state.answers.filter((answer) => !answer.correct).map((answer) => answer.questionId);
    const uniqueWrongIds = [...new Set(wrongIds)];
    state.customQueue = state.questions.filter((question) => uniqueWrongIds.includes(question.id));
    if (state.customQueue.length === 0) {
        return;
    }
    updateQueuePreview();
    startQuiz();
}
function renderStudyPlan() {
    const categories = [...new Set(state.questions.map((question) => question.category))];
    const wrongCounts = Object.fromEntries(categories.map((category) => [category, 0]));
    state.history.sessions.forEach((session) => {
        session.wrongCategories.forEach((category) => {
            wrongCounts[category] = (wrongCounts[category] || 0) + 1;
        });
    });
    const orderedCategories = [...categories].sort((a, b) => {
        const diff = (wrongCounts[b] || 0) - (wrongCounts[a] || 0);
        if (diff !== 0)
            return diff;
        return a.localeCompare(b, "ja");
    });
    const cards = [];
    for (let day = 1; day <= 14; day += 1) {
        const category = orderedCategories[(day - 1) % orderedCategories.length] || "著作権";
        const intensity = wrongCounts[category] > 0 ? "重点" : "基礎確認";
        cards.push(createInfoCard(`Day ${day}`, category, `${intensity}で 5問前後。${day % 3 === 0 ? "前日に間違えた論点も再確認。" : "基本用語と正答理由を声に出して確認。"}`, "plan-card"));
    }
    studyPlan.replaceChildren(...cards);
}
function renderCategoryStats() {
    const categories = [...new Set(state.questions.map((question) => question.category))];
    const stats = Object.fromEntries(categories.map((category) => [category, { answered: 0, correct: 0 }]));
    state.history.sessions.forEach((session) => {
        (session.answerDetails || []).forEach((detail) => {
            if (!stats[detail.category]) {
                stats[detail.category] = { answered: 0, correct: 0 };
            }
            stats[detail.category].answered += 1;
            stats[detail.category].correct += detail.correct ? 1 : 0;
        });
    });
    const cards = categories.map((category) => {
        const entry = stats[category];
        if (!entry || entry.answered === 0) {
            return createInfoCard(category, "まだ履歴なし", "このカテゴリを解くと、正答率と学習量がここに表示されます。");
        }
        const rate = Math.round((entry.correct / entry.answered) * 100);
        return createInfoCard(category, `${rate}% 正解`, `${entry.answered}問回答 / ${entry.correct}問正解`);
    });
    categoryStats.replaceChildren(...cards);
}
function renderRecentSessions() {
    const sessions = [...state.history.sessions].slice(-4).reverse();
    if (sessions.length === 0) {
        const card = document.createElement("article");
        card.className = "session-card";
        const label = document.createElement("span");
        label.className = "summary-label";
        label.textContent = "まだ履歴なし";
        const heading = document.createElement("strong");
        heading.textContent = "最初の1回を解くと、ここに記録されます。";
        const copy = document.createElement("p");
        copy.textContent = "途中中止も履歴に残るので、学習ペースを見返しやすくなります。";
        card.append(label, heading, copy);
        recentSessions.replaceChildren(card);
        return;
    }
    recentSessions.replaceChildren(...sessions.map((session) => {
        const label = MODE_LABELS[session.mode] || session.mode;
        const rate = session.answeredCount
            ? Math.round((session.correctCount / session.answeredCount) * 100)
            : 0;
        const playedAt = new Date(session.playedAt).toLocaleString("ja-JP", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
        const article = document.createElement("article");
        article.className = "session-card";
        const playedAtEl = document.createElement("span");
        playedAtEl.className = "summary-label";
        playedAtEl.textContent = playedAt;
        const heading = document.createElement("strong");
        heading.textContent = label;
        const copy = document.createElement("p");
        copy.textContent = `${session.answeredCount}問回答 / ${session.correctCount}問正解 / 正答率 ${rate}%`;
        article.append(playedAtEl, heading, copy);
        return article;
    }));
}
function getRecommendedStudy() {
    const flaggedIds = getFlaggedQuestionIds();
    const priorityCount = flaggedIds.filter((id) => getFlaggedPriority(id) >= 2).length;
    if (hasFeature("flagged_mode") && (priorityCount >= 1 || flaggedIds.length >= 2)) {
        return {
            title: priorityCount >= 1 ? "最重点の復習問題を先に回す" : "要復習だけ学習で穴を埋める",
            copy: priorityCount >= 1
                ? `最重点に入っている ${priorityCount} 問を優先して解くと、忘れやすい論点を短時間で詰められます。`
                : `要復習に入っている ${flaggedIds.length} 問を先に回すと、苦手論点を短時間で詰められます。`,
            mode: "flagged",
            category: "",
        };
    }
    const recentWeak = historyWeakCategory.textContent;
    if (hasFeature("category_mode") && recentWeak && recentWeak !== "まだなし") {
        return {
            title: `${recentWeak} を重点的に復習`,
            copy: `最近の履歴では ${recentWeak} が苦手傾向です。カテゴリ別学習で集中的に解くのがおすすめです。`,
            mode: "category",
            category: recentWeak,
        };
    }
    if (hasFeature("final14_mode") && state.history.sessions.length >= 3) {
        return {
            title: "直前14日モードで反復",
            copy: "履歴がたまってきたので、間違い履歴を使って直前期向けの反復学習を回す段階です。",
            mode: "final14",
            category: "",
        };
    }
    return {
        title: "まずは順番に学習",
        copy: "まだ履歴が少ないので、基本論点を順番に一巡して土台を作るのがおすすめです。",
        mode: "sequential",
        category: "",
    };
}
function renderRecommendation() {
    if (!hasFeature("recommendation")) {
        return;
    }
    const recommendation = getRecommendedStudy();
    recommendTitle.textContent = recommendation.title;
    recommendCopy.textContent = recommendation.copy;
}
function renderFlaggedSummary() {
    const flaggedIds = getFlaggedQuestionIds();
    const priorityCount = flaggedIds.filter((id) => getFlaggedPriority(id) >= 2).length;
    flaggedCountEl.textContent = `${flaggedIds.length}問`;
    priorityCountEl.textContent = `最重点 ${priorityCount}問`;
}
function resetHistory() {
    const confirmed = window.confirm("学習履歴をリセットします。よろしいですか。");
    if (!confirmed) {
        return;
    }
    state.history = { sessions: [] };
    saveHistory();
    renderHistorySummary();
}
function startRecommendedQuiz() {
    if (!hasFeature("recommendation")) {
        showPremiumPrompt("今日のおすすめ問題はプレミアム版で利用できます。");
        return;
    }
    const recommendation = getRecommendedStudy();
    state.customQueue = null;
    state.mode = recommendation.mode;
    state.selectedCategory = recommendation.category || state.selectedCategory;
    modeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.mode === state.mode);
    });
    categoryPicker.classList.toggle("hidden", state.mode !== "category");
    if (state.mode === "category") {
        [...categoryButtonsWrap.querySelectorAll(".category-button")].forEach((button) => {
            button.classList.toggle("is-active", button.textContent === state.selectedCategory);
        });
    }
    updateQueuePreview();
    startQuiz();
}
function toggleCurrentQuestionFlag() {
    const question = state.queue[state.currentIndex];
    if (!question)
        return;
    if (!hasFeature("flagged_mode")) {
        showPremiumPrompt("要復習キューはプレミアム版で利用できます。");
        return;
    }
    const currentPriority = getFlaggedPriority(question.id);
    const nextPriority = hasFeature("flagged_priority")
        ? currentPriority >= 2
            ? 0
            : currentPriority + 1
        : currentPriority >= 1
            ? 0
            : 1;
    if (nextPriority === 0) {
        delete state.flaggedQuestions[question.id];
    }
    else {
        state.flaggedQuestions[question.id] = nextPriority;
    }
    saveFlaggedQuestions();
    renderFlaggedSummary();
    renderRecommendation();
    renderFlagButton(question.id);
    updateQueuePreview();
    retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));
}
function focusWeakCategoryStudy() {
    const category = weakCategory.textContent;
    if (!hasFeature("weak_focus")) {
        showPremiumPrompt("苦手カテゴリ学習はプレミアム版で利用できます。");
        return;
    }
    if (!category || category === "なし" || category === "まだなし") {
        return;
    }
    state.customQueue = null;
    state.mode = "category";
    state.selectedCategory = category;
    modeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.mode === "category");
    });
    categoryPicker.classList.remove("hidden");
    [...categoryButtonsWrap.querySelectorAll(".category-button")].forEach((button) => {
        button.classList.toggle("is-active", button.textContent === category);
    });
    updateQueuePreview();
    startQuiz();
}
function startFlaggedQuiz() {
    if (!hasFeature("flagged_mode")) {
        showPremiumPrompt("要復習だけ学習はプレミアム版で利用できます。");
        return;
    }
    if (getFlaggedQuestionIds().length === 0) {
        window.alert("要復習に入っている問題がまだありません。");
        return;
    }
    state.customQueue = null;
    state.mode = "flagged";
    modeButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.mode === "flagged");
    });
    categoryPicker.classList.add("hidden");
    updateQueuePreview();
    startQuiz();
}
function showScreen(screen) {
    startScreen.classList.toggle("hidden", screen !== "start");
    quizScreen.classList.toggle("hidden", screen !== "quiz");
    resultScreen.classList.toggle("hidden", screen !== "result");
}
function setCurrentPlan(planKey) {
    const normalized = normalizePlanKey(planKey);
    if (normalized === "premium" && state.currentPlan !== "premium") {
        showPremiumPrompt("この画面では、プレミアム版の機能は購入後に使えるようになります。");
        return;
    }
    state.currentPlan = normalized;
    renderPlanState();
    updateQueuePreview();
    renderRecommendation();
}
modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const featureKey = button.dataset.feature;
        if (!hasFeature(featureKey)) {
            showPremiumPrompt("この機能はプレミアム版で利用できます。");
            return;
        }
        modeButtons.forEach((node) => node.classList.remove("is-active"));
        button.classList.add("is-active");
        state.mode = button.dataset.mode;
        state.customQueue = null;
        categoryPicker.classList.toggle("hidden", state.mode !== "category");
        updateQueuePreview();
    });
});
planButtons.forEach((button) => {
    button.addEventListener("click", () => {
        setCurrentPlan(button.dataset.plan);
    });
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
restartButton.addEventListener("click", () => {
    state.customQueue = null;
    updateQueuePreview();
    showScreen("start");
});
async function initApp() {
    loadHistory();
    loadPausedSession();
    loadFlaggedQuestions();
    await loadPlan();
    renderHistorySummary();
    renderResumePanel();
    renderPlanState();
    loadPublicCatalog();
    loadQuestions().catch((error) => {
        console.error(error);
        questionCountEl.textContent = "読み込み失敗";
    });
}
void initApp();
