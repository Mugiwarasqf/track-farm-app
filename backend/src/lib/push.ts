import { createHash } from "node:crypto";
import { DeleteCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import webpush from "web-push";
import { ddb, tables } from "./dynamo";
import { logger } from "./logger";

/**
 * Phone notifications (Web Push).
 *
 * Each phone that turns notifications on stores one row in the
 * push_subscriptions table: farmId + a hash of the browser's push endpoint.
 * The scheduled reminder jobs call sendPushToFarm(), which delivers to every
 * phone on that farm and deletes any the push service says are gone (app
 * uninstalled, permission revoked, phone reset).
 *
 * Keys: VAPID_PUBLIC_KEY is a plain env var (it's public; the frontend gets
 * the same value through config.js). The private key is never in code or
 * Terraform state: it lives in SSM Parameter Store as a SecureString, read
 * once per cold start from VAPID_PRIVATE_KEY_PARAM. If either is missing,
 * push quietly turns itself off and email carries on as before.
 */

const ssm = new SSMClient({});
const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY_PARAM = process.env.VAPID_PRIVATE_KEY_PARAM || "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@trackfarm.cc";

let configured: Promise<boolean> | null = null;

function ensureConfigured(): Promise<boolean> {
  if (!configured) {
    configured = (async () => {
      if (!PUBLIC_KEY || !PRIVATE_KEY_PARAM) {
        logger.info("push_disabled_no_keys", {});
        return false;
      }
      try {
        const param = await ssm.send(new GetParameterCommand({ Name: PRIVATE_KEY_PARAM, WithDecryption: true }));
        const privateKey = param.Parameter?.Value;
        if (!privateKey) throw new Error("empty parameter");
        webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, privateKey);
        return true;
      } catch (err: any) {
        logger.warn("push_disabled_key_unavailable", { param: PRIVATE_KEY_PARAM, message: err.message });
        configured = null; // try again on the next invocation
        return false;
      }
    })();
  }
  return configured;
}

/** Stable row key for one phone: the endpoint URL is long and can't be a key directly. */
export function subscriptionIdFor(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

export interface PushMessage {
  title: string;
  body: string;
  /** Path inside the app to open when the notification is tapped, e.g. "/batches". */
  url: string;
  /** Notifications with the same tag replace each other instead of piling up. */
  tag: string;
}

/** Sends to every phone on the farm. Returns how many phones it reached. */
export async function sendPushToFarm(farmId: string, message: PushMessage): Promise<number> {
  if (!(await ensureConfigured())) return 0;

  const subs = await ddb.send(
    new QueryCommand({
      TableName: tables.pushSubscriptions,
      KeyConditionExpression: "farmId = :farmId",
      ExpressionAttributeValues: { ":farmId": farmId },
    })
  );

  let delivered = 0;
  for (const sub of subs.Items ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(message),
        // Keep trying for a day if the phone is off, then drop it: a reminder
        // that arrives two days late is worse than none.
        { TTL: 24 * 60 * 60, urgency: "normal" }
      );
      delivered++;
      await ddb.send(
        new UpdateCommand({
          TableName: tables.pushSubscriptions,
          Key: { farmId, subscriptionId: sub.subscriptionId },
          UpdateExpression: "SET lastDeliveredAt = :now",
          ExpressionAttributeValues: { ":now": new Date().toISOString() },
        })
      );
    } catch (err: any) {
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // The push service says this phone is gone for good.
        await ddb.send(
          new DeleteCommand({
            TableName: tables.pushSubscriptions,
            Key: { farmId, subscriptionId: sub.subscriptionId },
          })
        );
        logger.info("push_subscription_removed_expired", { farmId, status });
      } else {
        logger.warn("push_send_failed", { farmId, status, message: err?.message });
      }
    }
  }
  return delivered;
}
