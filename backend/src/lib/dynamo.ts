import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  type QueryCommandInput,
  type ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});

// removeUndefinedValues: log entries often have optional fields (a note,
// a cost) that come through as undefined rather than omitted.
export const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const tables = {
  farms: process.env.FARMS_TABLE!,
  batches: process.env.BATCHES_TABLE!,
  users: process.env.USERS_TABLE!,
  mortalityLogs: process.env.MORTALITY_LOGS_TABLE!,
  feedLogs: process.env.FEED_LOGS_TABLE!,
  eggLogs: process.env.EGG_LOGS_TABLE!,
  vaccinationRecords: process.env.VACCINATION_RECORDS_TABLE!,
  vaccinationSchedules: process.env.VACCINATION_SCHEDULES_TABLE!,
  feedPurchases: process.env.FEED_PURCHASES_TABLE!,
  weightLogs: process.env.WEIGHT_LOGS_TABLE!,
  sickBay: process.env.SICK_BAY_TABLE!,
  suppressedEmails: process.env.SUPPRESSED_EMAILS_TABLE!,
  pushSubscriptions: process.env.PUSH_SUBSCRIPTIONS_TABLE!,
  supplements: process.env.SUPPLEMENTS_TABLE!,
  sales: process.env.SALES_TABLE!,
  medicinePurchases: process.env.MEDICINE_PURCHASES_TABLE!,
};

/** Every page of a Query (one page stops at 1MB). */
export async function queryAll(input: QueryCommandInput): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = [];
  let startKey: Record<string, any> | undefined;
  do {
    const page = await ddb.send(new QueryCommand({ ...input, ExclusiveStartKey: startKey }));
    items.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return items;
}

/** Every page of a Scan. */
export async function scanAll(input: ScanCommandInput): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = [];
  let startKey: Record<string, any> | undefined;
  do {
    const page = await ddb.send(new ScanCommand({ ...input, ExclusiveStartKey: startKey }));
    items.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return items;
}
