import { tables } from "../../lib/dynamo";
import { makeLogResourceHandler } from "../../lib/logResourceHandler";
import { pickOptional } from "../../lib/optionalFields";

// GET/POST /batches/{id}/supplements: vitamins, supplements and dewormers
// given to a batch (frontend SupplementModal). Stored server-side so the
// daily farm-alerts job can push "withdrawal period over".
export const handler = makeLogResourceHandler({
  tableName: tables.supplements,
  allowFutureDate: true,
  buildItem: (_batchId, body) => {
    if (!body.date || typeof body.type !== "string" || typeof body.product !== "string" || !body.product.trim()) {
      return { error: "date, type, and product are required" };
    }
    return {
      date: body.date,
      type: body.type.slice(0, 40),
      product: body.product.trim().slice(0, 120),
      ...pickOptional(body, {
        method: "string",
        doseAmount: "number",
        doseUnit: "string",
        perQuantity: "number",
        durationDays: "number",
        reason: "string",
        withdrawalDays: "number",
        costNaira: "number",
        notes: "string",
        dosage: "string",
        stockKey: "string",
        packsUsed: "number",
      }),
    };
  },
});
