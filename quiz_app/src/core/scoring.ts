(function attachQuizScoring(): void {
  function evaluateAnswer(question: QuizQuestion, selectedIndex: number): boolean {
    return selectedIndex === question.answer_index;
  }

  function buildResultSummary(context: ResultSummaryContext): QuizResultSummary {
    const { answers, queueLength, score, modeLabel } = context;
    const evaluatedCount = answers.length;
    const safeCount = evaluatedCount || 1;
    const rate = Math.round((score / safeCount) * 100);
    const wrongAnswers = answers.filter((answer) => !answer.correct);

    if (evaluatedCount === 0) {
      return {
        evaluatedCount,
        rate,
        title: `${evaluatedCount}問回答時点で ${score}問正解`,
        modeLabel,
        weakCategory: "まだなし",
        state: "not_answered",
        wrongAnswers,
      };
    }

    if (wrongAnswers.length === 0) {
      return {
        evaluatedCount,
        rate,
        title:
          evaluatedCount === queueLength
            ? `${evaluatedCount}問中 ${score}問正解`
            : `${evaluatedCount}問回答時点で ${score}問正解`,
        modeLabel,
        weakCategory: "なし",
        state: "all_correct",
        wrongAnswers,
      };
    }

    const categoryCounts: Record<string, number> = {};
    wrongAnswers.forEach((answer) => {
      categoryCounts[answer.category] = (categoryCounts[answer.category] || 0) + 1;
    });
    const weakCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "まだなし";

    return {
      evaluatedCount,
      rate,
      title:
        evaluatedCount === queueLength
          ? `${evaluatedCount}問中 ${score}問正解`
          : `${evaluatedCount}問回答時点で ${score}問正解`,
      modeLabel,
      weakCategory,
      state: "needs_review",
      wrongAnswers,
    };
  }

  function buildSessionRecord(context: SessionRecordContext): SessionRecord {
    const { answers, queueLength, score, mode, customQueue } = context;
    const wrongAnswers = answers.filter((answer) => !answer.correct);
    return {
      playedAt: new Date().toISOString(),
      mode: customQueue ? "retry_wrong" : mode,
      totalQuestions: queueLength,
      answeredCount: answers.length,
      correctCount: score,
      answerDetails: answers.map((answer) => ({
        questionId: answer.questionId,
        category: answer.category,
        correct: answer.correct,
      })),
      wrongQuestionIds: wrongAnswers.map((answer) => answer.questionId),
      wrongCategories: [...new Set(wrongAnswers.map((answer) => answer.category))],
    };
  }

  window.QuizScoring = {
    evaluateAnswer,
    buildResultSummary,
    buildSessionRecord,
  };
})();
