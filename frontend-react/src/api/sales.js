import { api } from './client';

/** Birds and eggs sold — see backend/src/handlers/sales. */
export async function getSales() {
  const data = await api('GET', '/sales');
  return data?.sales || [];
}

/** Eggs in store (collected − sold): { eggsLeft, byBatch }, in single eggs. */
export async function getEggStock() {
  const data = await api('GET', '/sales');
  return data?.eggStock || null;
}

export function createSale(sale) {
  return api('POST', '/sales', sale);
}

export function deleteSale(entryId) {
  return api('DELETE', `/sales/${entryId}`);
}
