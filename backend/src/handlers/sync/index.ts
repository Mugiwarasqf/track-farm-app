import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "../../lib/dynamo";
import { badRequest, farmIdFromEvent, ok } from "../../lib/http";
import { logger } from "../../lib/logger";
import { checkRecordDateOf } from "../../lib/dates";
import { batchBelongsToFarm } from "../../lib/batchAuth";

// POST /sync/batch — docs/10-build-plan.md §6. The body is JSON Lines (one
// queued offline write per line), matching the on-device append-only queue
// format described there. Unlike the online create endpoints, the client
// supplies its own `entryId` (generated on-device while offline) so a
// retried sync — the phone re-sending a line it's not sure went through —
// is a safe no-op instead of a duplicate row.
//
// This intentionally does not go through logResourceHandler.ts: that
// factory always assigns entryId server-side, which is right for the
// online create endpoints but wrong here.

interface SyncLine {
  resource: keyof typeof RESOURCES;
  batchId: string;
  /** The client-generated idempotency id. Always called entryId on the
   *  wire regardless of resource -- RESOURCES below maps it to whatever
   *  attribute name the target table actually uses. */
  entryId: string;
  [field: string]: unknown;
}

interface ResourceConfig {
  tableName: string;
  /** DynamoDB attribute the client's `entryId` is stored under for this resource. */
  idField: "entryId" | "scheduleId";
  /** False for vaccination-schedule: dueDate is expected to be ahead of
   *  today, the opposite of every other resource here, which log something
   *  that already happened. */
  checkDate: boolean;
  /** Extra fields this resource requires beyond batchId/entryId. */
  requiredFields?: string[];
  /** Server-set fields merged onto the stored item, mirroring what the
   *  equivalent online handler sets (e.g. a schedule's initial status). */
  defaults?: () => Record<string, unknown>;
}

const RESOURCES: Record<string, ResourceConfig> = {
  mortality: { tableName: tables.mortalityLogs, idField: "entryId", checkDate: true },
  feed: { tableName: tables.feedLogs, idField: "entryId", checkDate: true },
  eggs: { tableName: tables.eggLogs, idField: "entryId", checkDate: true },
  vaccinations: { tableName: tables.vaccinationRecords, idField: "entryId", checkDate: true },
  weight: { tableName: tables.weightLogs, idField: "entryId", checkDate: true },
  "vaccination-schedule": {
    tableName: tables.vaccinationSchedules,
    idField: "scheduleId",
    checkDate: false,
    requiredFields: ["vaccineName", "dueDate"],
    defaults: () => ({ status: "upcoming" }),
  },
};

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const farmId = farmIdFromEvent(event);
  const body = event.body ?? "";
  const lines = body.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return badRequest("body must be one JSON object per line");

  // One lookup per distinct batchId, shared by every line against it,
  // rather than a DynamoDB round trip per line.
  const ownership = new Map<string, Promise<boolean>>();
  const ownsBatch = (batchId: string) => {
    let promise = ownership.get(batchId);
    if (!promise) {
      promise = batchBelongsToFarm(farmId, batchId);
      ownership.set(batchId, promise);
    }
    return promise;
  };

  const results = await Promise.all(
    lines.map(async (line, index) => {
      let parsed: SyncLine;
      try {
        parsed = JSON.parse(line);
      } catch {
        return { line: index, status: "error" as const, reason: "invalid JSON" };
      }

      const config = RESOURCES[parsed.resource];
      if (!config || !parsed.batchId || !parsed.entryId) {
        return { line: index, status: "error" as const, reason: "missing resource/batchId/entryId" };
      }
      for (const field of config.requiredFields ?? []) {
        if (parsed[field] === undefined || parsed[field] === null || parsed[field] === "") {
          return { line: index, status: "error" as const, reason: `${field} is required` };
        }
      }
      if (config.checkDate) {
        const dateError = checkRecordDateOf(parsed);
        if (dateError) return { line: index, status: "error" as const, reason: dateError };
      }
      // A queue entry from a batch that isn't this farm's -- someone else's
      // leftover offline queue on a shared device, logged out before it
      // flushed -- must not get written under this session.
      if (!(await ownsBatch(parsed.batchId))) {
        return { line: index, status: "error" as const, reason: "batch not found" };
      }

      const { resource: _resource, entryId, ...rest } = parsed;
      const item = {
        ...rest,
        [config.idField]: entryId,
        ...(config.defaults?.() ?? {}),
        createdAt: new Date().toISOString(),
      };

      try {
        await ddb.send(
          new PutCommand({
            TableName: config.tableName,
            Item: item,
            ConditionExpression: `attribute_not_exists(${config.idField})`,
          })
        );
        return { line: index, status: "applied" as const };
      } catch (err: any) {
        if (err.name === "ConditionalCheckFailedException") {
          return { line: index, status: "duplicate" as const };
        }
        return { line: index, status: "error" as const, reason: String(err.message ?? err) };
      }
    })
  );

  const counts = results.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {} as Record<string, number>
  );
  logger.info("sync_batch_complete", { lines: lines.length, ...counts });

  return ok({ results });
}
