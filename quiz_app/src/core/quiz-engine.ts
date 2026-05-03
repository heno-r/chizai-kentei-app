(function attachQuizEngine(): void {
  function shuffle<T>(array: T[]): T[] {
    const copied = [...array];
    for (let index = copied.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copied[index], copied[swapIndex]] = [copied[swapIndex], copied[index]];
    }
    return copied;
  }

  function getFlaggedQuestionIds(flaggedQuestions: Record<string, number>): string[] {
    return Object.keys(flaggedQuestions).filter((id) => Number(flaggedQuestions[id]) > 0);
  }

  function getFlaggedPriority(flaggedQuestions: Record<string, number>, questionId: string): number {
    return Number(flaggedQuestions[questionId] || 0);
  }

  function buildFinal14Queue(questions: QuizQuestion[], historySessions: SessionRecord[]): QuizQuestion[] {
    const wrongCounts: Record<string, number> = {};
    historySessions.forEach((session) => {
      session.wrongQuestionIds.forEach((questionId) => {
        wrongCounts[questionId] = (wrongCounts[questionId] || 0) + 1;
      });
    });

    const weighted = [...questions].sort((a, b) => {
      const diff = (wrongCounts[b.id] || 0) - (wrongCounts[a.id] || 0);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id, "ja");
    });

    const prioritized = weighted.slice(0, Math.min(5, weighted.length));
    if (prioritized.length < 5) {
      return shuffle(questions).slice(0, 5);
    }
    return shuffle(prioritized);
  }

  function getQuestionsForMode(context: QuizQueueContext): QuizQuestion[] {
    const {
      questions,
      mode,
      selectedCategory,
      customQueue,
      historySessions,
      flaggedQuestions,
      featureAvailability,
    } = context;

    if (customQueue) {
      return [...customQueue];
    }

    if (mode === "random") {
      return shuffle(questions);
    }

    if (mode === "category" && featureAvailability.categoryMode) {
      return questions.filter((question) => question.category === selectedCategory);
    }

    if (mode === "final14" && featureAvailability.final14Mode) {
      return buildFinal14Queue(questions, historySessions);
    }

    if (mode === "flagged" && featureAvailability.flaggedMode) {
      const wrongCounts: Record<string, number> = {};
      historySessions.forEach((session) => {
        session.wrongQuestionIds.forEach((questionId) => {
          wrongCounts[questionId] = (wrongCounts[questionId] || 0) + 1;
        });
      });

      return questions
        .filter((question) => getFlaggedPriority(flaggedQuestions, question.id) > 0)
        .sort((a, b) => {
          const priorityDiff =
            getFlaggedPriority(flaggedQuestions, b.id) - getFlaggedPriority(flaggedQuestions, a.id);
          if (priorityDiff !== 0) return priorityDiff;
          const wrongDiff = (wrongCounts[b.id] || 0) - (wrongCounts[a.id] || 0);
          if (wrongDiff !== 0) return wrongDiff;
          return a.id.localeCompare(b.id, "ja");
        });
    }

    return [...questions];
  }

  function getRecommendedStudy(context: QuizRecommendationContext): RecommendedStudy {
    const { historySessions, flaggedQuestions, recentWeakCategory, featureAvailability } = context;
    const flaggedIds = getFlaggedQuestionIds(flaggedQuestions);
    const priorityCount = flaggedIds.filter((id) => getFlaggedPriority(flaggedQuestions, id) >= 2).length;

    if (featureAvailability.flaggedMode && (priorityCount >= 1 || flaggedIds.length >= 2)) {
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

    if (featureAvailability.categoryMode && recentWeakCategory && recentWeakCategory !== "まだなし") {
      return {
        title: `${recentWeakCategory} を重点的に復習`,
        copy: `最近の履歴では ${recentWeakCategory} が苦手傾向です。カテゴリ別学習で集中的に解くのがおすすめです。`,
        mode: "category",
        category: recentWeakCategory,
      };
    }

    if (featureAvailability.final14Mode && historySessions.length >= 3) {
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

  window.QuizEngine = {
    getFlaggedQuestionIds,
    getFlaggedPriority,
    getQuestionsForMode,
    getRecommendedStudy,
  };
})();
