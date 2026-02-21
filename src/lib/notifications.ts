/* ââ Email Notification Utility ââ */
import { supabase } from './supabase';

const NOTIFY_ENDPOINT = '/.netlify/functions/send-notification';

/**
 * Fire-and-forget notification when a project or order status changes.
 * Never throws â failures are silently logged so the UI stays unblocked.
 */
export async function notifyStatusChange(
  type: 'project' | 'order',
  id: string,
  oldStatus: string,
  newStatus: string,
  note?: string,
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn('[notify] No active session â skipping notification');
      return;
    }

    const res = await fetch(NOTIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type, id, oldStatus, newStatus, note }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`[notify] ${res.status}:`, body);
    }
  } catch (err) {
    console.warn('[notify] Failed to send notification:', err);
  }
}
