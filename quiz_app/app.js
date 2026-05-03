const state = {
  questions: [],
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

const APP_VERSION = "20260428-1";
const {
  PLAN_ORDER,
  PLAN_LABELS,
  PLAN_COPY,
  MODE_LABELS,
  hasFeature: featureEnabledForPlan,
  requiredPlanLabel,
} = window.QuizFeatureFlags;
const {
  historyRepository,
  pausedSessionRepository,
  flaggedQuestionRepository,
  planRepository,
} = window.QuizStorageRepositories;
const { loadLocalQuestions } = window.QuizQuestionRepository;

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
const nextButton = document.getElementById("next-button");
const pauseButton = document.getElementById("pause-button");
const abortButton = document.getElementById("abort-button");
const resultTitle = document.getElementById("result-title");
const resultRate = document.getElementById("result-rate");
const weakCategory = document.getElementById("weak-category");
const resultMode = document.getElementById("result-mode");
const reviewList = document.getElementById("review-list");
const focusWeakButton = document.getElementById("focus-weak-button");
const retryWrongButton = document.getElementById("retry-wrong-button");
const retryFlaggedButton = document.getElementById("retry-flagged-button");
const restartButton = document.getElementById("restart-button");

async function loadQuestions() {
  const payload = await loadLocalQuestions(APP_VERSION);
  state.questions = payload.questions;
  questionCountEl.textContent = `${state.questions.length}問`;
  buildCategoryButtons();
  renderStudyPlan();
  updateQueuePreview();
}

function loadHistory() {
  state.history = historyRepository.load();
}

function saveHistory() {
  historyRepository.save(state.history);
}

function loadPlan() {
  state.currentPlan = planRepository.load("free", PLAN_ORDER);
}

function savePlan() {
  planRepository.save(state.currentPlan);
}

function loadFlaggedQuestions() {
  state.flaggedQuestions = flaggedQuestionRepository.load();
}

function saveFlaggedQuestions() {
  flaggedQuestionRepository.save(state.flaggedQuestions);
}

function hasFeature(featureKey) {
  return featureEnabledForPlan(state.currentPlan, featureKey);
}

function getFlaggedQuestionIds() {
  return Object.keys(state.flaggedQuestions).filter((id) => Number(state.flaggedQuestions[id]) > 0);
}

function getFlaggedPriority(questionId) {
  return Number(state.flaggedQuestions[questionId] || 0);
}

function loadPausedSession() {
  state.pausedSession = pausedSessionRepository.load();
}

function savePausedSession() {
  pausedSessionRepository.save(state.pausedSession);
}

function renderHistorySummary() {
  const sessions = state.history.sessions;
  historySessionCount.textContent = `${sessions.length}回`;

  const totalAnswers = sessions.reduce((sum, session) => sum + session.answeredCount, 0);
  historyAnswerCount.textContent = `${totalAnswers}問`;

  const sessionsWithAnswers = sessions.filter((session) => session.answeredCount > 0);
  const average = sessionsWithAnswers.length
    ? Math.round(
        sessionsWithAnswers.reduce(
          (sum, session) => sum + session.correctCount / session.answeredCount,
          0,
        ) /
          sessionsWithAnswers.length *
          100,
      )
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
  planTitle.textContent = `現在のプラン: ${PLAN_LABELS[state.currentPlan]}`;
  planCopy.textContent = PLAN_COPY[state.currentPlan];

  planButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.plan === state.currentPlan);
  });

  modeButtons.forEach((button) => {
    const featureKey = button.dataset.feature;
    const allowed = hasFeature(featureKey);
    button.classList.toggle("is-plan-locked", !allowed);
    button.setAttribute("aria-disabled", String(!allowed));
    button.title = allowed ? "" : `${requiredPlanLabel(featureKey)}プランで利用できます`;
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
  } else {
    renderResumePanel();
  }
}

