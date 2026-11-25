import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBatches } from '../context/BatchContext';
import { getMedicinePurchases } from '../api/medicineStock';
import { getVaccinationRecords } from '../api/vaccinations';
import { computeMedicineStock } from './medicineStock';
import { loadSupplements, SUPPLEMENTS_CHANGED_EVENT } from './supplements';

/**
 * The farm's vaccine and vitamin store: purchases, plus every batch record
 * that took from it. Stock is farm-wide, so all batches' records are read.
 * `enabled` lets a form load only when it opens.
 */
export function useMedicineStock({ enabled = true } = {}) {
  const { batches } = useBatches();
  const [purchases, setPurchases] = useState([]);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const names = Object.fromEntries(batches.map((b) => [b.batchId, b.name]));
      const [bought, vaccineRecords] = await Promise.all([
        getMedicinePurchases().catch(() => []),
        Promise.all(
          batches.map((b) =>
            getVaccinationRecords(b.batchId)
              .then((r) => (r.logs || []).map((x) => ({ ...x, batchId: b.batchId })))
              .catch(() => [])
          )
        ).then((lists) => lists.flat()),
      ]);
      const vaccineUse = vaccineRecords
        .filter((r) => r.stockKey)
        .map((r) => ({ stockKey: r.stockKey, units: Number(r.vialsUsed) || 0, date: r.dateAdministered, batchName: names[r.batchId], name: r.vaccineName }));
      const vitaminUse = loadSupplements()
        .filter((s) => s.stockKey)
        .map((s) => ({ stockKey: s.stockKey, units: Number(s.packsUsed) || 0, date: s.date, batchName: s.batchName || names[s.batchId], name: s.product }));
      setPurchases(bought);
      setUsage([...vaccineUse, ...vitaminUse].sort((a, b) => (b.date || '').localeCompare(a.date || '')));
    } finally {
      setLoading(false);
    }
  }, [batches]);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  // Vitamin records live in a local cache that syncs in the background.
  useEffect(() => {
    if (!enabled) return undefined;
    window.addEventListener(SUPPLEMENTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(SUPPLEMENTS_CHANGED_EVENT, load);
  }, [enabled, load]);

  const lines = useMemo(() => computeMedicineStock(purchases, usage), [purchases, usage]);

  return {
    purchases,
    usage,
    lines,
    loading,
    reload: load,
    addPurchase: (p) => setPurchases((prev) => [p, ...prev]),
  };
}
