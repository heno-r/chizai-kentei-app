(function attachQuizScreenControllerUi(): void {
  function showScreen(bindings: ScreenBindings, screen: "start" | "quiz" | "result"): void {
    bindings.startScreen.classList.toggle("hidden", screen !== "start");
    bindings.quizScreen.classList.toggle("hidden", screen !== "quiz");
    bindings.resultScreen.classList.toggle("hidden", screen !== "result");
  }

  function renderResumePanel(bindings: ScreenBindings, viewModel: ResumePanelViewModel): void {
    bindings.resumePanel.classList.toggle("hidden", !viewModel.visible);
    if (!viewModel.visible) {
      return;
    }
    bindings.resumeTitle.textContent = viewModel.title;
    bindings.resumeDescription.textContent = viewModel.description;
  }

  window.QuizScreenControllerUi = {
    showScreen,
    renderResumePanel,
  };
})();
