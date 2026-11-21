import type { SupabaseClient } from '@supabase/supabase-js';
import { pushSubscribe, pushUnsubscribe } from './api';
import { base64UrlToBytes, deviceLabel, pushSupport } from './push.mjs';

export type AlertState = 'not-configured' | 'ios-needs-install' | 'unsupported' | 'blocked' | 'available' | 'on';
const VAPID = (import.meta.env.VITE_ACADEMY_VAPID_PUBLIC_KEY as string | undefined) ?? '';

function environment() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    hasServiceWorker: 'serviceWorker' in navigator, hasPushManager: 'PushManager' in window, hasNotification: 'Notification' in window,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true,
    isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1),
    vapidKey: VAPID, permission: 'Notification' in window ? Notification.permission : 'default'
  };
}
async function registration() {
  return navigator.serviceWorker.getRegistration().then(r => r ?? null).catch(() => null);
}

export async function alertState(): Promise<AlertState> {
  const base = pushSupport(environment()) as AlertState;
  if (base !== 'available') return base;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return sub && Notification.permission === 'granted' ? 'on' : 'available';
}

export async function turnOnAlerts(client: SupabaseClient): Promise<AlertState> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'available';
  const reg = await registration();
  if (!reg) throw Error('Alerts work in the installed Hub. Open it from your home screen and try again.');
  const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID) });
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  await pushSubscribe(client, json.endpoint ?? sub.endpoint, json.keys?.p256dh ?? '', json.keys?.auth ?? '', deviceLabel(navigator.userAgent));
  return 'on';
}

/** Turn alerts off on this device. Also used at sign-out, so a shared device stops getting the previous person's alerts. */
export async function turnOffAlerts(client: SupabaseClient): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  await pushUnsubscribe(client, sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
