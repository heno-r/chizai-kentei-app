(function attachQuizStorageRepositories() {
  const STORAGE_KEYS = {
    history: "chizai-quiz-history-v1",
    pausedSession: "chizai-quiz-paused-v1",
    flaggedQuestions: "chizai-quiz-flagged-v1",
    plan: "chizai-quiz-plan-v1",
  };

  function parseJson(rawValue, fallbackValue) {
    if (!rawValue) {
      return fallbackValue;
    }
    try {
      return JSON.parse(rawValue);
    } catch (error) {
      return fallbackValue;
    }
  }

  const historyRepository = {
    load() {
      const parsed = parseJson(localStorage.getItem(STORAGE_KEYS.history), { sessions: [] });
      return Array.isArray(parsed.sessions) ? parsed : { sessions: [] };
    },
    save(history) {
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
    },
  };

  const pausedSessionRepository = {
    load() {
      return parseJson(localStorage.getItem(STORAGE_KEYS.pausedSession), null);
    },
    save(pausedSession) {
      if (!pausedSession) {
        localStorage.removeItem(STORAGE_KEYS.pausedSession);
        return;
      }
      localStorage.setItem(STORAGE_KEYS.pausedSession, JSON.stringify(pausedSession));
    },
  };

  const flaggedQuestionRepository = {
    load() {
      const parsed = parseJson(localStorage.getItem(STORAGE_KEYS.flaggedQuestions), {});
      if (Array.isArray(parsed)) {
        return Object.fromEntries(parsed.map((id) => [id, 1]));
      }
      return parsed && typeof parsed === "object" ? parsed : {};
    },
    save(flaggedQuestions) {
      localStorage.setItem(STORAGE_KEYS.flaggedQuestions, JSON.stringify(flaggedQuestions));
    },
  };

  const planRepository = {
    load(defaultPlan, planOrder) {
      const stored = localStorage.getItem(STORAGE_KEYS.plan);
      return stored && planOrder.includes(stored) ? stored : defaultPlan;
    },
    save(planKey) {
      localStorage.setItem(STORAGE_KEYS.plan, planKey);
    },
  };

  window.QuizStorageRepositories = {
    historyRepository,
    pausedSessionRepository,
    flaggedQuestionRepository,
    planRepository,
  };
})();
