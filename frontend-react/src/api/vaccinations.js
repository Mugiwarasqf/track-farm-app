import { createLog, getLogs } from './logs';
import { updateSchedule } from './schedule';

/** Vaccinations recorded as given (the backward-looking history). */
export function getVaccinationRecords(batchId) {
  return getLogs(batchId, 'vaccinations');
}

/**
 * Saves what the vaccination form produced.
 *
 * mode 'schedule' → a future due date on the vaccination schedule, which the
 * daily reminder job picks up. Queueable offline like the logs below — the
 * on-device queue doesn't know a "schedule" shape, so a queued result here
 * is reshaped to look like the server's own response (scheduleId, status)
 * rather than leaking the generic log-entry fields into schedule-reading UI.
 * mode 'record' → a vaccination that was actually given, in the history.
 * When it fulfils a scheduled one (scheduleId), that schedule is also marked
 * done so it stops showing as due.
 */
export async function saveVaccination({ mode, batchId, scheduleId, ...fields }) {
  if (mode === 'schedule') {
    const result = await createLog(batchId, 'vaccination-schedule', fields);
    const item = result.queued
      ? { ...fields, batchId, scheduleId: result.entryId, status: 'upcoming', createdAt: result.createdAt, queued: true, pending: true }
      : result;
    return { mode, item };
  }

  const item = await createLog(batchId, 'vaccinations', { ...fields, ...(scheduleId ? { scheduleId } : {}) });
  if (scheduleId) {
    try {
      await updateSchedule(batchId, scheduleId, { status: 'done' });
    } catch (err) {
      // The record itself saved; the schedule will still show as due, which
      // is the safer failure than losing the record.
      console.warn('Could not mark schedule as done:', err);
    }
  }
  return { mode, item };
}
