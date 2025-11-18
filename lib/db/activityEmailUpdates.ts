import prisma from "../prisma";
import { escapeHtml, sendEmail, stripMarkdown } from "./emailHelpers";

// ---------------------------------------------------------------------------
// Activity logging
// ---------------------------------------------------------------------------

export type ActivityEvent =
  | {
      type: "comment";
      commentId: string;
      snippet: string;
      userId: number;
      username: string | null;
      createdAt: string;
    }
  | {
      type: "rating";
      rating: number;
      userId: number;
      username?: string | null;
      createdAt: string;
    };

type DailyRow = {
  id: number;
  recipe_id: number;
  summary_date: Date;
  emailed: boolean;
  changes: { events: ActivityEvent[] } | null;
  recipe: {
    id: number;
    name: string;
    activityEmailsEnabled: boolean;
    users: {
      id: number;
      email: string;
      public_username: string | null;
    } | null;
  };
};

type LogRecipeActivityArgs = {
  recipeId: number;
  event: ActivityEvent;
};

export async function logRecipeActivity({
  recipeId,
  event
}: LogRecipeActivityArgs) {
  // 1) Opt-in gate: only log if this recipe has activity emails enabled
  const recipe = await prisma.recipes.findUnique({
    where: { id: recipeId },
    select: { activityEmailsEnabled: true }
  });

  // No recipe or user has not opted in → do nothing
  if (!recipe || !recipe.activityEmailsEnabled) {
    return;
  }

  // 2) Normalize to a “date only” in UTC to align with @db.Date
  const now = new Date();
  const summaryDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  // 3) Find existing row for this recipe + today
  const existing = await prisma.recipe_daily_activity.findUnique({
    where: {
      recipe_id_summary_date: {
        recipe_id: recipeId,
        summary_date: summaryDate
      }
    }
  });

  const existingChanges = (existing?.changes as any) || { events: [] };

  const updatedChanges = {
    ...existingChanges,
    events: [...(existingChanges.events || []), event]
  };

  // 4) Upsert-ish logic
  if (existing) {
    await prisma.recipe_daily_activity.update({
      where: { id: existing.id },
      data: { changes: updatedChanges }
    });
  } else {
    await prisma.recipe_daily_activity.create({
      data: {
        recipe_id: recipeId,
        summary_date: summaryDate,
        changes: updatedChanges
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Daily summary email builder
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Daily summary email builder
// ---------------------------------------------------------------------------

export type DailySummaryEmailArgs = {
  ownerDisplayName: string;
  recipeName: string;
  recipeUrl: string;
  summaryDate: Date; // logical “day” you’re summarizing
  events: ActivityEvent[]; // from recipe_daily_activity.changes.events
};
export function buildDailyRecipeSummaryEmail({
  ownerDisplayName,
  recipeName,
  recipeUrl,
  summaryDate,
  events
}: DailySummaryEmailArgs) {
  const logoUrl = "https://meadtools.com/assets/full-logo.png";
  const brandGold = "#cb9f52";

  const safeRecipeName = escapeHtml(recipeName);
  const safeOwnerName = escapeHtml(ownerDisplayName);
  const safeUrl = escapeHtml(recipeUrl);

  const MAX_SNIPPET_LEN = 160;
  const MAX_EVENTS_PER_SECTION = 10;

  const comments = events.filter(
    (e): e is Extract<ActivityEvent, { type: "comment" }> =>
      e.type === "comment"
  );
  const ratings = events.filter(
    (e): e is Extract<ActivityEvent, { type: "rating" }> => e.type === "rating"
  );

  const totalEvents = events.length;
  const commentCount = comments.length;
  const ratingCount = ratings.length;

  // Only show first N of each in the body
  const shownComments = comments.slice(0, MAX_EVENTS_PER_SECTION);
  const hiddenCommentCount = commentCount - shownComments.length;

  const shownRatings = ratings.slice(0, MAX_EVENTS_PER_SECTION);
  const hiddenRatingCount = ratingCount - shownRatings.length;

  // Nice human date instead of YYYY-MM-DD
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
  const dateLabel = dateFormatter.format(summaryDate);

  // ---- Subject detail (counts) ----
  let subjectDetail: string;
  if (!totalEvents) {
    subjectDetail = "no new activity";
  } else if (commentCount && ratingCount) {
    subjectDetail = `${commentCount} new comment${commentCount === 1 ? "" : "s"} and ${ratingCount} new rating${ratingCount === 1 ? "" : "s"}`;
  } else if (commentCount) {
    subjectDetail = `${commentCount} new comment${commentCount === 1 ? "" : "s"}`;
  } else {
    subjectDetail = `${ratingCount} new rating${ratingCount === 1 ? "" : "s"}`;
  }

  // Subject: include date + summary
  const subject = `Daily activity for "${recipeName}" – ${dateLabel}`;

  // ---- Text version ----
  const textLines: string[] = [
    `Hello ${ownerDisplayName},`,
    "",
    `Here’s your daily activity summary for "${recipeName}" on ${dateLabel}.`
  ];

  if (commentCount) {
    textLines.push("", "New comments:");
    shownComments.forEach((c) => {
      const raw = stripMarkdown(c.snippet || "").trim();
      const snippet =
        raw.length > MAX_SNIPPET_LEN
          ? raw.slice(0, MAX_SNIPPET_LEN).trimEnd() + "…"
          : raw;

      const label = c.username?.trim() || "A MeadTools user";
      textLines.push(`- ${label}: "${snippet}"`);
    });

    if (hiddenCommentCount > 0) {
      textLines.push(
        `- …and ${hiddenCommentCount} more comment${
          hiddenCommentCount === 1 ? "" : "s"
        }.`
      );
    }
  }

  if (ratingCount) {
    textLines.push("", "New ratings:");
    shownRatings.forEach((r) => {
      const label = r.username?.trim() || "A MeadTools user";
      textLines.push(`- ${label} rated this recipe ${r.rating}/5`);
    });

    if (hiddenRatingCount > 0) {
      textLines.push(
        `- …and ${hiddenRatingCount} more rating${
          hiddenRatingCount === 1 ? "" : "s"
        }.`
      );
    }
  }

  if (!totalEvents) {
    textLines.push("", "No new comments or ratings today.");
  }

  textLines.push(
    "",
    `View this recipe: ${recipeUrl}`,
    "",
    "You’re receiving this email because daily activity emails are enabled for this recipe.",
    "– MeadTools"
  );

  const text = textLines.join("\n");

  // ---- HTML version ----

  const previewLine =
    totalEvents > 0
      ? `Your recipe had ${subjectDetail} on ${dateLabel}.`
      : `No new comments or ratings for ${safeRecipeName} on ${dateLabel}.`;

  const renderCommentList = () => {
    if (!commentCount) return "";

    const items = shownComments
      .map((c) => {
        const raw = stripMarkdown(c.snippet || "").trim();
        const snippet =
          raw.length > MAX_SNIPPET_LEN
            ? raw.slice(0, MAX_SNIPPET_LEN).trimEnd() + "…"
            : raw;

        const label = escapeHtml(c.username?.trim() || "A MeadTools user");
        const safeSnippet = escapeHtml(snippet);

        return `
          <li style="margin-bottom:8px;">
            <strong>${label}</strong><br>
            <span style="color:#374151;">"${safeSnippet}"</span>
          </li>
        `;
      })
      .join("");

    const moreLine =
      hiddenCommentCount > 0
        ? `<li style="margin-top:4px;color:#6b7280;">
             …and ${hiddenCommentCount} more comment${
               hiddenCommentCount === 1 ? "" : "s"
             }.
           </li>`
        : "";

    return `
      <tr>
        <td style="padding:0 22px 10px 22px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#111827;">
          <h3 style="margin:0 0 6px 0;font:600 15px/1.4 Arial,Helvetica,sans-serif;">New comments</h3>
          <ul style="margin:4px 0 0 18px;padding:0;list-style:disc;">
            ${items}
            ${moreLine}
          </ul>
        </td>
      </tr>
    `;
  };

  const renderRatingList = () => {
    if (!ratingCount) return "";

    const items = shownRatings
      .map((r) => {
        const label = escapeHtml(r.username?.trim() || "A MeadTools user");
        return `
          <li style="margin-bottom:4px;">
            <strong>${label}</strong> rated this recipe <strong>${r.rating}/5</strong>
          </li>
        `;
      })
      .join("");

    const moreLine =
      hiddenRatingCount > 0
        ? `<li style="margin-top:4px;color:#6b7280;">
             …and ${hiddenRatingCount} more rating${
               hiddenRatingCount === 1 ? "" : "s"
             }.
           </li>`
        : "";

    return `
      <tr>
        <td style="padding:8px 22px 14px 22px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#111827;">
          <h3 style="margin:0 0 6px 0;font:600 15px/1.4 Arial,Helvetica,sans-serif;">New ratings</h3>
          <ul style="margin:4px 0 0 18px;padding:0;list-style:disc;">
            ${items}
            ${moreLine}
          </ul>
        </td>
      </tr>
    `;
  };

  const html = `
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${escapeHtml(previewLine)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f7f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
          <!-- Header bar (no counts, no date) -->
          <tr>
            <td align="center" style="background:${brandGold};padding:20px 16px;">
              <div style="font:700 20px/1.3 Arial,Helvetica,sans-serif;color:#fff;">
                Daily activity for "${safeRecipeName}"
              </div>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:20px 22px 12px 22px;font:15px/1.5 Arial,Helvetica,sans-serif;color:#222;">
              <p style="margin:0 0 10px 0;">Hello <strong>${safeOwnerName}</strong>,</p>
              <p style="margin:0 0 12px 0;">
                Here’s what happened on your recipe <strong>${safeRecipeName}</strong> on ${escapeHtml(
                  dateLabel
                )}.
              </p>
              ${
                totalEvents
                  ? `<p style="margin:0 0 4px 0;color:#4b5563;">${escapeHtml(
                      subjectDetail
                    )}.</p>`
                  : `<p style="margin:0 0 4px 0;color:#4b5563;">No new comments or ratings were recorded for this recipe.</p>`
              }
            </td>
          </tr>

          ${renderCommentList()}

          ${renderRatingList()}

          <!-- View link -->
          <tr>
            <td style="padding:0 22px 20px 22px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#374151;">
              <p style="margin:8px 0 10px 0;">
                <a href="${safeUrl}" style="color:${brandGold};text-decoration:underline;">View this recipe on MeadTools</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 22px 22px 22px;font:13px/1.5 Arial,Helvetica,sans-serif;color:#6b7280;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font:13px/1.5 Arial,Helvetica,sans-serif;color:#6b7280;">
                    <div style="margin-bottom:6px;">
                      You’re receiving this because daily activity emails are enabled for this recipe.
                    </div>
                    <a href="${safeUrl}" style="color:#222;text-decoration:underline;">Manage alerts</a>
                    &nbsp;·&nbsp;
                    <a href="https://meadtools.com" style="color:#222;text-decoration:underline;">Open MeadTools</a>
                  </td>
                  <td align="right" valign="middle">
                    <img src="${logoUrl}" alt="MeadTools" width="120"
                        style="display:block;width:120px;height:auto;margin-left:auto;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  `;

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Cron helpers
// ---------------------------------------------------------------------------

// Utility so you can call it with “yesterday” or a specific date (for testing)
export async function sendRecipeActivityEmailsForDate(summaryDate: Date) {
  const rows = await prisma.recipe_daily_activity.findMany({
    where: {
      summary_date: summaryDate,
      emailed: false,
      recipe: {
        activityEmailsEnabled: true,
        users: {
          isNot: null
        }
      }
    },
    include: {
      recipe: {
        select: {
          id: true,
          name: true,
          activityEmailsEnabled: true,
          users: {
            select: {
              id: true,
              email: true,
              public_username: true
            }
          }
        }
      }
    }
  });

  let sent = 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://meadtools.com";

  for (const row of rows as DailyRow[]) {
    const owner = row.recipe.users;
    if (!owner?.email) continue;

    const ownerDisplayName = owner.public_username?.trim() || owner.email;

    const changes = (row.changes as { events?: ActivityEvent[] } | null) || {};
    const events = changes.events ?? [];

    // If for some reason there are no events, just mark emailed and skip
    if (!events.length) {
      await prisma.recipe_daily_activity.update({
        where: { id: row.id },
        data: { emailed: true }
      });
      continue;
    }

    const recipeUrl = `${baseUrl}/recipes/${row.recipe.id}`;

    const { subject, text, html } = buildDailyRecipeSummaryEmail({
      ownerDisplayName,
      recipeName: row.recipe.name,
      recipeUrl,
      summaryDate: row.summary_date,
      events
    });

    await sendEmail({
      to: owner.email,
      subject,
      text,
      html
    });

    await prisma.recipe_daily_activity.update({
      where: { id: row.id },
      data: { emailed: true }
    });

    sent++;
  }

  return { processed: rows.length, sent };
}

// Convenience wrapper: “yesterday in UTC”
export async function sendYesterdayRecipeActivityEmails() {
  const now = new Date();
  const yesterdayUtcMidnight = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1,
      0,
      0,
      0,
      0
    )
  );

  return sendRecipeActivityEmailsForDate(yesterdayUtcMidnight);
}
export async function deleteStaleActivityUpdates() {
  const now = new Date();
  const retentionDays = 7;

  const cutoffDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - retentionDays,
      0,
      0,
      0,
      0
    )
  );

  return prisma.recipe_daily_activity.deleteMany({
    where: {
      emailed: true,
      summary_date: { lte: cutoffDate }
    }
  });
}
