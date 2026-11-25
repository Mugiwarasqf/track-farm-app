import { tables } from "../../lib/dynamo";
import { makeLogResourceHandler } from "../../lib/logResourceHandler";
import { pickOptional } from "../../lib/optionalFields";

export const handler = makeLogResourceHandler({
  tableName: tables.eggLogs,
  buildItem: (_batchId, body) => {
    const crates = typeof body.crates === "number" ? body.crates : Number(body.crates) || 0;
    const looseEggs = typeof body.looseEggs === "number" ? body.looseEggs : Number(body.looseEggs) || 0;
    if (crates <= 0 && looseEggs <= 0) {
      return { error: "crates or looseEggs is required and must be greater than 0" };
    }
    return {
      date: body.date ?? new Date().toISOString().slice(0, 10),
      crates,
      looseEggs,
      // Money from eggs sold, entered by the farmer (optional). Feeds the
      // summary's egg revenue; no price-per-crate is guessed.
      ...pickOptional(body, { revenueNaira: "number" }),
    };
  },
});
