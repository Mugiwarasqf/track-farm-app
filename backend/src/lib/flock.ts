import { queryAll, tables } from "./dynamo";

/**
 * Birds alive per batch = placed − deaths − birds sold through /sales.
 * Derived on read like every other balance in this API.
 */
export interface FlockCount {
  birdsLost: number;
  birdsSoldToDate: number;
  currentBirds: number;
}

export async function birdSalesByBatch(farmId: string): Promise<Map<string, number>> {
  const sales = await queryAll({
    TableName: tables.sales,
    KeyConditionExpression: "farmId = :f",
    FilterExpression: "product = :birds",
    ExpressionAttributeValues: { ":f": farmId, ":birds": "birds" },
    ProjectionExpression: "batchId, quantity",
  });
  const sold = new Map<string, number>();
  for (const s of sales) {
    if (typeof s.batchId === "string") sold.set(s.batchId, (sold.get(s.batchId) ?? 0) + (Number(s.quantity) || 0));
  }
  return sold;
}

export async function birdsLost(batchId: string): Promise<number> {
  const logs = await queryAll({
    TableName: tables.mortalityLogs,
    KeyConditionExpression: "batchId = :b",
    ExpressionAttributeValues: { ":b": batchId },
    ProjectionExpression: "#c",
    ExpressionAttributeNames: { "#c": "count" },
  });
  return logs.reduce((sum, l) => sum + (Number(l.count) || 0), 0);
}

export function flockCount(birdCount: unknown, lost: number, sold: number): FlockCount {
  return {
    birdsLost: lost,
    birdsSoldToDate: sold,
    currentBirds: Math.max(0, (Number(birdCount) || 0) - lost - sold),
  };
}
