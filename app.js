(() => {
  const navToggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
      document.body.classList.toggle("menu-open", !open);
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navToggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
        document.body.classList.remove("menu-open");
      });
    });
  }

  document.querySelectorAll("[data-year]").forEach((node) => {
    node.textContent = new Date().getFullYear();
  });

  const editionField = document.querySelector("#edition");
  document.querySelectorAll("[data-edition]").forEach((link) => {
    link.addEventListener("click", () => {
      if (editionField && link.dataset.edition) editionField.value = link.dataset.edition;
    });
  });

  const form = document.querySelector("#application-form");
  const submitButton = document.querySelector("#submit-button");
  const status = document.querySelector("#form-status");

  function readUtm() {
    const params = new URLSearchParams(window.location.search);
    return {
      source: params.get("utm_source") || "",
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      content: params.get("utm_content") || ""
    };
  }

  function preferredLanguage() {
    const language = (navigator.language || "en").slice(0, 2).toLowerCase();
    return ["en", "fr", "es"].includes(language) ? language : "en";
  }

  function setStatus(message, type = "") {
    if (!status) return;
    status.textContent = message;
    status.className = "form-status" + (type ? " " + type : "");
  }

  if (!form || !submitButton) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const values = new FormData(form);
    const payload = {
      edition: values.get("edition"),
      firstName: values.get("firstName"),
      email: values.get("email"),
      profile: values.get("profile"),
      area: values.get("area"),
      message: values.get("message"),
      website: values.get("website"),
      consent: values.get("consent") === "on",
      medicalNotice: values.get("medicalNotice") === "on",
      language: preferredLanguage(),
      utm: readUtm()
    };

    submitButton.disabled = true;
    submitButton.innerHTML = "Sending confirmation…";
    setStatus("Sending your confirmation email…");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || result.status !== "pending_confirmation") {
        throw new Error(result.message || "We could not send your request. Please try again.");
      }

      window.location.assign("thank-you.html");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "We could not send your request. Please try again.");
      submitButton.disabled = false;
      submitButton.innerHTML = "Request an invitation <span>↗</span>";
    }
  });
})();