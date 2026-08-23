// Netlify Function: emails a person's Scaling Pressure Check results to them,
// via Resend. Called (fire-and-forget) from the quiz's front end right after
// they submit their email, alongside the Netlify Forms lead-capture POST.
//
// Requires an environment variable RESEND_API_KEY (set in Netlify's Project
// configuration -> Environment variables). Optionally FROM_EMAIL once a
// sending domain is verified in Resend, e.g.
//   FROM_EMAIL="Ma'at Partners <results@updates.maatpartners.co.uk>"
// Until a domain is verified, Resend only accepts sending from its shared
// test address, so this falls back to that if FROM_EMAIL isn't set.

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let data;
  try {
    data = await req.json();
  } catch (e) {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = data && data.email;
  const sizeLabel = data && data.sizeLabel;
  const results = data && data.results;
  const focusAreas = (data && data.focusAreas) || [];

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ error: "Missing or invalid email" }, 400);
  }
  if (!Array.isArray(results) || results.length === 0) {
    return json({ error: "Missing results" }, 400);
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.error("send-results: RESEND_API_KEY is not set");
    return json({ error: "Email sending isn't configured yet (missing RESEND_API_KEY)" }, 500);
  }
  const FROM_EMAIL = process.env.FROM_EMAIL || "Ma'at Partners <onboarding@resend.dev>";
  console.log("send-results: attempting send", { to: email, from: FROM_EMAIL });

  const html = buildEmailHtml({ sizeLabel: sizeLabel, results: results, focusAreas: focusAreas });

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: "Your Scaling Pressure Check results",
        html: html
      })
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      console.error("send-results: Resend rejected the request", resendRes.status, detail);
      return json({ error: "Resend rejected the request", detail: detail }, 502);
    }

    console.log("send-results: sent ok");
    return json({ ok: true }, 200);
  } catch (err) {
    console.error("send-results: send failed", String(err));
    return json({ error: "Send failed", detail: String(err) }, 500);
  }
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: { "Content-Type": "application/json" }
  });
}

function esc(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function buildEmailHtml(opts) {
  const sizeLabel = opts.sizeLabel;
  const results = opts.results;
  const focusAreas = opts.focusAreas;

  const OBSIDIAN = "#31374f";
  const RED_OXIDE = "#863A3A";
  const STONE = "#F2ECDF";
  const SAND = "#E2D9BC";
  const MIST = "#ACBAC4";

  const barsHtml = results
    .map(function (r) {
      const pct = Math.max(4, Math.min(100, r.score));
      return (
        '<tr><td style="padding: 10px 0;">' +
        '<div style="font-family: Manrope, Arial, sans-serif; font-size: 14px; color: ' +
        OBSIDIAN +
        '; font-weight: 700; margin-bottom: 4px;">' +
        esc(r.emoji) +
        " " +
        esc(r.label) +
        '<span style="float:right; font-weight: 500; color: #6b7280;">' +
        esc(r.status) +
        "</span></div>" +
        '<div style="background: ' +
        STONE +
        '; border-radius: 6px; height: 10px; overflow: hidden;">' +
        '<div style="background: ' +
        RED_OXIDE +
        "; width: " +
        pct +
        '%; height: 10px;"></div>' +
        "</div></td></tr>"
      );
    })
    .join("");

  const focusHtml =
    focusAreas && focusAreas.length
      ? focusAreas
          .map(function (f, i) {
            return (
              '<tr><td style="padding: 14px 0; border-top: 1px solid ' +
              MIST +
              ';">' +
              '<div style="font-family: Manrope, Arial, sans-serif; font-weight: 700; color: ' +
              OBSIDIAN +
              '; font-size: 15px;">' +
              (i + 1) +
              ". " +
              esc(f.label) +
              " — " +
              esc(f.score) +
              "/100</div>" +
              '<div style="font-family: Georgia, \'Times New Roman\', serif; font-style: italic; color: #52514e; font-size: 14px; margin-top: 6px; border-left: 3px solid ' +
              RED_OXIDE +
              '; padding-left: 10px;">"' +
              esc(f.topQuestion) +
              '"</div></td></tr>'
            );
          })
          .join("")
      : '<tr><td style="padding: 14px 0; border-top: 1px solid ' +
        MIST +
        '; font-family: Manrope, Arial, sans-serif; color: ' +
        OBSIDIAN +
        ';">Nothing flashing red right now — worth a check-in again as you grow.</td></tr>';

  return (
    '<div style="background: #F9F9F7; padding: 32px 16px; font-family: Inter, Arial, sans-serif;">' +
    '<table role="presentation" width="100%" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid ' +
    MIST +
    ';">' +
    '<tr><td style="background: ' +
    OBSIDIAN +
    '; padding: 24px 28px;">' +
    '<div style="font-family: Manrope, Arial, sans-serif; color: #ffffff; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.8;">Ma\'at Partners</div>' +
    '<div style="font-family: Manrope, Arial, sans-serif; color: #ffffff; font-size: 22px; font-weight: 700; margin-top: 6px;">Your Scaling Pressure Check results</div>' +
    "</td></tr>" +
    '<tr><td style="padding: 24px 28px 4px;">' +
    '<div style="font-family: Manrope, Arial, sans-serif; color: #6b7280; font-size: 13px;">Sized for a ' +
    esc(sizeLabel) +
    " business.</div></td></tr>" +
    '<tr><td style="padding: 8px 28px 0;"><table role="presentation" width="100%">' +
    barsHtml +
    "</table></td></tr>" +
    '<tr><td style="padding: 8px 28px 4px;">' +
    '<div style="font-family: Manrope, Arial, sans-serif; font-weight: 700; color: ' +
    OBSIDIAN +
    '; font-size: 16px; margin-top: 10px;">Where to focus first</div>' +
    '<table role="presentation" width="100%">' +
    focusHtml +
    "</table></td></tr>" +
    '<tr><td style="padding: 20px 28px 28px;">' +
    '<div style="font-family: Manrope, Arial, sans-serif; font-weight: 700; color: ' +
    OBSIDIAN +
    '; font-size: 16px; margin-bottom: 10px;">Want to talk through your results?</div>' +
    '<a href="https://www.maatpartners.co.uk/contact" style="display: inline-block; background: ' +
    RED_OXIDE +
    '; color: #ffffff; text-decoration: none; font-family: Manrope, Arial, sans-serif; font-weight: 700; font-size: 14px; padding: 12px 22px; border-radius: 8px;">Get in touch →</a>' +
    "</td></tr>" +
    '<tr><td style="padding: 16px 28px; background: ' +
    SAND +
    '; font-family: Inter, Arial, sans-serif; font-size: 12px; color: #52514e;">' +
    "Ma'at Partners — sent because you completed the Scaling Pressure Check." +
    "</td></tr>" +
    "</table></div>"
  );
}
