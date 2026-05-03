(function attachQuizQuestionRepository() {
  function resolveSetId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("set_id");
  }

  function assertSupportedProtocol() {
    if (window.location.protocol === "file:") {
      throw new Error("file:// 直開きでは問題を取得できません。run_quiz_app.bat から起動してください。");
    }
  }

  async function loadPublicCatalog(appVersion, planKey = "free") {
    assertSupportedProtocol();
    const response = await fetch(
      `./api/public/catalog?plan=${encodeURIComponent(planKey)}&v=${appVersion}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(`Question catalog request failed: ${response.status}`);
    }
    const payload = await response.json();
    return payload.sets || [];
  }

  async function loadLocalQuestions(appVersion, setIdArg, planKey = "free") {
    assertSupportedProtocol();
    const setId = setIdArg || resolveSetId() || "grade3_mixed_priority_50";
    const response = await fetch(
      `./api/public/questions?set_id=${encodeURIComponent(setId)}&plan=${encodeURIComponent(planKey)}&v=${appVersion}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(`Question API request failed: ${response.status}`);
    }
    return response.json();
  }

  window.QuizQuestionRepository = {
    loadPublicCatalog,
    loadLocalQuestions,
    resolveInitialSetId: resolveSetId,
  };
})();
