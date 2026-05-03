(function attachQuizResultScreenUi(): void {
  function renderSummary(
    bindings: ResultScreenBindings,
    summary: Pick<QuizResultSummary, "title" | "rate" | "weakCategory" | "modeLabel">,
  ): void {
    bindings.resultTitle.textContent = summary.title;
    bindings.resultRate.textContent = `${summary.rate}%`;
    bindings.weakCategory.textContent = summary.weakCategory;
    bindings.resultMode.textContent = summary.modeLabel;
  }

  function renderInfoCard(bindings: ResultScreenBindings, heading: string, body: string): void {
    bindings.reviewList.innerHTML = `<div class="review-item"><h4>${heading}</h4><p>${body}</p></div>`;
  }

  function renderReviewItems(bindings: ResultScreenBindings, items: ResultReviewItem[]): void {
    bindings.reviewList.innerHTML = "";
    items.forEach((item) => {
      const element = document.createElement("article");
      element.className = "review-item";
      element.innerHTML = `
        <h4>${item.title}</h4>
        <p>${item.prompt}</p>
        <p>覚え方: ${item.memoryTip}</p>
      `;
      bindings.reviewList.appendChild(element);
    });
  }

  window.QuizResultScreenUi = {
    renderSummary,
    renderInfoCard,
    renderReviewItems,
  };
})();
