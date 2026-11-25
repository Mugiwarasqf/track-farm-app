import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, queryAll, tables } from "../../lib/dynamo";
import { badRequest, created, farmIdFromEvent, notFound, ok } from "../../lib/http";
import { entryId } from "../../lib/ids";
import { checkRecordDate } from "../../lib/dates";
import { pickOptional } from "../../lib/optionalFields";
import { birdSalesByBatch, birdsLost, flockCount } from "../../lib/flock";
import { computeEggStock } from "../../lib/eggStock";

// GET/POST /sales, DELETE /sales/{entryId}: money in from selling birds or
// eggs (the Income & Expenses page). Farm-level like /feed-stock. A bird sale
// from a batch lowers that batch's birds alive; one with only a birdType
// (no batch of that type on record) doesn't. An egg sale may name a batch.

export const EGG_SIZES = ["small", "medium", "large", "jumbo"] as const;
export const EGG_UNITS = ["crates", "pieces"] as const;

type Body = Record<string, any>;

export function validateSale(body: Body): string | null {
  const dateError = checkRecordDate(body.date);
  if (dateError) return dateError;
  if (body.product !== "birds" && body.product !== "eggs") return 'product must be "birds" or "eggs"';
  const qty = body.quantity;
  if (typeof qty !== "number" || !(qty > 0)) return "quantity must be a number above zero";
  if (body.product === "birds") {
    if (!Number.isInteger(qty)) return "birds are sold whole: quantity must be a whole number";
    const hasBatch = typeof body.batchId === "string" && body.batchId;
    const hasType = typeof body.birdType === "string" && body.birdType.trim();
    if (!hasBatch && !hasType) return "batchId or birdType is required when selling birds";
  } else {
    if (!EGG_SIZES.includes(body.eggSize)) return `eggSize must be one of ${EGG_SIZES.join(", ")}`;
    if (!EGG_UNITS.includes(body.unit)) return `unit must be one of ${EGG_UNITS.join(", ")}`;
  }
  const price = body.pricePerUnitNaira;
  const amount = body.amountNaira;
  const isMoney = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (!isMoney(price) && !isMoney(amount)) return "pricePerUnitNaira or amountNaira is required";
  return null;
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const farmId = farmIdFromEvent(event);
  const method = event.requestContext.http.method;

  if (method === "GET") {
    const [sales, batches] = await Promise.all([
      queryAll({
        TableName: tables.sales,
        KeyConditionExpression: "farmId = :f",
        ExpressionAttributeValues: { ":f": farmId },
        ScanIndexForward: false,
      }),
      queryAll({
        TableName: tables.batches,
        KeyConditionExpression: "farmId = :f",
        ExpressionAttributeValues: { ":f": farmId },
        ProjectionExpression: "batchId",
      }),
    ]);
    // Egg collection per batch, for the eggs-in-store figure on the sale form.
    const logs = await Promise.all(
      batches.map((b) =>
        queryAll({
          TableName: tables.eggLogs,
          KeyConditionExpression: "batchId = :b",
          ExpressionAttributeValues: { ":b": b.batchId },
          ProjectionExpression: "crates, looseEggs",
        })
      )
    );
    const logsByBatch = Object.fromEntries(batches.map((b, i) => [b.batchId, logs[i]]));
    return ok({ sales, eggStock: computeEggStock(logsByBatch, sales) });
  }

  if (method === "DELETE") {
    const id = event.pathParameters?.entryId;
    if (!id) return badRequest("sale id is required in the path");
    const existing = await ddb.send(new GetCommand({ TableName: tables.sales, Key: { farmId, entryId: id } }));
    if (!existing.Item) return notFound("sale not found");
    await ddb.send(new DeleteCommand({ TableName: tables.sales, Key: { farmId, entryId: id } }));
    return ok({ deleted: true, entryId: id });
  }

  if (method !== "POST") return badRequest(`unsupported method ${method}`);

  const body: Body = JSON.parse(event.body ?? "{}");
  const error = validateSale(body);
  if (error) return badRequest(error);

  let batch: Record<string, any> | undefined;
  if (typeof body.batchId === "string" && body.batchId) {
    batch = (await ddb.send(new GetCommand({ TableName: tables.batches, Key: { farmId, batchId: body.batchId } }))).Item;
    if (!batch) return notFound("batch not found");
  }

  if (body.product === "birds" && batch) {
    const sold = (await birdSalesByBatch(farmId)).get(batch.batchId) ?? 0;
    const { currentBirds } = flockCount(batch.birdCount, await birdsLost(batch.batchId), sold);
    if (body.quantity > currentBirds) {
      return badRequest(`${batch.name || "This batch"} has only ${currentBirds} birds alive`);
    }
  }

  const amountNaira =
    typeof body.amountNaira === "number" ? body.amountNaira : Math.round(body.quantity * body.pricePerUnitNaira);

  const item = {
    farmId,
    entryId: entryId(),
    date: body.date,
    product: body.product,
    quantity: body.quantity,
    amountNaira,
    ...(typeof body.pricePerUnitNaira === "number" ? { pricePerUnitNaira: body.pricePerUnitNaira } : {}),
    ...(batch ? { batchId: batch.batchId, batchName: String(batch.name || "") } : {}),
    ...(body.product === "birds"
      ? { birdType: String(batch?.type || body.birdType).trim().toLowerCase().slice(0, 40), unit: "birds" }
      : { eggSize: body.eggSize, unit: body.unit }),
    ...pickOptional(body, { buyer: "string", notes: "string" }),
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: tables.sales, Item: item }));
  return created(item);
}
