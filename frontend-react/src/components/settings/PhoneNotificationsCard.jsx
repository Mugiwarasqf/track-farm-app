import { useCallback, useEffect, useState } from 'react';
import { BellRing, Share, SquarePlus } from 'lucide-react';
import { SettingsCard, ToggleRow, StatusPill } from './ui';
import { PUSH_CHANGED_EVENT, disablePush, enablePush, pushState } from '../../lib/push';

/** Tracks this phone's notification state, refreshed when it changes anywhere. */
export function usePushState() {
  const [state, setState] = useState('loading');
  const refresh = useCallback(() => {
    pushState().then(setState).catch(() => setState('unavailable'));
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener(PUSH_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener(PUSH_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refresh]);
  return [state, setState];
}

const NOTE = 'text-xs leading-relaxed text-stone-500 dark:text-[#94A3B8]';

/**
 * Settings → Notifications: phone notifications for THIS phone. Each phone is
 * turned on separately; the vaccination and logging switches below decide
 * which reminders it gets.
 */
export function PhoneNotificationsCard() {
  const [state, setState] = usePushState();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const toggle = async (turnOn) => {
    setWorking(true);
    setError('');
    try {
      setState(turnOn ? await enablePush() : await disablePush());
    } catch (err) {
      console.warn('Phone notifications change failed:', err);
      setError('Could not change this right now. Check your connection and try again.');
    } finally {
      setWorking(false);
    }
  };

  const on = state === 'on';
  const canToggle = state === 'on' || state === 'off';

  return (
    <SettingsCard
      title="Phone notifications"
      description="Reminders that pop up on this phone, even when TrackFarm is closed."
      action={
        state !== 'loading' && (
          <StatusPill tone={on ? 'active' : 'neutral'}>{on ? 'On' : 'Off'}</StatusPill>
        )
      }
    >
      {canToggle && (
        <ToggleRow
          icon={BellRing}
          title="Notifications on this phone"
          description="Vaccination and logging reminders at 7am, based on the switches below."
          checked={on}
          disabled={working}
          onChange={toggle}
        />
      )}

      {state === 'off' && (
        <p className={`${NOTE} mt-3`}>Your phone will ask you to allow notifications from TrackFarm.</p>
      )}
      {state === 'on' && (
        <p className={`${NOTE} mt-3`}>
          Turn this on separately on each phone you use. Emails still arrive as well, unless you pause them below.
        </p>
      )}

      {state === 'blocked' && (
        <p className={NOTE}>
          Notifications for TrackFarm are blocked on this phone. To allow them, open your browser’s settings for
          trackfarm.cc, choose <span className="font-semibold text-stone-700 dark:text-[#CBD5E1]">Notifications</span>{' '}
          and set it to Allow. Then come back here.
        </p>
      )}

      {state === 'needs-install' && (
        <div className={NOTE}>
          <p>On iPhone, notifications only work once TrackFarm is on your home screen.</p>
          <ol className="mt-2 space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="font-semibold text-stone-700 dark:text-[#CBD5E1]">1.</span> Tap
              <Share size={14} className="text-[#0a84ff]" aria-label="Share" /> Share in Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-stone-700 dark:text-[#CBD5E1]">2.</span> Tap
              <SquarePlus size={14} className="text-[#0a84ff]" aria-hidden="true" />
              <span className="font-semibold text-stone-700 dark:text-[#CBD5E1]">Add to Home Screen</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-stone-700 dark:text-[#CBD5E1]">3.</span> Open TrackFarm from your
              home screen and turn this on
            </li>
          </ol>
        </div>
      )}

      {state === 'unsupported' && (
        <p className={NOTE}>
          This browser can’t show phone notifications. Use Chrome on Android, or Safari on iPhone with TrackFarm added
          to your home screen.
        </p>
      )}

      {state === 'unavailable' && (
        <p className={NOTE}>Phone notifications aren’t available here yet. Your reminders still arrive by email.</p>
      )}

      {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </SettingsCard>
  );
}

export default PhoneNotificationsCard;
