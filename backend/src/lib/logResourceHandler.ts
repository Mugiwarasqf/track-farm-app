import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, queryAll } from "./dynamo";
import { badRequest, created, farmIdFromEvent, notFound, ok } from "./http";
import { entryId } from "./ids";
import { checkRecordDateOf, isIsoDay } from "./dates";
import { batchBelongsToFarm } from "./batchAuth";

/**
 * Mortality, feed, eggs, and vaccination-history all share the same shape:
 * a batch-scoped, append-only log with GET (list) / POST (create) on
 * /batches/{id}/<resource>. This factory is the shared route + DynamoDB
 * wiring; each resource only supplies its own field validation.
 */
export function makeLogResourceHandler<TExtra extends object>(opts: {
  tableName: string;
  buildItem: (batchId: string, body: any) => TExtra | { error: string };
  /** Allow future dates (planned records). The date format is still checked. */
  allowFutureDate?: boolean;
}) {
  return async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
    const batchId = event.pathParameters?.id;
    if (!batchId) return badRequest("batch id is required in the path");
    const method = event.requestContext.http.method;

    const farmId = farmIdFromEvent(event);
    if (!(await batchBelongsToFarm(farmId, batchId))) return notFound("batch not found");

    if (method === "GET") {
      const items = await queryAll({
        TableName: opts.tableName,
        KeyConditionExpression: "batchId = :batchId",
        ExpressionAttributeValues: { ":batchId": batchId },
        ScanIndexForward: false, // entryId is time-prefixed, so this is newest-first
        // Strongly consistent: a page opened right after a save (e.g.
        // Inventory after logging eggs) must see the entry just written.
        ConsistentRead: true,
      });
      return ok({ entries: items, logs: items });
    }

    if (method === "POST") {
      const body = JSON.parse(event.body ?? "{}");
      const fields = opts.buildItem(batchId, body);
      if ("error" in fields) return badRequest(fields.error);
      const dateError = opts.allowFutureDate
        ? isIsoDay((fields as Record<string, unknown>).date) ? null : "date must be a date in YYYY-MM-DD format"
        : checkRecordDateOf(fields as Record<string, unknown>);
      if (dateError) return badRequest(dateError);

      const item = {
        batchId,
        entryId: entryId(),
        createdAt: new Date().toISOString(),
        ...fields,
      };

      await ddb.send(new PutCommand({ TableName: opts.tableName, Item: item }));
      return created(item);
    }

    return badRequest(`unsupported method ${method}`);
  };
}