function renderResumePanel() {
  if (!hasFeature("pause_resume")) {
    resumePanel.classList.add("hidden");
    return;
  }
  const paused = state.pausedSession;
  resumePanel.classList.toggle("hidden", !paused);
  if (!paused) return;

  const answeredCount = paused.answers.length;
  const pausedModeLabel = paused.customQueue ? MODE_LABELS.retry_wrong : MODE_LABELS[paused.mode];
  resumeTitle.textContent = `${pausedModeLabel} を ${answeredCount}問回答済み`;
  resumeDescription.textContent = `${paused.currentIndex + 1}問目から再開できます。カテゴリ: ${
    paused.selectedCategory || "全体"
  }`;
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
      [...categoryButtonsWrap.querySelectorAll(".category-button")].forEach((node) =>
        node.classList.toggle("is-active", node === button),
      );
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
        if (priorityDiff !== 0) return priorityDiff;
        const wrongDiff = (wrongCounts[b.id] || 0) - (wrongCounts[a.id] || 0);
        if (wrongDiff !== 0) return wrongDiff;
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
    if (diff !== 0) return diff;
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
  if (state.customQueue) {
    queuePreviewEl.textContent = `復習セット ${previewQueue.length}問`;
    return;
  }
  if (state.mode === "category") {
    if (!hasFeature("category_mode")) {
      queuePreviewEl.textContent = `${requiredPlanLabel("category_mode")}で解放`;
      return;
    }
    queuePreviewEl.textContent = `${state.selectedCategory} ${previewQueue.length}問`;
    return;
  }
  if (state.mode === "final14") {
    if (!hasFeature("final14_mode")) {
      queuePreviewEl.textContent = `${requiredPlanLabel("final14_mode")}で解放`;
      return;
    }
    queuePreviewEl.textContent = `直前セット ${previewQueue.length}問`;
    return;
  }
  if (state.mode === "flagged") {
    if (!hasFeature("flagged_mode")) {
      queuePreviewEl.textContent = `${requiredPlanLabel("flagged_mode")}で解放`;
      return;
    }
    queuePreviewEl.textContent = `要復習セット ${previewQueue.length}問`;
    return;
  }
  queuePreviewEl.textContent = `全${previewQueue.length}問`;
}

function startQuiz() {
  if (
    (state.mode === "category" && !hasFeature("category_mode")) ||
    (state.mode === "final14" && !hasFeature("final14_mode")) ||
    (state.mode === "flagged" && !hasFeature("flagged_mode"))
  ) {
    window.alert("現在のプランではこのモードは使えません。");
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
    renderFeedback(
      question,
      answeredEntry ? answeredEntry.correct : state.currentSelectedIndex === question.answer_index,
      state.currentSelectedIndex,
    );
    nextButton.classList.remove("hidden");
  }
}

function renderFlagButton(questionId) {
  const priority = getFlaggedPriority(questionId);
  flagToggleButton.classList.toggle("is-flagged", priority >= 1);
  flagToggleButton.classList.toggle("is-priority-high", priority >= 2);

  if (!hasFeature("flagged_mode")) {
    flagToggleButton.textContent = `${requiredPlanLabel("flagged_mode")}で解放`;
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

  const wrongAnswers = state.answers.filter((answer) => !answer.correct);
  if (evaluatedCount === 0) {
    weakCategory.textContent = "まだなし";
    focusWeakButton.classList.add("hidden");
    retryWrongButton.classList.add("hidden");
    retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));
    reviewList.innerHTML =
      '<div class="review-item"><h4>回答前に中止しました</h4><p>この回では評価対象の回答がありません。次は1問だけでも解いてから振り返ると学習傾向が見えやすくなります。</p></div>';
    return;
  }

  if (wrongAnswers.length === 0) {
    weakCategory.textContent = "なし";
    focusWeakButton.classList.add("hidden");
    retryWrongButton.classList.add("hidden");
    retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));
    reviewList.innerHTML = '<div class="review-item"><h4>全問正解</h4><p>このセットは十分に理解できています。次は問題数を増やしても良さそうです。</p></div>';
    return;
  }

  const categoryCounts = {};
  wrongAnswers.forEach((answer) => {
    categoryCounts[answer.category] = (categoryCounts[answer.category] || 0) + 1;
  });
  const [weakestCategory] = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  weakCategory.textContent = weakestCategory;
  focusWeakButton.classList.toggle("hidden", !hasFeature("weak_focus"));
  retryWrongButton.classList.toggle("hidden", !hasFeature("retry_wrong"));
  retryFlaggedButton.classList.toggle("hidden", getFlaggedQuestionIds().length === 0 || !hasFeature("flagged_mode"));

  reviewList.innerHTML = "";
  wrongAnswers.forEach((answer) => {
    const question = state.queue.find((item) => item.id === answer.questionId);
    const item = document.createElement("article");
    item.className = "review-item";
    item.innerHTML = `
      <h4>${question.category} / ${question.subtopic}</h4>
      <p>${question.prompt}</p>
      <p>覚え方: ${question.memory_tip}</p>
    `;
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
  if (!paused) return;

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
    if (diff !== 0) return diff;
    return a.localeCompare(b, "ja");
  });

  const cards = [];
  for (let day = 1; day <= 14; day += 1) {
    const category = orderedCategories[(day - 1) % orderedCategories.length] || "著作権";
    const intensity = wrongCounts[category] > 0 ? "重点" : "基礎確認";
    cards.push(`
      <article class="plan-card">
        <span class="summary-label">Day ${day}</span>
        <strong>${category}</strong>
        <p>${intensity}で 5問前後。${day % 3 === 0 ? "前日に間違えた論点も再確認。" : "基本用語と正答理由を声に出して確認。"}</p>
      </article>
    `);
  }
  studyPlan.innerHTML = cards.join("");
}

