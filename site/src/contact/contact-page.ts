(function attachContactPage(): void {
  const runtimeConfig = window.APP_RUNTIME_CONFIG || {};
  const form = document.getElementById("contact-form") as HTMLFormElement | null;
  const submitButton = document.getElementById("contact-submit-button") as HTMLButtonElement | null;
  const statusMessage = document.getElementById("contact-status-message") as HTMLElement | null;
  const supportEmailNote = document.getElementById("support-email-note") as HTMLElement | null;

  function buildApiUrl(path: string): string {
    const baseUrl = (runtimeConfig.secureApiBaseUrl || "").replace(/\/+$/, "");
    return baseUrl ? `${baseUrl}${path}` : path;
  }

  function setStatus(message: string, isError = false): void {
    if (!statusMessage) {
      return;
    }
    statusMessage.textContent = message;
    statusMessage.classList.remove("hidden");
    statusMessage.classList.toggle("is-error", isError);
  }

  function getSupportEmail(): string | null {
    const value = String(runtimeConfig.supportEmail || "").trim();
    if (!value || /example\.com/i.test(value)) {
      return null;
    }
    return value;
  }

  function renderSupportEmailNote(): void {
    if (!supportEmailNote) {
      return;
    }
    const supportEmail = getSupportEmail();
    if (!supportEmail) {
      supportEmailNote.classList.add("hidden");
      supportEmailNote.textContent = "";
      return;
    }
    supportEmailNote.textContent = `必要に応じて ${supportEmail} から返信することがあります。受信設定をご確認ください。`;
    supportEmailNote.classList.remove("hidden");
  }

  function formatContactError(error: unknown): string {
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "unknown_error";

    if (message.includes("request failed: 404")) {
      return "ただいまお問い合わせを受け付けられません。時間をおいてからもう一度お試しください。";
    }
    if (message.includes("no such table: contact_messages")) {
      return "ただいまお問い合わせの保存処理を利用できません。時間をおいてからもう一度お試しください。";
    }
    if (message.includes("name, reply_email, and message are required")) {
      return "お名前、返信先メールアドレス、お問い合わせ内容を入力してください。";
    }
    if (message.includes("reply_email is invalid")) {
      return "返信先メールアドレスの形式を確認してください。";
    }
    if (message.includes("message length must be between 10 and 4000 characters")) {
      return "お問い合わせ内容は 10 文字以上で入力してください。";
    }
    if (message.includes("Failed to fetch")) {
      return "送信先に接続できませんでした。通信環境を確認してから、もう一度お試しください。";
    }

    return "送信に失敗しました。時間をおいてからもう一度お試しください。";
  }

  async function submitContactForm(event: Event): Promise<void> {
    event.preventDefault();
    if (!form || !submitButton) {
      return;
    }

    const formData = new FormData(form);
    const name = String(formData.get("name") || "").trim();
    const replyEmail = String(formData.get("reply_email") || "").trim();
    const message = String(formData.get("message") || "").trim();

    if (!name || !replyEmail || !message) {
      setStatus("お名前、返信先メールアドレス、お問い合わせ内容を入力してください。", true);
      return;
    }

    submitButton.disabled = true;
    setStatus("送信しています。");

    try {
      const response = await fetch(buildApiUrl("/api/public/contact"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          reply_email: replyEmail,
          message,
          source_page: `${window.location.pathname}${window.location.search}`,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `request failed: ${response.status}`);
      }

      form.reset();
      setStatus("送信を受け付けました。内容を確認のうえ、必要に応じて返信します。");
    } catch (error) {
      console.warn("contact submit failed", error);
      setStatus(formatContactError(error), true);
    } finally {
      submitButton.disabled = false;
    }
  }

  form?.addEventListener("submit", (event) => {
    void submitContactForm(event);
  });

  renderSupportEmailNote();
})();
