(function attachQuizStudyFlowActions(): void {
  function applyRecommendedStudy(
    currentState: StudyFlowState,
    recommendation: RecommendedStudy,
  ): StudyFlowState {
    return {
      mode: recommendation.mode,
      selectedCategory: recommendation.category || currentState.selectedCategory,
      customQueue: null,
    };
  }

  function applyWeakCategoryStudy(currentState: StudyFlowState, category: string): StudyFlowState {
    return {
      mode: "category",
      selectedCategory: category,
      customQueue: null,
    };
  }

  function applyFlaggedStudy(currentState: StudyFlowState): StudyFlowState {
    return {
      mode: "flagged",
      selectedCategory: currentState.selectedCategory,
      customQueue: null,
    };
  }

  function applyModeSelection(
    currentState: StudyFlowState,
    mode: Exclude<StudyMode, "retry_wrong">,
  ): StudyFlowState {
    return {
      mode,
      selectedCategory: currentState.selectedCategory,
      customQueue: null,
    };
  }

  function applyPlanAdjustment(context: PlanAdjustmentContext): StudyFlowState {
    const { currentMode, featureAvailability } = context;
    const blocked =
      (currentMode === "category" && !featureAvailability.categoryMode) ||
      (currentMode === "final14" && !featureAvailability.final14Mode) ||
      (currentMode === "flagged" && !featureAvailability.flaggedMode);

    return {
      mode: blocked ? "sequential" : currentMode,
      selectedCategory: "",
      customQueue: null,
    };
  }

  function resetToStartState(currentState: StudyFlowState): StudyFlowState {
    return {
      mode: currentState.mode,
      selectedCategory: currentState.selectedCategory,
      customQueue: null,
    };
  }

  window.QuizStudyFlowActions = {
    applyRecommendedStudy,
    applyWeakCategoryStudy,
    applyFlaggedStudy,
    applyModeSelection,
    applyPlanAdjustment,
    resetToStartState,
  };
})();
