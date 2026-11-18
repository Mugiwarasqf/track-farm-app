import type { ScheduledHandler } from "aws-lambda";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import { ddb, tables } from "../../lib/dynamo";
import { isSuppressed } from "../../lib/suppression";
import { logger } from "../../lib/logger";
import { loggingReminderEmail, sesMessage } from "../../lib/emailTemplates";

const ses = new SESClient({});
const SENDER_EMAIL = process.env.SES_SENDER_EMAIL!;
const NUDGE_AFTER_DAYS = 2;

// Every kind of record that counts as "the farmer logged something", with the
// attribute its calendar date lives in. Weight checks and vaccinations count
// too: a broiler farmer who only weighs birds and vaccinates is still logging.
const LOG_SOURCES: { table: string; dateField: string }[] = [
  { table: tables.mortalityLogs, dateField: "date" },
  { table: tables.feedLogs, dateField: "date" },
  { table: tables.eggLogs, dateField: "date" },
  { table: tables.weightLogs, dateField: "date" },
  { table: tables.vaccinationRecords, dateField: "dateAdministered" },
];

/**
 * The newest record date in one log table for one batch, or null.
 *
 * This reads every entry's date instead of trusting the sort order. Entries
 * saved online get a time-prefixed entryId, but ones saved offline and synced
 * later used a random UUID from the phone, which sorts anywhere. Reading only
 * the "first" entry made an old offline entry look like the latest one, so
 * farmers who were logging every day kept getting this reminder.
 */
async function latestDate(table: string, dateField: string, batchId: string): Promise<string | null> {
  let latest: string | null = null;
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "batchId = :batchId",
        ExpressionAttributeValues: { ":batchId": batchId },
        ProjectionExpression: "#d",
        ExpressionAttributeNames: { "#d": dateField },
        ExclusiveStartKey: startKey,
      })
    );
    for (const item of page.Items ?? []) {
      const date = item[dateField];
      if (typeof date === "string" && (!latest || date > latest)) latest = date;
    }
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return latest;
}

// Runs daily via the EventBridge Schedule in infra/modules/notifications/
// — the "nothing logged today/this week" nudge from docs/04-v1-feature-scope.md
// §5. Elizabeth's totals broke because of missing entries, not bad math
// (docs/05-interview-elizabeth.txt), so this reuses the same SES
// notification path as vaccinationReminders.ts with a different trigger.
//
// A full Scan of the Farms table, and reading every entry date per batch, is
// fine at beta scale (a handful of farms, small batches). Replace both with
// something targeted (e.g. a lastLoggedAt on the batch) well before it isn't.
export const handler: ScheduledHandler = async () => {
  const cutoff = new Date(Date.now() - NUDGE_AFTER_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const farms = await ddb.send(new ScanCommand({ TableName: tables.farms }));

  let sent = 0;
  let skippedSuppressed = 0;
  let skippedUpToDate = 0;
  let skippedNoActiveBatches = 0;
  let skippedDisabled = 0;

  for (const farm of farms.Items ?? []) {
    const prefs = farm.notificationPrefs;
    if (prefs?.emailAlerts === false || prefs?.loggingNudges === false) {
      logger.info("entry_nudge_skipped_disabled", { farmId: farm.farmId });
      skippedDisabled++;
      continue;
    }

    const batches = await ddb.send(
      new QueryCommand({
        TableName: tables.batches,
        KeyConditionExpression: "farmId = :farmId",
        FilterExpression: "#status = :active",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":farmId": farm.farmId, ":active": "active" },
      })
    );
    const activeBatches = batches.Items ?? [];
    if (activeBatches.length === 0) {
      skippedNoActiveBatches++;
      continue;
    }

    let mostRecentLog: string | null = null;
    // A batch entered in the app recently gets the same grace period as a
    // recent log, so a farmer isn't nagged the day after creating it.
    let mostRecentActivity: string | null = null;
    for (const batch of activeBatches) {
      const created = typeof batch.createdAt === "string" ? batch.createdAt.slice(0, 10) : null;
      if (created && (!mostRecentActivity || created > mostRecentActivity)) mostRecentActivity = created;

      for (const { table, dateField } of LOG_SOURCES) {
        const date = await latestDate(table, dateField, batch.batchId);
        if (date && (!mostRecentLog || date > mostRecentLog)) mostRecentLog = date;
      }
    }
    if (mostRecentLog && (!mostRecentActivity || mostRecentLog > mostRecentActivity)) {
      mostRecentActivity = mostRecentLog;
    }

    if (mostRecentActivity && mostRecentActivity >= cutoff) {
      skippedUpToDate++;
      continue;
    }

    if (await isSuppressed(farm.ownerEmail)) {
      logger.warn("entry_nudge_skipped_suppressed", { email: farm.ownerEmail, farmId: farm.farmId });
      skippedSuppressed++;
      continue;
    }

    const email = loggingReminderEmail(
      mostRecentLog,
      activeBatches.map((b) => String(b.name || "Unnamed batch"))
    );
    await ses.send(
      new SendEmailCommand({
        Source: SENDER_EMAIL,
        Destination: { ToAddresses: [farm.ownerEmail] },
        Message: sesMessage(email),
      })
    );
    logger.info("entry_nudge_sent", { farmId: farm.farmId, lastLogDate: mostRecentLog });
    sent++;
  }

  logger.info("entry_nudges_run_complete", {
    farmsScanned: farms.Items?.length ?? 0,
    sent,
    skippedSuppressed,
    skippedUpToDate,
    skippedNoActiveBatches,
    skippedDisabled,
  });
};
