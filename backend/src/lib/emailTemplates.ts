/**
 * The three emails TrackFarm sends, each with its own coloured label, subject
 * and heading so a farmer can tell at a glance which one they're looking at:
 *
 *   - Welcome            (green)  sent once, on signup
 *   - Vaccination reminder (blue) a vaccine is due today or in the next days
 *   - Logging reminder   (amber)  nothing recorded for a couple of days
 *
 * Every email goes out as HTML plus a plain-text copy, so it reads properly
 * in any mail app. Names typed by the farmer (batches, vaccines) are escaped
 * before going into the HTML.
 */

const APP_URL = process.env.APP_URL || "https://trackfarm.cc";
const BRAND = "#174b35";

export interface Email {
  subject: string;
  html: string;
  text: string;
}

interface Detail {
  label: string;
  value: string;
}

interface Layout {
  tag: string;
  tagColor: string;
  tagBackground: string;
  heading: string;
  paragraphs: string[];
  details?: Detail[];
  buttonLabel: string;
  buttonPath: string;
  footer: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "2026-11-20" -> "Fri 20 Nov". Dates are stored as plain calendar days. */
export function friendlyDate(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function render(layout: Layout): { html: string; text: string } {
  const url = `${APP_URL}${layout.buttonPath}`;

  const paragraphsHtml = layout.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#44403c;">${escapeHtml(p)}</p>`)
    .join("");

  const detailsHtml = layout.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border:1px solid #e7e5e4;border-radius:12px;border-collapse:separate;">
        ${layout.details
          .map(
            (d, i) => `<tr>
              <td style="padding:12px 16px;font-size:13px;color:#78716c;${i ? "border-top:1px solid #f0efed;" : ""}">${escapeHtml(d.label)}</td>
              <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1c1917;text-align:right;${i ? "border-top:1px solid #f0efed;" : ""}">${escapeHtml(d.value)}</td>
            </tr>`
          )
          .join("")}
      </table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #f0efed;">
          <span style="font-size:18px;font-weight:800;color:${BRAND};letter-spacing:-0.2px;">TrackFarm</span>
        </td></tr>
        <tr><td style="padding:26px 28px 8px;">
          <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${layout.tagBackground};color:${layout.tagColor};font-size:12px;font-weight:700;">${escapeHtml(layout.tag)}</span>
          <h1 style="margin:14px 0 14px;font-size:21px;line-height:1.3;color:#1c1917;">${escapeHtml(layout.heading)}</h1>
          ${paragraphsHtml}
          ${detailsHtml}
          <a href="${url}" style="display:inline-block;margin:4px 0 22px;padding:13px 22px;border-radius:10px;background:${BRAND};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(layout.buttonLabel)}</a>
        </td></tr>
        <tr><td style="padding:16px 28px 22px;border-top:1px solid #f0efed;font-size:12px;line-height:1.5;color:#a8a29e;">
          ${escapeHtml(layout.footer)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `TrackFarm | ${layout.tag}`,
    "",
    layout.heading,
    "",
    ...layout.paragraphs.flatMap((p) => [p, ""]),
    ...(layout.details?.length ? [...layout.details.map((d) => `${d.label}: ${d.value}`), ""] : []),
    `${layout.buttonLabel}: ${url}`,
    "",
    layout.footer,
  ].join("\n");

  return { html, text };
}

const SETTINGS_FOOTER =
  "You can turn these emails on or off any time in TrackFarm under Settings, then Notifications.";

// ---- 1. Welcome ------------------------------------------------------------

export function welcomeEmail(): Email {
  return {
    subject: "Welcome to TrackFarm",
    ...render({
      tag: "Welcome",
      tagColor: "#14532d",
      tagBackground: "#dcfce7",
      heading: "Your TrackFarm account is ready",
      paragraphs: [
        "You can now keep your farm records on your phone instead of a notebook.",
        "Start by adding your first batch. Then record feed, deaths, eggs and vaccinations as they happen.",
      ],
      buttonLabel: "Open TrackFarm",
      buttonPath: "/dashboard",
      footer: "You're getting this email because you just created a TrackFarm account.",
    }),
  };
}

// ---- 2. Vaccination reminder -------------------------------------------------

export interface DueVaccine {
  vaccineName: string;
  batchName: string;
  dueDate: string; // YYYY-MM-DD
}

/** One email per farm, listing every vaccine due in the reminder window. */
export function vaccinationReminderEmail(due: DueVaccine[], today: string): Email {
  const sorted = [...due].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const dueToday = sorted.filter((v) => v.dueDate === today).length;
  const when = (v: DueVaccine) => (v.dueDate === today ? "Due today" : `Due ${friendlyDate(v.dueDate)}`);

  let subject: string;
  let heading: string;
  if (sorted.length === 1) {
    const v = sorted[0];
    subject =
      v.dueDate === today
        ? `Vaccine due today: ${v.vaccineName} for ${v.batchName}`
        : `Vaccine due ${friendlyDate(v.dueDate)}: ${v.vaccineName} for ${v.batchName}`;
    heading = v.dueDate === today ? `${v.vaccineName} is due today` : `${v.vaccineName} is due soon`;
  } else {
    subject = dueToday
      ? `${sorted.length} vaccines due soon (${dueToday} due today)`
      : `${sorted.length} vaccines due in the next few days`;
    heading = `${sorted.length} vaccines are coming up`;
  }

  return {
    subject,
    ...render({
      tag: "Vaccination reminder",
      tagColor: "#1e3a8a",
      tagBackground: "#dbeafe",
      heading,
      paragraphs: [
        sorted.length === 1
          ? dueToday
            ? "Give it today to keep your birds protected. Once done, mark it as given in TrackFarm."
            : "Here's a heads-up so you can get the vaccine ready. Once given, mark it as done in TrackFarm."
          : dueToday
            ? "Give each one on its day to keep your birds protected. Once done, mark them as given in TrackFarm."
            : "Here's a heads-up so you can get the vaccines ready. Once given, mark them as done in TrackFarm.",
      ],
      details: sorted.map((v) => ({ label: `${v.vaccineName} · ${v.batchName}`, value: when(v) })),
      buttonLabel: "See vaccination schedule",
      buttonPath: "/dashboard",
      footer: SETTINGS_FOOTER,
    }),
  };
}

// ---- 3. Logging reminder ------------------------------------------------------

/**
 * @param lastLogDate the newest record across the farm's active batches, or
 *   null if nothing has been recorded yet
 * @param batchNames the farm's active batches
 */
export function loggingReminderEmail(lastLogDate: string | null, batchNames: string[]): Email {
  const subject = lastLogDate
    ? `Logging reminder: nothing recorded since ${friendlyDate(lastLogDate)}`
    : "Logging reminder: start recording your batch";
  const heading = lastLogDate
    ? `Nothing recorded since ${friendlyDate(lastLogDate)}`
    : "Your batch has no records yet";

  return {
    subject,
    ...render({
      tag: "Logging reminder",
      tagColor: "#78350f",
      tagBackground: "#fef3c7",
      heading,
      paragraphs: [
        "Missing days make your totals and profit wrong. A quick update of feed, deaths or eggs keeps your numbers right.",
        "If you already recorded today, you can ignore this email.",
      ],
      details: batchNames.length
        ? [{ label: batchNames.length === 1 ? "Active batch" : "Active batches", value: batchNames.join(", ") }]
        : undefined,
      buttonLabel: "Record today's numbers",
      buttonPath: "/batches",
      footer: SETTINGS_FOOTER,
    }),
  };
}

/** The SES message body for any of the emails above. */
export function sesMessage(email: Email) {
  return {
    Subject: { Data: email.subject, Charset: "UTF-8" },
    Body: {
      Html: { Data: email.html, Charset: "UTF-8" },
      Text: { Data: email.text, Charset: "UTF-8" },
    },
  };
}
