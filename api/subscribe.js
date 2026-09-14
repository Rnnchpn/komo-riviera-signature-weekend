const BREVO_DOI_URL = "https://api.brevo.com/v3/contacts/doubleOptinConfirmation";
const BREVO_EMAIL_URL = "https://api.brevo.com/v3/smtp/email";

function cleanText(value, maximumLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximumLength);
}

function cleanEmail(value) {
  return cleanText(value, 254).toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requestOrigin(req) {
  const forwarded = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers.host || "").trim();
  return host ? forwarded + "://" + host : "";
}

function allowedOrigins(req) {
  const configured = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter(Boolean);

  const runtime = [process.env.SITE_URL, requestOrigin(req), "http://localhost:3000"]
    .filter(Boolean)
    .map((item) => String(item).trim().replace(/\/$/, ""));

  return Array.from(new Set(configured.concat(runtime)));
}

function safeOrigin(req) {
  const origin = String(req.headers.origin || "").trim().replace(/\/$/, "");
  if (!origin) return "";
  return allowedOrigins(req).includes(origin) ? origin : null;
}

function writeJson(res, body, status, origin) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Vary", "Origin");
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  return res.status(status).json(body);
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
      accept: "application/json",
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

function parsedBody(body) {
  if (typeof body !== "string") return body && typeof body === "object" ? body : {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function publicSiteUrl(req) {
  const configured = String(process.env.SITE_URL || "").trim().replace(/\/$/, "");
  return configured || requestOrigin(req) || "https://experience.komolongevity.com";
}

export default async function handler(req, res) {
  const origin = safeOrigin(req);
  if (origin === null) return writeJson(res, { message: "Origin not allowed." }, 403, "");

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.setHeader("Vary", "Origin");
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    return res.status(204).end();
  }

  if (req.method !== "POST") return writeJson(res, { message: "Method not allowed." }, 405, origin);

  const payload = parsedBody(req.body);
  if (!payload) return writeJson(res, { message: "Invalid request." }, 400, origin);
  if (cleanText(payload.website, 200)) return writeJson(res, { status: "pending_confirmation" }, 202, origin);

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
    return writeJson(res, { message: "Please complete the required fields." }, 422, origin);
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID);
  const templateId = Number(process.env.BREVO_DOI_TEMPLATE_ID);

  if (!apiKey || !Number.isInteger(listId) || !Number.isInteger(templateId)) {
    return writeJson(res, { message: "The invitation service is not configured yet. Please contact contact@komolongevity.com." }, 503, origin);
  }

  const doubleOptInPayload = {
    email,
    includeListIds: [listId],
    redirectionUrl: new URL("/thank-you.html", publicSiteUrl(req)).toString(),
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
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify(doubleOptInPayload)
    });

    if (!brevoResponse.ok) {
      let errorBody = {};
      try {
        errorBody = await brevoResponse.json();
      } catch {}
      const errorMessage = String(errorBody.message || "").toLowerCase();
      if (!(brevoResponse.status === 400 && (errorMessage.includes("already exist") || errorMessage.includes("already exists")))) {
        return writeJson(res, { message: "Unable to submit this request. Please try again or contact us directly." }, 502, origin);
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

    return writeJson(res, { status: "pending_confirmation" }, 200, origin);
  } catch {
    return writeJson(res, { message: "Unable to reach the invitation service. Please try again or contact us directly." }, 502, origin);
  }
}
