import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, tables } from "./dynamo";

/**
 * farmIdFromEvent proves who is calling, not which batch they're allowed to
 * touch -- a batch-scoped endpoint (mortality/feed/eggs/vaccinations/weight,
 * online or via the offline sync endpoint) also has to check the batchId in
 * the request actually belongs to that farm, since `batches` is keyed on
 * exactly that pair.
 */
export async function batchBelongsToFarm(farmId: string, batchId: string): Promise<boolean> {
  const result = await ddb.send(new GetCommand({ TableName: tables.batches, Key: { farmId, batchId } }));
  return Boolean(result.Item);
}
