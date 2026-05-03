(function attachQuizScreenUi(): void {
  function renderQuestionHeader(bindings: QuizScreenBindings, viewModel: QuizQuestionViewModel): void {
    bindings.progressText.textContent = viewModel.progressText;
    bindings.questionTitle.textContent = viewModel.title;
    bindings.categoryBadge.textContent = viewModel.category;
    bindings.subtopicBadge.textContent = viewModel.subtopic;
  }

  function renderChoiceButtons(
    bindings: QuizScreenBindings,
    options: string[],
    onSelect: (selectedIndex: number, button: HTMLButtonElement) => void,
  ): void {
    bindings.choicesWrap.innerHTML = "";
    options.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.textContent = `${index + 1}. ${choice}`;
      button.addEventListener("click", () => onSelect(index, button));
      bindings.choicesWrap.appendChild(button);
    });
  }

  function renderAnsweredState(
    bindings: QuizScreenBindings,
    answerIndex: number,
    selectedIndex: number,
    selectedButton: HTMLButtonElement | null = null,
    isCorrect: boolean | null = null,
  ): void {
    const answerIsCorrect = isCorrect ?? selectedIndex === answerIndex;
    const buttons = [...bindings.choicesWrap.querySelectorAll<HTMLButtonElement>(".choice-button")];

    buttons.forEach((button, index) => {
      button.disabled = true;
      if (index === answerIndex) {
        button.classList.add("is-correct");
      }
    });

    if (!answerIsCorrect) {
      const wrongButton = selectedButton ?? buttons[selectedIndex];
      wrongButton?.classList.add("is-wrong");
    }
  }

  function renderFeedback(bindings: QuizScreenBindings, feedback: FeedbackViewModel): void {
    bindings.feedbackCard.classList.remove("hidden");
    bindings.feedbackStatus.textContent = feedback.statusText;
    bindings.feedbackStatus.className = feedback.statusClassName;
    bindings.feedbackExplanation.textContent = feedback.explanation;
    bindings.memoryTip.textContent = feedback.memoryTip;
    bindings.optionReasons.innerHTML = "";

    if (feedback.wrongReason) {
      const wrongBlock = document.createElement("div");
      wrongBlock.className = "option-reason";
      wrongBlock.textContent = `選んだ選択肢: ${feedback.wrongReason}`;
      bindings.optionReasons.appendChild(wrongBlock);
    }

    const correctBlock = document.createElement("div");
    correctBlock.className = "option-reason";
    correctBlock.textContent = `正解: ${feedback.correctOption}`;
    bindings.optionReasons.appendChild(correctBlock);
  }

  function resetQuestionFeedback(bindings: QuizScreenBindings): void {
    bindings.feedbackCard.classList.add("hidden");
    bindings.nextButton.classList.add("hidden");
    bindings.pauseButton.classList.remove("hidden");
    bindings.abortButton.classList.remove("hidden");
  }

  function showNextAction(bindings: QuizScreenBindings): void {
    bindings.nextButton.classList.remove("hidden");
  }

  window.QuizScreenUi = {
    renderQuestionHeader,
    renderChoiceButtons,
    renderAnsweredState,
    renderFeedback,
    resetQuestionFeedback,
    showNextAction,
  };
})();
