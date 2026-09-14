const BREVO_DOI_URL = "https://api.brevo.com/v3/contacts/doubleOptinConfirmation";
const BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

function json(body, status, origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin"
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function cleanText(value, maximumLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

function cleanEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function allowedOrigins() {
  const configured = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const netlify = [process.env.SITE_URL, process.env.URL, process.env.DEPLOY_PRIME_URL, "http://localhost:8888"]
    .filter(Boolean)
    .map((item) => String(item).trim().replace(/\/$/, ""));

  return Array.from(new Set(configured.concat(netlify)));
}

function safeOrigin(request) {
  const origin = String(request.headers.get("origin") || "").trim().replace(/\/$/, "");
  if (!origin) return "";
  return allowedOrigins().includes(origin) ? origin : null;
}

function siteUrl() {
  const candidate = process.env.SITE_URL || process.env.URL;
  try {
    return new URL(candidate).origin;
  } catch {
    return "https://komo-riviera-signature-weekend.netlify.app";
  }
}

function selected(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function contactAttributes(payload) {
  const utm = payload.utm && typeof payload.utm === "object" ? payload.utm : {};

  return {
    FIRSTNAME: cleanText(payload.firstName, 80),
    LANGUAGE: selected(cleanText(payload.language, 5), ["en", "fr", "es"], "en"),
    PROFILE: selected(cleanText(payload.profile, 40), ["guest", "guest_pair", "private_group", "partner"], "guest"),
    AREA: cleanText(payload.area, 100),
    SOURCE: "komo-riviera-signature-weekend",
    EVENT_KEY: cleanText(process.env.EVENT_KEY || "KOMO_RIVIERA_SIGNATURE_WEEKEND_2026", 100),
    EVENT_STATUS: "requested_" + selected(cleanText(payload.edition, 40), ["weekend", "signature_stay", "private_edition", "undecided"], "undecided"),
    CONSENT_AT: new Date().toISOString(),
    UTM_SOURCE: cleanText(utm.source, 200),
    UTM_MEDIUM: cleanText(utm.medium, 200),
    UTM_CAMPAIGN: cleanText(utm.campaign, 200),
    UTM_CONTENT: cleanText(utm.content, 200)
  };
}

async function notifyTeam(apiKey, payload) {
  const teamEmail = cleanEmail(process.env.TEAM_EMAIL);
  const senderEmail = cleanEmail(process.env.BREVO_SENDER_EMAIL);
  if (!teamEmail || !senderEmail) return;

  const edition = selected(cleanText(payload.edition, 40), ["weekend", "signature_stay", "private_edition", "undecided"], "undecided");
  const profile = selected(cleanText(payload.profile, 40), ["guest", "guest_pair", "private_group", "partner"], "guest");
  const note = cleanText(payload.message, 800);
  const content = [
    "<h2>New KŌMØ Riviera Signature Weekend request</h2>",
    "<p><strong>Name:</strong> " + escapeHtml(cleanText(payload.firstName, 80)) + "</p>",
    "<p><strong>Email:</strong> " + escapeHtml(cleanEmail(payload.email)) + "</p>",
    "<p><strong>Edition:</strong> " + escapeHtml(edition) + "</p>",
    "<p><strong>Profile:</strong> " + escapeHtml(profile) + "</p>",
    "<p><strong>Location:</strong> " + escapeHtml(cleanText(payload.area, 100)) + "</p>",
    note ? "<p><strong>Note:</strong> " + escapeHtml(note) + "</p>" : ""
  ].join("");

  await fetch(BREVO_EMAIL_URL, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: process.env.BREVO_SENDER_NAME || "KŌMØ Riviera" },
      to: [{ email: teamEmail }],
      replyTo: { email: cleanEmail(payload.email), name: cleanText(payload.firstName, 80) },
      subject: "New KŌMØ Riviera request — " + edition,
      htmlContent: content
    })
  });
}

export default async function subscribe(request) {
  const origin = safeOrigin(request);
  if (origin === null) return json({ message: "Origin not allowed." }, 403, "");

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
        ...(origin ? { "Access-Control-Allow-Origin": origin } : {})
      }
    });
  }

  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405, origin);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ message: "Invalid request." }, 400, origin);
  }

  if (cleanText(payload.website, 200)) return json({ status: "pending_confirmation" }, 202, origin);

  const email = cleanEmail(payload.email);
  const firstName = cleanText(payload.firstName, 80);
  const area = cleanText(payload.area, 100);
  const profile = cleanText(payload.profile, 40);
  const edition = cleanText(payload.edition, 40);
  const language = cleanText(payload.language, 5);

  if (
    !validEmail(email) ||
    !firstName ||
    !area ||
    !["guest", "guest_pair", "private_group", "partner"].includes(profile) ||
    !["weekend", "signature_stay", "private_edition", "undecided"].includes(edition) ||
    !["en", "fr", "es"].includes(language) ||
    payload.consent !== true ||
    payload.medicalNotice !== true
  ) {
    return json({ message: "Please complete the required fields." }, 422, origin);
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID);
  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID);

  if (!apiKey || !Number.isInteger(listId) || !Number.isInteger(templateId)) {
    return json({ message: "The invitation service is not configured yet. Please contact contact@komolongevity.com." }, 503, origin);
  }

  const doubleOptInPayload = {
    email,
    includeListIds: [listId],
    redirectionUrl: new URL("/thank-you.html", siteUrl()).toString(),
    templateId,
    attributes: contactAttributes({
      ...payload,
      email,
      firstName,
      area,
      profile,
      edition,
      language
    })
  };

  try {
    const brevoResponse = await fetch(BREVO_DOI_URL, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify(doubleOptInPayload)
    });

    if (!brevoResponse.ok) {
      let errorBody = {};
      try { errorBody = await brevoResponse.json(); } catch { errorBody = {}; }

      const errorMessage = String(errorBody.message || "").toLowerCase();
      if (!(brevoResponse.status === 400 && (errorMessage.includes("already exist") || errorMessage.includes("already exists")))) {
        return json({ message: "Unable to submit this request. Please try again or contact us directly." }, 502, origin);
      }
    }

    notifyTeam(apiKey, {
      ...payload,
      email,
      firstName,
      area,
      profile,
      edition,
      language
    }).catch(() => {});

    return json({ status: "pending_confirmation" }, 200, origin);
  } catch {
    return json({ message: "Unable to reach the invitation service. Please try again or contact us directly." }, 502, origin);
  }
}