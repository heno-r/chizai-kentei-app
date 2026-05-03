(function attachQuizStorageRepositories(): void {
  const STORAGE_KEYS = {
    history: "chizai-quiz-history-v1",
    pausedSession: "chizai-quiz-paused-v1",
    flaggedQuestions: "chizai-quiz-flagged-v1",
    plan: "chizai-quiz-plan-v1",
  } as const;

  function parseJson<T>(rawValue: string | null, fallbackValue: T): T {
    if (!rawValue) {
      return fallbackValue;
    }
    try {
      return JSON.parse(rawValue) as T;
    } catch (error) {
      return fallbackValue;
    }
  }

  const historyRepository = {
    load(): QuizHistory {
      const parsed = parseJson<QuizHistory>(localStorage.getItem(STORAGE_KEYS.history), { sessions: [] });
      return Array.isArray(parsed.sessions) ? parsed : { sessions: [] };
    },
    save(history: QuizHistory): void {
      localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
    },
  };

  const pausedSessionRepository = {
    load(): PausedSession | null {
      return parseJson<PausedSession | null>(localStorage.getItem(STORAGE_KEYS.pausedSession), null);
    },
    save(pausedSession: PausedSession | null): void {
      if (!pausedSession) {
        localStorage.removeItem(STORAGE_KEYS.pausedSession);
        return;
      }
      localStorage.setItem(STORAGE_KEYS.pausedSession, JSON.stringify(pausedSession));
    },
  };

  const flaggedQuestionRepository = {
    load(): Record<string, number> {
      const parsed = parseJson<Record<string, number> | string[]>(
        localStorage.getItem(STORAGE_KEYS.flaggedQuestions),
        {},
      );
      if (Array.isArray(parsed)) {
        return Object.fromEntries(parsed.map((id) => [id, 1]));
      }
      return parsed && typeof parsed === "object" ? parsed : {};
    },
    save(flaggedQuestions: Record<string, number>): void {
      localStorage.setItem(STORAGE_KEYS.flaggedQuestions, JSON.stringify(flaggedQuestions));
    },
  };

  const planRepository = {
    load(defaultPlan: PlanKey, planOrder: PlanKey[]): PlanKey {
      const stored = localStorage.getItem(STORAGE_KEYS.plan);
      const normalized = stored === "standard" ? "premium" : stored;
      return normalized && planOrder.includes(normalized as PlanKey) ? (normalized as PlanKey) : defaultPlan;
    },
    save(planKey: PlanKey): void {
      localStorage.setItem(STORAGE_KEYS.plan, planKey);
    },
    clear(): void {
      localStorage.removeItem(STORAGE_KEYS.plan);
    },
  };

  window.QuizStorageRepositories = {
    historyRepository,
    pausedSessionRepository,
    flaggedQuestionRepository,
    planRepository,
  };
})();
