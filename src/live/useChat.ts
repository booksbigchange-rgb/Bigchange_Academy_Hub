import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ChatNotReady, chatConversations, type ChatConversation } from './api';

export type ChatList = { list: ChatConversation[]; ready: boolean | null; error: string; reload: () => Promise<void> };

/**
 * The signed-in staff member's conversations with unread counts, kept fresh by Supabase Realtime
 * (any new message I may see) plus a slow 60-second check as a backstop. Off for parents and students.
 */
export function useChatList(client: SupabaseClient, enabled: boolean): ChatList {
  const [list, setList] = useState<ChatConversation[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const reload = useCallback(async () => {
    if (!enabled || busy.current) return;
    busy.current = true;
    try { setList(await chatConversations(client)); setReady(true); setError(''); }
    catch (e) {
      if (e instanceof ChatNotReady) setReady(false);
      else setError(e instanceof Error ? e.message : 'Could not load chats');
    } finally { busy.current = false; }
  }, [client, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', onVisible);
    let channel: ReturnType<SupabaseClient['channel']> | null = null;
    try {
      channel = client.channel('academy-chat-list')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'academy_chat_messages' }, () => { void reload(); })
        .subscribe();
    } catch { channel = null; }
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel) void client.removeChannel(channel);
    };
  }, [client, enabled, reload]);

  return { list, ready, error, reload };
}
