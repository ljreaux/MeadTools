import prisma from "../prisma";
import { escapeHtml, sendEmail, stripMarkdown } from "./emailHelpers";

type RecipeActivityKind = "comment" | "rating";

type NotifyRecipeOwnerOfActivityArgs = {
  recipeId: number;
  kind: RecipeActivityKind;
  actorUserId: number;
  // Optional extra context:
  commentSnippet?: string; // when kind === "comment"
  ratingValue?: number; // when kind === "rating"
};

function buildRecipeActivityEmail({
  kind,
  ownerDisplayName,
  actorDisplayName,
  recipeName,
  recipeUrl,
  commentSnippet,
  ratingValue
}: {
  kind: RecipeActivityKind;
  ownerDisplayName: string;
  actorDisplayName: string;
  recipeName: string;
  recipeUrl: string;
  commentSnippet?: string;
  ratingValue?: number;
}) {
  const logoUrl = "https://meadtools.com/assets/full-logo.png";
  const brandGold = "#cb9f52";
  const safeRecipeName = escapeHtml(recipeName);
  const safeOwnerName = escapeHtml(ownerDisplayName);
  const safeActorName = escapeHtml(actorDisplayName);
  const safeUrl = escapeHtml(recipeUrl);

  const isComment = kind === "comment";

  const subject = isComment
    ? `New comment on "${recipeName}" from ${actorDisplayName}`
    : `New rating on "${recipeName}" from ${actorDisplayName}`;
  const MAX_SNIPPET_LEN = 200;

  const rawSnippet =
    isComment && commentSnippet
      ? stripMarkdown(commentSnippet).trim()
      : undefined;

  const strippedSnippet =
    rawSnippet && rawSnippet.length > MAX_SNIPPET_LEN
      ? rawSnippet.slice(0, MAX_SNIPPET_LEN).trimEnd() + "…"
      : rawSnippet;

  const ratingLine =
    typeof ratingValue === "number" ? `\nRating: ${ratingValue}/5` : "";

  const textLines: string[] = [
    `Hello ${ownerDisplayName},`,
    "",
    isComment
      ? `${actorDisplayName} left a new comment on your recipe "${recipeName}".`
      : `${actorDisplayName} left a new rating on your recipe "${recipeName}".`
  ];

  if (strippedSnippet) {
    textLines.push("", `Comment: "${strippedSnippet}"`);
  }

  if (ratingLine) {
    textLines.push(ratingLine);
  }

  textLines.push("", `View the recipe: ${recipeUrl}`, "", "– MeadTools");

  const text = textLines.join("\n");

  const html = `
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${isComment ? "New comment" : "New rating"} on ${safeRecipeName} from ${safeActorName}.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f7f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
          <tr>
            <td align="center" style="background:${brandGold};padding:20px 16px;">
              <div style="font:700 20px/1.3 Arial,Helvetica,sans-serif;color:#fff;">
                ${isComment ? "New Comment" : "New Rating"} from ${safeActorName}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 22px 12px 22px;font:15px/1.5 Arial,Helvetica,sans-serif;color:#222;">
              <p style="margin:0 0 10px 0;">Hello <strong>${safeOwnerName}</strong>,</p>
              <p style="margin:0 0 14px 0;">
                ${
                  isComment
                    ? `<strong>${safeActorName}</strong> left a new comment on your recipe <strong>${safeRecipeName}</strong>.`
                    : `<strong>${safeActorName}</strong> left a new rating on your recipe <strong>${safeRecipeName}</strong>.`
                }
              </p>
            </td>
          </tr>

          ${
            strippedSnippet || typeof ratingValue === "number"
              ? `
          <tr>
            <td style="padding:0 22px 12px 22px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#374151;">
              ${
                strippedSnippet
                  ? `<p style="margin:0 0 10px 0;"><strong>Comment:</strong><br>${escapeHtml(
                      strippedSnippet
                    )}</p>`
                  : ""
              }
              ${
                typeof ratingValue === "number"
                  ? `<p style="margin:0;"><strong>Rating:</strong> ${ratingValue}/5</p>`
                  : ""
              }
            </td>
          </tr>
          `
              : ""
          }

          <tr>
            <td style="padding:0 22px 20px 22px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#374151;">
              <p style="margin:0 0 10px 0;">
                <a href="${safeUrl}" style="color:${brandGold};text-decoration:underline;">View this recipe on MeadTools</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 22px 22px 22px;font:13px/1.5 Arial,Helvetica,sans-serif;color:#6b7280;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Left text -->
                  <td align="left" style="font:13px/1.5 Arial,Helvetica,sans-serif;color:#6b7280;">
                    <div style="margin-bottom:6px;">
                      You’re receiving this because email alerts are enabled for this recipe.
                    </div>
                    <a href="${safeUrl}" style="color:#222;text-decoration:underline;">Manage alerts</a>
                    &nbsp;·&nbsp;
                    <a href="https://meadtools.com" style="color:#222;text-decoration:underline;">Open MeadTools</a>
                  </td>

                  <!-- Logo -->
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

export async function notifyRecipeOwnerOfActivity(
  args: NotifyRecipeOwnerOfActivityArgs
) {
  try {
    const { recipeId, kind, commentSnippet, ratingValue, actorUserId } = args;

    const recipe = await prisma.recipes.findUnique({
      where: { id: recipeId },
      select: {
        id: true,
        name: true,
        lastActivityEmailAt: true,
        users: {
          select: {
            id: true,
            email: true,
            public_username: true
          }
        }
      }
    });

    if (!recipe || !recipe.users?.email) {
      return; // no owner / no email
    }

    // Null = opted out (per your plan)
    if (!recipe.lastActivityEmailAt) {
      return;
    }

    // Self-activity: don't email users about their own comments/ratings
    if (recipe.users.id === actorUserId) {
      return;
    }

    const now = new Date();
    const lastSent = recipe.lastActivityEmailAt;

    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    if (now.getTime() - lastSent.getTime() < TWENTY_FOUR_HOURS) {
      return;
    }

    const actor = await prisma.users.findUnique({
      where: { id: actorUserId },
      select: {
        public_username: true
      }
    });

    const ownerDisplayName =
      recipe.users.public_username?.trim() || recipe.users.email;

    const actorDisplayName =
      actor?.public_username?.trim() || "a MeadTools user";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://meadtools.com";
    const recipeUrl = `${baseUrl}/recipes/${recipe.id}`;

    const emailPayload = buildRecipeActivityEmail({
      kind,
      ownerDisplayName,
      actorDisplayName,
      recipeName: recipe.name,
      recipeUrl,
      commentSnippet,
      ratingValue
    });

    await sendEmail({
      to: recipe.users.email,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html
    });

    await prisma.recipes.update({
      where: { id: recipeId },
      data: { lastActivityEmailAt: now }
    });
  } catch (error) {
    console.error("Error notifying recipe owner of activity:", error);
    // swallow – this shouldn't break comments/ratings
  }
}
