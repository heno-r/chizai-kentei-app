(function attachQuizQuestionRepository(): void {
  function resolveSetId(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get("set_id");
  }

  function assertSupportedProtocol(): void {
    if (window.location.protocol === "file:") {
      throw new Error("file:// 直開きでは問題を取得できません。run_quiz_app.bat から起動してください。");
    }
  }

  async function loadPublicCatalog(appVersion: string, planKey: PlanKey = "free"): Promise<QuestionSetCatalogItem[]> {
    assertSupportedProtocol();
    const response = await fetch(
      `./api/public/catalog?plan=${encodeURIComponent(planKey)}&v=${appVersion}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(`Question catalog request failed: ${response.status}`);
    }
    const payload = (await response.json()) as { sets?: QuestionSetCatalogItem[] };
    return payload.sets || [];
  }

  async function loadLocalQuestions(
    appVersion: string,
    setIdArg?: string | null,
    planKey: PlanKey = "free",
  ): Promise<QuestionPayload> {
    assertSupportedProtocol();
    const setId = setIdArg || resolveSetId() || "grade3_mixed_priority_50";
    const response = await fetch(
      `./api/public/questions?set_id=${encodeURIComponent(setId)}&plan=${encodeURIComponent(planKey)}&v=${appVersion}`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new Error(`Question API request failed: ${response.status}`);
    }
    return response.json() as Promise<QuestionPayload>;
  }

  window.QuizQuestionRepository = {
    loadPublicCatalog,
    loadLocalQuestions,
    resolveInitialSetId: resolveSetId,
  };
})();
