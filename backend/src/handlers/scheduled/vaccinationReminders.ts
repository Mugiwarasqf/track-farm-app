import type { ScheduledHandler } from "aws-lambda";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { ddb, queryAll, tables } from "../../lib/dynamo";
import { isSuppressed } from "../../lib/suppression";
import { logger } from "../../lib/logger";
import { type DueVaccine, sesMessage, vaccinationPush, vaccinationReminderEmail } from "../../lib/emailTemplates";
import { sendPushToFarm } from "../../lib/push";

const ses = new SESClient({});
const SENDER_EMAIL = process.env.SES_SENDER_EMAIL!;
const REMINDER_WINDOW_DAYS = 3;

// Runs daily via the EventBridge Schedule in infra/modules/notifications/.
// Implements the two-touch cadence Toluwase's follow-up confirmed
// (docs/09-interview-toluwase.txt: a heads-up a few days before, plus a
// same-day reminder) — a schedule item due in 3 days surfaces in 3
// consecutive daily runs until it's marked done, so both touches fall out
// of this one query without extra state to track "have we already warned
// about this one."
//
// Sent as a phone push (lib/push.ts) and an email. Toluwase's confirmation
// was specifically about a phone notification, so push is the channel that
// matches the research; email is the fallback for phones without it.
//
// Requires two GSIs beyond what docs/10-build-plan.md's data model lists
// (added in infra/modules/dynamodb/, flagged there too): VaccinationSchedules
// needs a status+dueDate index to find what's due without scanning every
// batch, and Batches needs a batchId-only index because a schedule item
// only carries batchId, not the farmId needed to look up an email address.
export const handler: ScheduledHandler = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const dueSoon = await queryAll({
    TableName: tables.vaccinationSchedules,
    IndexName: "StatusDueDateIndex",
    KeyConditionExpression: "#status = :upcoming AND dueDate BETWEEN :today AND :windowEnd",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":upcoming": "upcoming", ":today": today, ":windowEnd": windowEnd },
  });

  let sent = 0;
  let pushed = 0;
  let emailFailed = 0;
  let skippedSuppressed = 0;
  let skippedNoFarmOrEmail = 0;
  let skippedDisabled = 0;

  // One email per farm listing everything due, rather than one email per
  // vaccine: three batches due on the same day used to mean three identical
  // "Vaccination reminder" emails.
  const byFarm = new Map<string, { email: string | null; emailOn: boolean; due: DueVaccine[] }>();
  const farmCache = new Map<string, Record<string, any> | null>();

  for (const item of dueSoon) {
    const batch = await ddb.send(
      new QueryCommand({
        TableName: tables.batches,
        IndexName: "BatchIdIndex",
        KeyConditionExpression: "batchId = :batchId",
        ExpressionAttributeValues: { ":batchId": item.batchId },
      })
    );
    const batchItem = batch.Items?.[0];
    const farmId = batchItem?.farmId;
    if (!farmId) {
      logger.warn("vaccination_reminder_skipped_no_farm", { batchId: item.batchId, scheduleId: item.scheduleId });
      skippedNoFarmOrEmail++;
      continue;
    }
    // Closed batches have no birds left to vaccinate.
    if (batchItem?.status && batchItem.status !== "active") continue;

    if (!farmCache.has(farmId)) {
      const farm = await ddb.send(new GetCommand({ TableName: tables.farms, Key: { farmId } }));
      farmCache.set(farmId, farm.Item ?? null);
    }
    const farm = farmCache.get(farmId);
    if (!farm) {
      logger.warn("vaccination_reminder_skipped_no_farm_row", { farmId, batchId: item.batchId });
      skippedNoFarmOrEmail++;
      continue;
    }

    // The vaccination switch turns off both email and phone notifications;
    // the email switch only turns off the email.
    const prefs = farm.notificationPrefs;
    if (prefs?.vaccinationReminders === false) {
      logger.info("vaccination_reminder_skipped_disabled", { farmId });
      skippedDisabled++;
      continue;
    }
    const email: string | null = farm.ownerEmail || null;
    const emailOn = Boolean(email) && prefs?.emailAlerts !== false;

    const entry = byFarm.get(farmId) ?? { email, emailOn, due: [] as DueVaccine[] };
    entry.due.push({
      vaccineName: String(item.vaccineName || "Vaccine"),
      batchName: String(batchItem?.name || "your batch"),
      dueDate: String(item.dueDate),
    });
    byFarm.set(farmId, entry);
  }

  for (const [farmId, { email, emailOn, due }] of byFarm) {
    pushed += await sendPushToFarm(farmId, vaccinationPush(due, today));

    if (!emailOn || !email) continue;
    if (await isSuppressed(email)) {
      logger.warn("vaccination_reminder_skipped_suppressed", { email, farmId });
      skippedSuppressed++;
      continue;
    }

    // One bad address mustn't stop the rest of the run.
    try {
      await ses.send(
        new SendEmailCommand({
          Source: SENDER_EMAIL,
          Destination: { ToAddresses: [email] },
          Message: sesMessage(vaccinationReminderEmail(due, today)),
        })
      );
      sent++;
    } catch (err: any) {
      emailFailed++;
      logger.warn("vaccination_reminder_email_failed", { farmId, message: err?.message });
    }
  }

  // The only way to confirm from CloudWatch alone that today's run actually
  // found and acted on something, without needing a failure to look at.
  logger.info("vaccination_reminders_run_complete", {
    due: dueSoon.length,
    sent,
    pushed,
    emailFailed,
    skippedSuppressed,
    skippedNoFarmOrEmail,
    skippedDisabled,
  });
};
