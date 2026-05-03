(function attachQuizStudySessionActions(): void {
  function buildPausedSession(snapshot: PausedSessionSnapshot): PausedSession {
    return {
      mode: snapshot.mode,
      selectedCategory: snapshot.selectedCategory,
      customQueue: snapshot.customQueue,
      queue: snapshot.queue,
      currentIndex: snapshot.currentIndex,
      score: snapshot.score,
      answers: snapshot.answers,
      currentQuestionAnswered: snapshot.currentQuestionAnswered,
      currentSelectedIndex: snapshot.currentSelectedIndex,
    };
  }

  function restorePausedSession(pausedSession: PausedSession): PausedSessionSnapshot {
    return {
      mode: pausedSession.mode as Exclude<StudyMode, "retry_wrong">,
      selectedCategory: pausedSession.selectedCategory,
      customQueue: pausedSession.customQueue,
      queue: pausedSession.queue,
      currentIndex: pausedSession.currentIndex,
      score: pausedSession.score,
      answers: pausedSession.answers,
      currentQuestionAnswered: pausedSession.currentQuestionAnswered,
      currentSelectedIndex: pausedSession.currentSelectedIndex,
    };
  }

  function buildWrongRetryQueue(questions: QuizQuestion[], answers: AnswerRecord[]): QuizQuestion[] {
    const wrongIds = answers.filter((answer) => !answer.correct).map((answer) => answer.questionId);
    const uniqueWrongIds = [...new Set(wrongIds)];
    return questions.filter((question) => uniqueWrongIds.includes(question.id));
  }

  function getNextFlagPriority(currentPriority: number, allowHighPriority: boolean): number {
    if (allowHighPriority) {
      return currentPriority >= 2 ? 0 : currentPriority + 1;
    }
    return currentPriority >= 1 ? 0 : 1;
  }

  window.QuizStudySessionActions = {
    buildPausedSession,
    restorePausedSession,
    buildWrongRetryQueue,
    getNextFlagPriority,
  };
})();
