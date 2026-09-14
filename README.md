# KŌMØ Riviera — Signature Weekend

Standalone invitation site for the KŌMØ Riviera Signature Weekend in Cannes.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Rnnchpn/komo-riviera-signature-weekend&fullConfiguration=true)

It is intentionally independent from the main KŌMØ website, while linking back to the wider KŌMØ ecosystem and KŌMØ Pulse.

## What is included

- premium responsive landing page;
- Cannes weekend programme, editions and pricing;
- accessible request-for-invitation form;
- secure Netlify Function with Brevo double opt-in;
- optional internal notification email for each request;
- confirmation, privacy and legal pages;
- custom SVG editorial illustrations — no stock-photo dependency;
- security headers and static SEO files.

The invitation form does **not** take payment and does not collect medical data. It is designed to start a qualified, personal booking conversation.

## Deploy on Netlify

1. In Netlify choose **Add new site → Import an existing project**.
2. Authorise GitHub and select \`Rnnchpn/komo-riviera-signature-weekend\`.
3. Keep the detected configuration:
   - Build command: none
   - Publish directory: \`. \`
   - Functions directory: \`netlify/functions\`
4. Use \`komo-riviera-signature-weekend\` as the Netlify site name if available. This will create the public URL:
   \`https://komo-riviera-signature-weekend.netlify.app\`
5. Deploy the site.
6. In **Site configuration → Environment variables**, add the variables below.
7. Trigger a new deployment after adding variables.

## Required environment variables

| Variable | Value |
|---|---|
| \`BREVO_API_KEY\` | Brevo v3 API key with contacts and transactional-email permission |
| \`BREVO_LIST_ID\` | Numeric Brevo list ID for Riviera Signature Weekend invitations |
| \`BREVO_DOI_TEMPLATE_ID\` | Numeric Brevo double-opt-in email template ID |
| \`SITE_URL\` | Final public site origin, e.g. \`https://komo-riviera-signature-weekend.netlify.app\` |
| \`ALLOWED_ORIGINS\` | Final public site origin, plus any preview URLs you explicitly want to test |

Optional internal-notification variables:

| Variable | Value |
|---|---|
| \`TEAM_EMAIL\` | Inbox to receive a short alert for each request |
| \`BREVO_SENDER_EMAIL\` | Verified Brevo sender address, e.g. \`contact@komolongevity.com\` |
| \`BREVO_SENDER_NAME\` | Optional sender name; default is \`KŌMØ Riviera\` |
| \`EVENT_KEY\` | Optional campaign key; default is \`KOMO_RIVIERA_SIGNATURE_WEEKEND_2026\` |

Never add secrets to the repository.

## Brevo configuration

Create the invitation list and these contact attributes before testing the form:

\`FIRSTNAME\`, \`LANGUAGE\`, \`PROFILE\`, \`AREA\`, \`SOURCE\`, \`EVENT_KEY\`, \`EVENT_STATUS\`, \`CONSENT_AT\`, \`UTM_SOURCE\`, \`UTM_MEDIUM\`, \`UTM_CAMPAIGN\`, \`UTM_CONTENT\`.

Create a double-opt-in template in Brevo:

- use a verified sender;
- include a clear consent/confirmation message;
- set the action button to \`{{ params.DOIurl }}\`;
- do not promise a confirmed booking in this email.

The form sends the guest to \`thank-you.html\` after confirmation.

## Test before launch

1. Submit a request with a real test email.
2. Check the confirmation message arrives and its button works.
3. Check the contact appears in the selected Brevo list with the expected attributes.
4. If \`TEAM_EMAIL\` is configured, check the team receives a request notification.
5. Test mobile navigation and every legal link.
6. Confirm the completed legal business details below.

## Required legal completion before public paid bookings

The page correctly keeps the hospitality and non-medical boundary. However the operator must complete \`legal.html\` before public paid bookings open with:

- final operating entity name;
- registered address;
- company registration number and VAT number, where applicable;
- publication director;
- final cancellation / withdrawal terms and insurance wording;
- final contractual partner and invoice information.

Have a qualified French legal adviser review the final commercial terms before launch.

## Custom domain

After Netlify deployment, add the selected domain in **Domain management**. If using a KŌMØ subdomain, a suitable option is:

\`weekend.komolongevity.com\`

Update \`SITE_URL\`, \`ALLOWED_ORIGINS\` and \`sitemap.xml\` after the domain is live.
