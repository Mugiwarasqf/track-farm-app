import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "../../lib/dynamo";
import { badRequest, farmIdFromEvent, notFound, ok } from "../../lib/http";
import { logger } from "../../lib/logger";
import { subscriptionIdFor } from "../../lib/push";

// POST /push/subscriptions         — save this phone for notifications
// POST /push/subscriptions/remove  — stop notifications to this phone
//
// The body is the browser's PushSubscription JSON ({ endpoint, keys }).
// farmId always comes from the caller's token, never the body.
//
// A phone belongs to one farm at a time. Saving it first removes the same
// phone from any other farm (looked up through SubscriptionIdIndex), so if
// someone signs into a different account on a shared phone, the previous
// farm's reminders stop arriving there.
export async function handler(event: APIGatewayProxyEventV2WithJWTAuthorizer) {
  const farmId = farmIdFromEvent(event);
  const path = event.rawPath || event.requestContext.http.path;

  let body: any;
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return badRequest("body must be JSON");
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 2000) {
    return badRequest("endpoint must be the https URL from the browser's push subscription");
  }
  const subscriptionId = subscriptionIdFor(endpoint);

  if (path.endsWith("/remove")) {
    await ddb.send(
      new DeleteCommand({ TableName: tables.pushSubscriptions, Key: { farmId, subscriptionId } })
    );
    logger.info("push_subscription_removed", { farmId });
    return ok({ removed: true });
  }

  if (!path.endsWith("/subscriptions")) return notFound("unknown push route");

  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) {
    return badRequest("keys.p256dh and keys.auth are required");
  }

  // Same phone saved under another farm: take it off there first.
  const existing = await ddb.send(
    new QueryCommand({
      TableName: tables.pushSubscriptions,
      IndexName: "SubscriptionIdIndex",
      KeyConditionExpression: "subscriptionId = :id",
      ExpressionAttributeValues: { ":id": subscriptionId },
    })
  );
  for (const item of existing.Items ?? []) {
    if (item.farmId !== farmId) {
      await ddb.send(
        new DeleteCommand({
          TableName: tables.pushSubscriptions,
          Key: { farmId: item.farmId, subscriptionId },
        })
      );
      logger.info("push_subscription_moved_between_farms", { from: item.farmId, to: farmId });
    }
  }

  const userAgent = String(event.headers?.["user-agent"] ?? "").slice(0, 300);
  await ddb.send(
    new PutCommand({
      TableName: tables.pushSubscriptions,
      Item: {
        farmId,
        subscriptionId,
        endpoint,
        p256dh,
        auth,
        userAgent,
        createdAt: new Date().toISOString(),
      },
    })
  );
  logger.info("push_subscription_saved", { farmId });
  return ok({ saved: true });
}
