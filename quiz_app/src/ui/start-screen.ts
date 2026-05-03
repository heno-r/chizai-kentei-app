(function attachQuizStartScreenUi(): void {
  function renderPlanHeader(bindings: StartScreenBindings, planLabel: string, planCopyText: string): void {
    bindings.planTitle.textContent = `現在のプラン: ${planLabel}`;
    bindings.planCopy.textContent = planCopyText;
  }

  function renderQuestionSetOptions(
    bindings: StartScreenBindings,
    sets: QuestionSetCatalogItem[],
    currentSetId: string,
  ): void {
    bindings.questionSetSelect.innerHTML = "";
    sets.forEach((setItem) => {
      const option = document.createElement("option");
      option.value = setItem.set_id;
      option.textContent = `${setItem.label} (${setItem.question_count}問)`;
      option.selected = setItem.set_id === currentSetId;
      bindings.questionSetSelect.appendChild(option);
    });
    bindings.questionSetSelect.disabled = sets.length <= 1;
  }

  function renderQuestionSetMeta(bindings: StartScreenBindings, text: string): void {
    bindings.questionSetMeta.textContent = text;
  }

  function renderQuestionSetSummary(
    bindings: StartScreenBindings,
    description: string,
    audienceTag: string,
  ): void {
    bindings.questionSetDescription.textContent = description;
    bindings.questionSetTag.textContent = audienceTag || "標準セット";
  }

  function renderQuestionSetState(
    bindings: StartScreenBindings,
    viewModel: QuestionSetStateViewModel,
  ): void {
    bindings.questionSetStatus.textContent = viewModel.statusText;
    bindings.questionSetSelect.disabled = viewModel.disableSelect;
    bindings.questionSetRetryButton.classList.toggle("hidden", !viewModel.showRetry);
  }

  function renderPlanState(bindings: StartScreenBindings, viewModel: StartScreenPlanStateViewModel): void {
    renderPlanHeader(bindings, viewModel.planLabel, viewModel.planCopy);

    bindings.planButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.plan === viewModel.currentPlan);
    });

    bindings.modeButtons.forEach((button) => {
      const mode = button.dataset.mode as Exclude<StudyMode, "retry_wrong"> | undefined;
      if (!mode) return;

      const modeState = viewModel.modeAvailability[mode];
      const lockNote = button.querySelector<HTMLElement>(".mode-lock-note");
      button.classList.toggle("is-active", mode === viewModel.currentMode);
      button.classList.toggle("is-plan-locked", !modeState.enabled);
      button.setAttribute("aria-disabled", String(!modeState.enabled));
      button.title = modeState.enabled ? "" : modeState.lockedMessage;
      if (lockNote) {
        lockNote.textContent = modeState.enabled ? "" : modeState.lockedMessage;
      }
    });

    bindings.studyPlanPanel.classList.toggle("hidden", !viewModel.panelVisibility.studyPlan);
    bindings.recommendPanel.classList.toggle("hidden", !viewModel.panelVisibility.recommendation);
    bindings.categoryStatsPanel.classList.toggle("hidden", !viewModel.panelVisibility.categoryStats);
    bindings.recentSessionsPanel.classList.toggle("hidden", !viewModel.panelVisibility.recentSessions);
    bindings.categoryPicker.classList.toggle("hidden", !viewModel.panelVisibility.categoryPicker);

    if (viewModel.selectedCategory) {
      setCategoryButtonSelection(bindings, viewModel.selectedCategory);
    }
  }

  function renderHistorySummary(bindings: StartScreenBindings, summary: HistorySummary): void {
    bindings.historySessionCount.textContent = `${summary.sessionCount}回`;
    bindings.historyAnswerCount.textContent = `${summary.totalAnswers}問`;
    bindings.historyAverageRate.textContent = `${summary.averageRate}%`;
    bindings.historyWeakCategory.textContent = summary.recentWeakCategory;
  }

  function renderQueuePreview(bindings: StartScreenBindings, text: string): void {
    bindings.queuePreview.textContent = text;
  }

  function renderFlaggedSummary(
    bindings: StartScreenBindings,
    flaggedCount: number,
    priorityCount: number,
  ): void {
    bindings.flaggedCount.textContent = `${flaggedCount}問`;
    bindings.priorityCount.textContent = `最重点 ${priorityCount}問`;
  }

  function renderRecommendation(
    bindings: StartScreenBindings,
    recommendation: RecommendedStudy,
  ): void {
    bindings.recommendTitle.textContent = recommendation.title;
    bindings.recommendCopy.textContent = recommendation.copy;
  }

  function renderCategoryButtons(
    bindings: StartScreenBindings,
    categories: string[],
    selectedCategory: string,
    onSelect: (category: string, button: HTMLButtonElement) => void,
  ): void {
    bindings.categoryButtonsWrap.innerHTML = "";
    categories.forEach((category) => {
      const button = document.createElement("button");
      button.className = `category-button ${category === selectedCategory ? "is-active" : ""}`;
      button.textContent = category;
      button.addEventListener("click", () => onSelect(category, button));
      bindings.categoryButtonsWrap.appendChild(button);
    });
  }

  function setCategoryButtonSelection(bindings: StartScreenBindings, selectedCategory: string): void {
    [...bindings.categoryButtonsWrap.querySelectorAll<HTMLButtonElement>(".category-button")].forEach((button) => {
      button.classList.toggle("is-active", button.textContent === selectedCategory);
    });
  }

  window.QuizStartScreenUi = {
    renderPlanHeader,
    renderPlanState,
    renderQuestionSetOptions,
    renderQuestionSetMeta,
    renderQuestionSetSummary,
    renderQuestionSetState,
    renderHistorySummary,
    renderQueuePreview,
    renderFlaggedSummary,
    renderRecommendation,
    renderCategoryButtons,
    setCategoryButtonSelection,
  };
})();
