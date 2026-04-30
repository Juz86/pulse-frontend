const RESEND_API_URL = 'https://api.resend.com/emails';

function getEmailConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  const replyTo = String(process.env.RESEND_REPLY_TO || '').trim();
  const enabled = apiKey.length > 0 && from.length > 0;

  return {
    apiKey,
    from,
    replyTo: replyTo || null,
    enabled,
  };
}

function buildVerificationEmail({ code, email }) {
  const subject = 'Je Pulse verificatiecode';
  const text = [
    'Je verificatiecode voor Pulse is:',
    code,
    '',
    'Deze code is 15 minuten geldig.',
    '',
    `Aangevraagd voor: ${email}`,
    '',
    'Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Je Pulse verificatiecode</h2>
      <p style="margin:0 0 12px">Gebruik deze code om je registratie te bevestigen:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:0 0 12px">${code}</p>
      <p style="margin:0 0 6px">Deze code is <strong>15 minuten</strong> geldig.</p>
      <p style="margin:0 0 6px;color:#555">Aangevraagd voor: ${email}</p>
      <p style="margin:12px 0 0;color:#555">Niet aangevraagd? Dan kun je deze e-mail negeren.</p>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function sendVerificationCodeEmail({ email, code, requestId = null }) {
  const config = getEmailConfig();
  if (!config.enabled) {
    return {
      ok: false,
      skipped: true,
      error: 'email_not_configured',
    };
  }

  const content = buildVerificationEmail({ code, email });
  const payload = {
    from: config.from,
    to: [email],
    subject: content.subject,
    text: content.text,
    html: content.html,
    tags: [
      { name: 'service', value: 'pulse-auth' },
      { name: 'type', value: 'verification-code' },
    ],
  };

  if (config.replyTo) {
    payload.reply_to = config.replyTo;
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: 'email_provider_error',
      providerBody: bodyText.slice(0, 800),
    };
  }

  console.info('[Pulse auth] Verificatie e-mail verzonden', {
    requestId,
    email,
  });

  return {
    ok: true,
    providerResponse: bodyText.slice(0, 800),
  };
}
