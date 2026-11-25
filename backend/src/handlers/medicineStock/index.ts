import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, queryAll, tables } from "../../lib/dynamo";
import { badRequest, created, farmIdFromEvent, ok } from "../../lib/http";
import { entryId } from "../../lib/ids";
import { checkRecordDate, isIsoDay } from "../../lib/dates";
import { pickOptional } from "../../lib/optionalFields";

// GET/POST /medicine-stock: vaccines and vitamins/dewormers bought in bulk
// and kept in the farm's store, like /feed-stock for feed. What's left is
// worked out in the app: bought here, minus what vaccination records
// (vialsUsed) and supplement records (packsUsed) took, matched on stockKey.

export function validatePurchase(body: Record<string, any>): string | null {
  const dateError = checkRecordDate(body.date);
  if (dateError) return dateError;
  if (body.kind !== "vaccine" && body.kind !== "supplement") return 'kind must be "vaccine" or "supplement"';
  if (typeof body.name !== "string" || !body.name.trim()) return "name is required";
  if (typeof body.quantity !== "number" || !(body.quantity > 0) || !Number.isInteger(body.quantity)) {
    return "quantity must be a whole number above zero";
  }
  if (body.kind === "vaccine" && !(typeof body.dosesPerVial === "number" && body.dosesPerVial > 0)) {
    return "dosesPerVial is required for vaccines";
  }
  if (body.expiry !== undefined && !isIsoDay(body.expiry)) return "expiry must be a date in YYYY-MM-DD format";
  return null;
}

export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const farmId = farmIdFromEvent(event);
  const method = event.requestContext.http.method;

  if (method === "GET") {
    const purchases = await queryAll({
      TableName: tables.medicinePurchases,
      KeyConditionExpression: "farmId = :f",
      ExpressionAttributeValues: { ":f": farmId },
      ScanIndexForward: false,
    });
    return ok({ purchases });
  }

  if (method !== "POST") return badRequest(`unsupported method ${method}`);

  const body = JSON.parse(event.body ?? "{}");
  const error = validatePurchase(body);
  if (error) return badRequest(error);

  const item = {
    farmId,
    entryId: entryId(),
    date: body.date,
    kind: body.kind,
    name: body.name.trim().slice(0, 80),
    quantity: body.quantity,
    ...(body.kind === "vaccine" ? { dosesPerVial: body.dosesPerVial } : {}),
    ...(isIsoDay(body.expiry) ? { expiry: body.expiry } : {}),
    ...pickOptional(body, {
      supplementType: "string",
      brand: "string",
      packSize: "string",
      pricePerUnitNaira: "number",
      supplier: "string",
      notes: "string",
    }),
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: tables.medicinePurchases, Item: item }));
  return created(item);
}
