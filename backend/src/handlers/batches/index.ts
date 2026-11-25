import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { BatchWriteCommand, DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, queryAll, tables } from "../../lib/dynamo";
import { badRequest, created, farmIdFromEvent, notFound, ok } from "../../lib/http";
import { newId } from "../../lib/ids";
import { logger } from "../../lib/logger";
import { pickOptional } from "../../lib/optionalFields";
import type { Batch, BatchStatus } from "../../lib/types";
import { birdSalesByBatch, birdsLost, flockCount } from "../../lib/flock";

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const farmId = farmIdFromEvent(event);
  const method = event.requestContext.http.method;
  const batchId = event.pathParameters?.id;

  if (method === "GET") {
    const [batches, sold] = await Promise.all([
      queryAll({
        TableName: tables.batches,
        KeyConditionExpression: "farmId = :farmId",
        ExpressionAttributeValues: { ":farmId": farmId },
      }),
      birdSalesByBatch(farmId),
    ]);
    // Birds alive on every batch, so every screen shows the same number.
    const withCounts = await Promise.all(
      batches.map(async (b) => ({
        ...b,
        ...flockCount(b.birdCount, await birdsLost(b.batchId), sold.get(b.batchId) ?? 0),
      }))
    );
    return ok({ batches: withCounts });
  }

  if (method === "POST") {
    const body = JSON.parse(event.body ?? "{}");
    if (!body.name || !body.type || !body.startDate || typeof body.birdCount !== "number") {
      return badRequest("name, type, startDate, and birdCount are required");
    }

    // startDate stays farmer-declared, because a flock is often recorded days
    // or weeks after the birds actually arrived — forcing the server clock
    // would make it impossible to enter an existing flock honestly. But a
    // future date is never a legitimate entry, and it would make the batch's
    // age and every day-based figure derived from it meaningless.
    // createdAt below is the server's own record of when this was entered, so
    // a declared date far from it stays auditable.
    if (String(body.startDate) > new Date().toISOString().slice(0, 10)) {
      return badRequest("startDate cannot be in the future");
    }

    const batch: Batch = {
      farmId,
      batchId: newId(),
      name: body.name,
      type: String(body.type).trim().slice(0, 40),
      startDate: body.startDate,
      birdCount: body.birdCount,
      ...(body.breed ? { breed: body.breed } : {}),
      ...(body.housing ? { housing: body.housing } : {}),
      ...(body.initialAgeWeeks ? { initialAgeWeeks: Number(body.initialAgeWeeks) } : {}),
      ...(body.notes ? { notes: body.notes } : {}),
      ...pickOptional(body, {
        penId: "string",
        hatchery: "string",
        targetWeightKg: "number",
        purchaseCostNaira: "number",
      }),
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName: tables.batches, Item: batch }));
    return created(batch);
  }

  if (method === "PATCH") {
    if (!batchId) return badRequest("batch id is required in the path");
    const body = JSON.parse(event.body ?? "{}");

    // birdCount is deliberately NOT updatable. It records how many birds were
    // placed, which is the baseline every mortality and survival figure is
    // measured against. Allowing it to be edited after the fact let someone
    // quietly raise or lower the placed count to hide losses, with no record
    // that it had ever changed. Corrections now mean deleting and recreating
    // the batch, which leaves the old row's absence visible rather than
    // silently rewriting history. startDate is excluded for the same reason.
    const allowed: Array<keyof Batch> = [
      "name", "status", "breed", "housing", "penId", "notes",
      // Recorded when a batch is completed (sales are what meat-bird
      // performance is judged on), or filled in afterwards.
      "purchaseCostNaira", "birdsSold", "salesRevenueNaira", "completionNotes",
    ];
    const updates = allowed.filter((key) => body[key] !== undefined);
    if (updates.length === 0) return badRequest("no updatable fields provided");

    for (const key of ["purchaseCostNaira", "birdsSold", "salesRevenueNaira"] as const) {
      if (body[key] !== undefined && !(typeof body[key] === "number" && Number.isFinite(body[key]) && body[key] >= 0)) {
        return badRequest(`${key} must be a number of zero or more`);
      }
    }

    const validStatuses: BatchStatus[] = ["active", "closed"];
    if (body.status && !validStatuses.includes(body.status)) {
      return badRequest(`status must be one of ${validStatuses.join(", ")}`);
    }

    // closedAt is server-set only (see the Batch.closedAt comment in
    // lib/types.ts) — stamp it the moment a batch closes, and clear it if
    // a batch is ever reopened, rather than trusting anything the client
    // sends for it.
    const setValues: Record<string, unknown> = Object.fromEntries(
      updates.map((k) => [k, body[k]])
    );
    const removeKeys: string[] = [];
    if (body.status === "closed") {
      setValues.closedAt = new Date().toISOString();
    } else if (body.status === "active") {
      removeKeys.push("closedAt");
    }

    const setKeys = Object.keys(setValues);
    const expressionParts: string[] = [];
    if (setKeys.length > 0) {
      expressionParts.push(`SET ${setKeys.map((k, i) => `#${k} = :v${i}`).join(", ")}`);
    }
    if (removeKeys.length > 0) {
      expressionParts.push(`REMOVE ${removeKeys.map((k) => `#${k}`).join(", ")}`);
    }

    await ddb.send(
      new UpdateCommand({
        TableName: tables.batches,
        Key: { farmId, batchId },
        UpdateExpression: expressionParts.join(" "),
        ExpressionAttributeNames: Object.fromEntries(
          [...setKeys, ...removeKeys].map((k) => [`#${k}`, k])
        ),
        ...(setKeys.length > 0
          ? { ExpressionAttributeValues: Object.fromEntries(setKeys.map((k, i) => [`:v${i}`, setValues[k]])) }
          : {}),
        ConditionExpression: "attribute_exists(batchId)",
      })
    ).catch((err) => {
      if (err.name === "ConditionalCheckFailedException") {
        // Swallowed deliberately rather than returning 404 -- but that
        // means the response below looks like a successful update even
        // when batchId didn't exist (farmId mismatch, typo, already
        // deleted). Logging it is the only way to tell those apart from a
        // real update after the fact.
        logger.warn("batch_patch_condition_failed", { farmId, batchId });
        return null;
      }
      throw err;
    });

    return ok({ farmId, batchId, updated: [...setKeys, ...removeKeys] });
  }

  if (method === "DELETE") {
    if (!batchId) return badRequest("batch id is required in the path");
    const existing = await ddb.send(new GetCommand({ TableName: tables.batches, Key: { farmId, batchId } }));
    if (!existing.Item) return notFound("batch not found");

    // Records first, batch last: a failure part-way leaves the batch in
    // place so the farmer can retry, never orphaned records.
    let removed = 0;
    for (const { table, sortKey } of CHILD_TABLES()) {
      removed += await deleteAllForBatch(table, sortKey, batchId);
    }
    removed += await deleteBatchSales(farmId, batchId);
    await ddb.send(new DeleteCommand({ TableName: tables.batches, Key: { farmId, batchId } }));
    logger.info("batch_deleted", { farmId, batchId, recordsRemoved: removed });
    return ok({ deleted: true, batchId, recordsRemoved: removed });
  }

  return notFound(`unsupported method ${method} for /batches`);
}

// Every batch-keyed table and its sort key. A function so tables.* is read
// at call time (env vars), same as everywhere else.
const CHILD_TABLES = () => [
  { table: tables.mortalityLogs, sortKey: "entryId" },
  { table: tables.feedLogs, sortKey: "entryId" },
  { table: tables.eggLogs, sortKey: "entryId" },
  { table: tables.weightLogs, sortKey: "entryId" },
  { table: tables.vaccinationRecords, sortKey: "entryId" },
  { table: tables.vaccinationSchedules, sortKey: "scheduleId" },
  { table: tables.sickBay, sortKey: "caseId" },
  { table: tables.supplements, sortKey: "entryId" },
];

async function deleteAllForBatch(table: string, sortKey: string, batchId: string): Promise<number> {
  const keys = await queryAll({
    TableName: table,
    KeyConditionExpression: "batchId = :b",
    ExpressionAttributeValues: { ":b": batchId },
    ProjectionExpression: "#s",
    ExpressionAttributeNames: { "#s": sortKey },
  });
  for (let i = 0; i < keys.length; i += 25) {
    let requests: any[] = keys.slice(i, i + 25).map((k) => ({
      DeleteRequest: { Key: { batchId, [sortKey]: k[sortKey] } },
    }));
    // BatchWrite can hand some back under load; retry those with a short backoff.
    for (let attempt = 0; requests.length > 0; attempt++) {
      if (attempt > 5) throw new Error(`could not delete all records from ${table}`);
      if (attempt > 0) await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
      const res = await ddb.send(new BatchWriteCommand({ RequestItems: { [table]: requests } }));
      requests = res.UnprocessedItems?.[table] ?? [];
    }
  }
  return keys.length;
}

// Sales are farm-keyed, so the batch's ones are found by filter.
async function deleteBatchSales(farmId: string, batchId: string): Promise<number> {
  const sales = await queryAll({
    TableName: tables.sales,
    KeyConditionExpression: "farmId = :f",
    FilterExpression: "batchId = :b",
    ExpressionAttributeValues: { ":f": farmId, ":b": batchId },
    ProjectionExpression: "entryId",
  });
  for (const s of sales) {
    await ddb.send(new DeleteCommand({ TableName: tables.sales, Key: { farmId, entryId: s.entryId } }));
  }
  return sales.length;
}