function renderCategoryStats() {
  const categories = [...new Set(state.questions.map((question) => question.category))];
  const stats = Object.fromEntries(
    categories.map((category) => [category, { answered: 0, correct: 0 }]),
  );

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
      return `
        <article class="stat-card">
          <span class="summary-label">${category}</span>
          <strong>まだ履歴なし</strong>
          <p>このカテゴリを解くと、正答率と学習量がここに表示されます。</p>
        </article>
      `;
    }
    const rate = Math.round((entry.correct / entry.answered) * 100);
    return `
      <article class="stat-card">
        <span class="summary-label">${category}</span>
        <strong>${rate}% 正解</strong>
        <p>${entry.answered}問回答 / ${entry.correct}問正解</p>
      </article>
    `;
  });
  categoryStats.innerHTML = cards.join("");
}

function renderRecentSessions() {
  const sessions = [...state.history.sessions].slice(-4).reverse();
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
      return `
        <article class="session-card">
          <span class="summary-label">${playedAt}</span>
          <strong>${label}</strong>
          <p>${session.answeredCount}問回答 / ${session.correctCount}問正解 / 正答率 ${rate}%</p>
        </article>
      `;
    })
    .join("");
}

function getRecommendedStudy() {
  const flaggedIds = getFlaggedQuestionIds();
  const priorityCount = flaggedIds.filter((id) => getFlaggedPriority(id) >= 2).length;
  if (hasFeature("flagged_mode") && (priorityCount >= 1 || flaggedIds.length >= 2)) {
    return {
      title: priorityCount >= 1 ? "最重点の復習問題を先に回す" : "要復習だけ学習で穴を埋める",
      copy:
        priorityCount >= 1
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
    window.alert("現在のプランではおすすめ機能は使えません。");
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
  if (!question) return;
  if (!hasFeature("flagged_mode")) {
    window.alert("現在のプランでは要復習機能は使えません。");
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

function focusWeakCategoryStudy() {
  const category = weakCategory.textContent;
  if (!hasFeature("weak_focus")) {
    window.alert("現在のプランでは苦手カテゴリ学習は使えません。");
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
    window.alert("現在のプランでは要復習学習は使えません。");
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
  if (!PLAN_ORDER.includes(planKey)) return;
  state.currentPlan = planKey;
  savePlan();

  if (
    (state.mode === "category" && !hasFeature("category_mode")) ||
    (state.mode === "final14" && !hasFeature("final14_mode")) ||
    (state.mode === "flagged" && !hasFeature("flagged_mode"))
  ) {
    state.mode = "sequential";
    state.customQueue = null;
  }

  modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  });
  renderHistorySummary();
  renderPlanState();
  renderFlagButton(state.queue[state.currentIndex]?.id || "");
  updateQueuePreview();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const featureKey = button.dataset.feature;
    if (!hasFeature(featureKey)) {
      window.alert(`${requiredPlanLabel(featureKey)}プランで利用できる機能です。`);
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

loadHistory();
loadPausedSession();
loadFlaggedQuestions();
loadPlan();
renderHistorySummary();
renderResumePanel();
renderPlanState();
loadQuestions().catch((error) => {
  console.error(error);
  questionCountEl.textContent = "読み込み失敗";
});
