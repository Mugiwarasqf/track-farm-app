import { api } from './client';

/** Vaccines and vitamins bought for the farm's store — see backend/src/handlers/medicineStock. */
export async function getMedicinePurchases() {
  const data = await api('GET', '/medicine-stock');
  return data?.purchases || [];
}

export function addMedicinePurchase(purchase) {
  return api('POST', '/medicine-stock', purchase);
}
