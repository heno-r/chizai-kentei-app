(function attachQuizHistoryAnalytics(): void {
  function summarizeHistory(history: QuizHistory): HistorySummary {
    const sessions = history.sessions;
    const totalAnswers = sessions.reduce((sum, session) => sum + session.answeredCount, 0);
    const sessionsWithAnswers = sessions.filter((session) => session.answeredCount > 0);
    const averageRate = sessionsWithAnswers.length
      ? Math.round(
          (sessionsWithAnswers.reduce(
            (sum, session) => sum + session.correctCount / session.answeredCount,
            0,
          ) /
            sessionsWithAnswers.length) *
            100,
        )
      : 0;

    const recentWrongCounts: Record<string, number> = {};
    sessions.slice(-5).forEach((session) => {
      session.wrongCategories.forEach((category) => {
        recentWrongCounts[category] = (recentWrongCounts[category] || 0) + 1;
      });
    });
    const recentWeakCategory =
      Object.entries(recentWrongCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "まだなし";

    return {
      sessionCount: sessions.length,
      totalAnswers,
      averageRate,
      recentWeakCategory,
    };
  }

  function buildStudyPlan(questions: QuizQuestion[], history: QuizHistory): StudyPlanDay[] {
    const categories = [...new Set(questions.map((question) => question.category))];
    const wrongCounts = Object.fromEntries(
      categories.map((category) => [category, 0] as const),
    ) as Record<string, number>;

    history.sessions.forEach((session) => {
      session.wrongCategories.forEach((category) => {
        wrongCounts[category] = (wrongCounts[category] || 0) + 1;
      });
    });

    const orderedCategories = [...categories].sort((a, b) => {
      const diff = (wrongCounts[b] || 0) - (wrongCounts[a] || 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b, "ja");
    });

    const plan: StudyPlanDay[] = [];
    for (let day = 1; day <= 14; day += 1) {
      const category = orderedCategories[(day - 1) % orderedCategories.length] || "著作権";
      plan.push({
        day,
        category,
        intensity: wrongCounts[category] > 0 ? "重点" : "基礎確認",
        note:
          day % 3 === 0
            ? "前日に間違えた論点も再確認。"
            : "基本用語と正答理由を声に出して確認。",
      });
    }
    return plan;
  }

  function buildCategoryPerformance(
    questions: QuizQuestion[],
    history: QuizHistory,
  ): CategoryPerformance[] {
    const categories = [...new Set(questions.map((question) => question.category))];
    const stats = Object.fromEntries(
      categories.map((category) => [category, { answered: 0, correct: 0 }] as const),
    ) as Record<string, { answered: number; correct: number }>;

    history.sessions.forEach((session) => {
      session.answerDetails.forEach((detail) => {
        if (!stats[detail.category]) {
          stats[detail.category] = { answered: 0, correct: 0 };
        }
        stats[detail.category].answered += 1;
        stats[detail.category].correct += detail.correct ? 1 : 0;
      });
    });

    return categories.map((category) => {
      const entry = stats[category];
      const rate = entry && entry.answered > 0 ? Math.round((entry.correct / entry.answered) * 100) : null;
      return {
        category,
        answered: entry?.answered || 0,
        correct: entry?.correct || 0,
        rate,
      };
    });
  }

  function buildRecentSessionViewModels(
    history: QuizHistory,
    modeLabels: Record<StudyMode, string>,
    locale = "ja-JP",
  ): RecentSessionViewModel[] {
    return [...history.sessions]
      .slice(-4)
      .reverse()
      .map((session) => ({
        playedAtLabel: new Date(session.playedAt).toLocaleString(locale, {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
        modeLabel: modeLabels[session.mode] || session.mode,
        answeredCount: session.answeredCount,
        correctCount: session.correctCount,
        rate: session.answeredCount ? Math.round((session.correctCount / session.answeredCount) * 100) : 0,
      }));
  }

  window.QuizHistoryAnalytics = {
    summarizeHistory,
    buildStudyPlan,
    buildCategoryPerformance,
    buildRecentSessionViewModels,
  };
})();
