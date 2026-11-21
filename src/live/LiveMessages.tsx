import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  chatDelete, chatHandleReport, chatMarkRead, chatMessages, chatOpenReport, chatParticipants, chatReport, chatReportList, chatSend,
  chatStaffDirectory, chatStartDirect, myStaffId, chatUpload, chatSendFile, chatAttachments, chatReportFiles, chatSignedUrls, type ChatAttachment, type ChatConversation, type ChatMessage, type ChatOpenedMessage, type ChatPerson, type ChatReport
} from './api';
import { canDelete, canShrink, chatTime, conversationKind, FILE_ACCEPT, FILE_TYPES, formatSize, isPhoto, linkLabel, storagePath, validateFile, validateMessage } from './chat.mjs';
import { shrinkPhoto } from './shrink';
import type { ChatList } from './useChat';
import { formatDate } from './fees.mjs';

const errorText = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong';

/** Staff chat: conversation list, one conversation, new one-to-one chat, and (admin) reported messages. */
export default function LiveMessages({ client, isAdmin, chat }: { client: SupabaseClient; isAdmin: boolean; chat: ChatList }) {
  const [openId, setOpenId] = useState('');
  const [view, setView] = useState<'chats' | 'new' | 'reports'>('chats');
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { void myStaffId(client).then(setMe).catch(() => setMe(null)); }, [client]);

  if (chat.ready === false) return <section className="panel" aria-label="Messages"><span className="eyebrow">MESSAGES</span><h2>Chat is not switched on yet</h2>
    <p>Staff chat needs database update <strong>0011</strong>. An administrator runs it once in Supabase (see the owner checklist). Everything else keeps working.</p></section>;

  const open = chat.list.find(c => c.conversation_id === openId) ?? null;
  return <section className={'panel chat' + (open || view === 'new' ? ' chat-has-open' : '')} aria-label="Messages">
    <div className="chat-head">
      <div><span className="eyebrow">MESSAGES</span><h2>Staff chat</h2></div>
      <div className="chat-tabs" role="group" aria-label="Messages view">
        <button className={view !== 'reports' ? 'small-btn active' : 'small-btn'} aria-pressed={view !== 'reports'} onClick={() => setView('chats')}>Chats</button>
        {isAdmin && <button className={view === 'reports' ? 'small-btn active' : 'small-btn'} aria-pressed={view === 'reports'} onClick={() => { setView('reports'); setOpenId(''); }}>Reported messages</button>}
      </div>
    </div>
    {chat.error && <p className="ops-feedback" role="alert">{chat.error} <button className="small-btn" onClick={() => void chat.reload()}>Retry</button></p>}
    {view === 'reports' ? <Reports client={client} /> : <div className="chat-layout">
      <div className="chat-list-pane">
        <button className="primary-btn chat-new" onClick={() => { setView('new'); setOpenId(''); }}>+ New chat</button>
        {chat.ready === null && <p role="status">Loading chats…</p>}
        <ul className="chat-list" aria-label="Conversations">
          {chat.list.map(c => <li key={c.conversation_id}>
            <button className={'chat-item' + (c.conversation_id === openId ? ' active' : '')} aria-current={c.conversation_id === openId ? 'true' : undefined}
              onClick={() => { setOpenId(c.conversation_id); setView('chats'); }}>
              <span className="chat-avatar" aria-hidden="true">{initials(c.title)}</span>
              <span className="chat-item-main">
                <span className="chat-item-top"><strong>{c.title}</strong><span className="chat-time">{chatTime(c.last_message_at)}</span></span>
                <span className="chat-item-sub">{c.last_preview ? <>{c.kind === 'group' && c.last_sender_name ? c.last_sender_name + ': ' : ''}{c.last_preview}</> : <em>{conversationKind(c)} · no messages yet</em>}</span>
              </span>
              {c.unread > 0 && <span className="chat-unread">{c.unread}<span className="sr-only"> unread</span></span>}
            </button>
          </li>)}
        </ul>
      </div>
      <div className="chat-main-pane">
        {view === 'new' ? <NewChat client={client} onStarted={async id => { await chat.reload(); setOpenId(id); setView('chats'); }} onCancel={() => setView('chats')} />
          : open ? <Conversation key={open.conversation_id} client={client} conv={open} me={me} onBack={() => setOpenId('')} onChanged={chat.reload} />
          : <div className="chat-empty"><p>Choose a chat on the left, or start a new one.</p></div>}
      </div>
    </div>}
  </section>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
}

function NewChat({ client, onStarted, onCancel }: { client: SupabaseClient; onStarted: (id: string) => Promise<void>; onCancel: () => void }) {
  const [people, setPeople] = useState<ChatPerson[] | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void chatStaffDirectory(client).then(setPeople).catch(e => { setPeople([]); setMessage(errorText(e)); }); }, [client]);
  async function start(p: ChatPerson) {
    if (busy) return; setBusy(true); setMessage('');
    try { await onStarted(await chatStartDirect(client, p.staff_id)); } catch (e) { setMessage(errorText(e)); } finally { setBusy(false); }
  }
  return <div className="chat-new-pane">
    <div className="chat-conv-head"><button className="small-btn" onClick={onCancel}>Back</button><h3>New one-to-one chat</h3></div>
    {message && <p className="ops-feedback" role="alert">{message}</p>}
    {people === null ? <p role="status">Loading staff…</p> : people.length === 0 ? <p>No other active staff yet.</p>
      : <ul className="chat-list" aria-label="Staff">{people.map(p => <li key={p.staff_id}>
          <button className="chat-item" disabled={busy} onClick={() => void start(p)}>
            <span className="chat-avatar" aria-hidden="true">{initials(p.display_name)}</span>
            <span className="chat-item-main"><strong>{p.display_name}</strong><span className="chat-item-sub">{p.role}</span></span>
          </button></li>)}</ul>}
  </div>;
}

function MessageLink({ url }: { url: string }) {
  return <a className="chat-link" href={url} target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🔗</span> {linkLabel(url)}<span className="sr-only"> (opens in a new tab)</span></a>;
}

type Signed = Record<string, string>;
/** A sent file: photos show as a picture, other files as a card. Links last one hour; reopening the chat renews them. */
function Attachment({ a, url }: { a: Omit<ChatAttachment, 'id'>; url?: string }) {
  const label = FILE_TYPES[a.mime_type as keyof typeof FILE_TYPES] ?? 'File';
  if (isPhoto(a.mime_type) && url && a.mime_type !== 'image/heic')
    return <a className="chat-photo" href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt={'Photo: ' + a.file_name} loading="lazy" /><span className="sr-only"> (opens in a new tab)</span></a>;
  const inner = <><span className="chat-file-icon" aria-hidden="true">{label === 'Photo' ? '🖼' : '📄'}</span>
    <span className="chat-file-main"><strong>{a.file_name}</strong><span className="chat-item-sub">{label} · {formatSize(a.size_bytes)}</span></span></>;
  return url ? <a className="chat-file" href={url} target="_blank" rel="noopener noreferrer">{inner}<span className="sr-only"> (opens in a new tab)</span></a>
    : <span className="chat-file">{inner}</span>;
}

function Conversation({ client, conv, me, onBack, onChanged }: { client: SupabaseClient; conv: ChatConversation; me: string | null; onBack: () => void; onChanged: () => Promise<void> }) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [showPeople, setShowPeople] = useState(false);
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<ChatAttachment[]>([]);
  const [signed, setSigned] = useState<Signed>({});
  const [progress, setProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportFor, setReportFor] = useState('');
  const [reason, setReason] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const id = conv.conversation_id;

  const load = useCallback(async () => {
    try {
      const [list, attached] = await Promise.all([chatMessages(client, id), chatAttachments(client, id)]);
      setMessages(list); setFiles(attached);
      const missing = attached.map(a => a.storage_path);
      if (missing.length) void chatSignedUrls(client, missing).then(setSigned);
      if (document.visibilityState === 'visible') { await chatMarkRead(client, id); void onChanged(); }
    } catch (e) { setFeedback(errorText(e)); setMessages(m => m ?? []); }
  }, [client, id, onChanged]);

  useEffect(() => {
    void load();
    void chatParticipants(client, id).then(setPeople).catch(() => setPeople([]));
    let channel: ReturnType<SupabaseClient['channel']> | null = null;
    try {
      channel = client.channel('academy-chat-' + id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'academy_chat_messages', filter: 'conversation_id=eq.' + id }, () => { void load(); })
        .subscribe();
    } catch { channel = null; }
    return () => { if (channel) void client.removeChannel(channel); };
  }, [client, id, load]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages?.length]);

  const names = new Map(people.map(p => [p.staff_id, p.display_name]));
  async function act(task: () => Promise<unknown>, ok = '') {
    if (busy) return false; setBusy(true); setFeedback('');
    try { await task(); await load(); if (ok) setFeedback(ok); return true; } catch (e) { setFeedback(errorText(e)); return false; } finally { setBusy(false); }
  }
  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (file) { await sendFile(file); return; }
    let args: { p_body: string | null; p_link: string | null };
    try { args = validateMessage(body, link); } catch (e) { setFeedback(errorText(e)); return; }
    if (await act(() => chatSend(client, id, args))) { setBody(''); setLink(''); setShowLink(false); }
  }
  async function sendFile(chosen: File) {
    let type: string;
    try { type = validateFile(chosen); if (body.trim().length > 4000) throw Error('Message is too long (4,000 characters at most)'); }
    catch (e) { setFeedback(errorText(e)); return; }
    const ok = await act(async () => {
      let blob: Blob = chosen, name = chosen.name;
      if (canShrink(type)) { setProgress('Making the photo smaller…'); const s = await shrinkPhoto(chosen); blob = s.blob; type = s.type; name = s.name; }
      setProgress('Uploading ' + name + '…');
      const path = storagePath(id, crypto.randomUUID(), name);
      await chatUpload(client, path, blob, type);
      setProgress('Sending…');
      await chatSendFile(client, id, body.trim() || null, path, name.slice(0, 200));
    });
    setProgress('');
    if (ok) { setBody(''); setFile(null); if (fileRef.current) fileRef.current.value = ''; }
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }
  async function report(event: FormEvent) {
    event.preventDefault();
    if (await act(() => chatReport(client, reportFor, reason), 'Reported. An administrator will look at it.')) { setReportFor(''); setReason(''); }
  }

  return <div className="chat-conv">
    <div className="chat-conv-head">
      <button className="small-btn chat-back" onClick={onBack}>Back<span className="sr-only"> to chats</span></button>
      <div className="chat-conv-title"><h3>{conv.title}</h3><span className="chat-item-sub">{conversationKind(conv)}{people.length ? ` · ${people.length} ${people.length === 1 ? 'person' : 'people'}` : ''}</span></div>
      <button className="small-btn" aria-expanded={showPeople} onClick={() => setShowPeople(v => !v)}>Members</button>
    </div>
    {showPeople && <ul className="chat-people" aria-label="Members">{people.map(p => <li key={p.staff_id}>{p.display_name} <span className="chat-item-sub">· {p.role}</span></li>)}</ul>}
    <div className="chat-messages" role="log" aria-live="polite" aria-label={'Messages in ' + conv.title}>
      {messages === null && <p role="status">Loading messages…</p>}
      {messages?.length === 0 && <p className="chat-empty">No messages yet. Say hello.</p>}
      {messages?.map(m => {
        const mine = m.sender_staff_id === me;
        return <div key={m.id} className={'chat-msg' + (mine ? ' mine' : '')}>
          {!mine && <span className="chat-sender">{names.get(m.sender_staff_id) ?? 'Former staff member'}</span>}
          {m.deleted_at ? <p className="chat-deleted">Message deleted</p> : <>
            {m.body && <p className="chat-body">{m.body}</p>}
            {m.link_url && <MessageLink url={m.link_url} />}
            {files.filter(a => a.message_id === m.id).map(a => <Attachment key={a.id} a={a} url={signed[a.storage_path]} />)}
          </>}
          <span className="chat-meta">
            <time dateTime={m.created_at}>{chatTime(m.created_at)}</time>
            {canDelete(m, me) && <button className="link-btn" disabled={busy} onClick={() => void act(() => chatDelete(client, m.id), 'Message deleted.')}>Delete</button>}
            {!mine && !m.deleted_at && <button className="link-btn" disabled={busy} onClick={() => { setReportFor(m.id); setReason(''); }}>Report</button>}
          </span>
          {reportFor === m.id && <form className="chat-report" onSubmit={e => void report(e)}>
            <label>Why are you reporting this message?<textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} required minLength={3} rows={2} /></label>
            <p className="chat-item-sub">An administrator will be able to read this conversation. Each time they open it is recorded.</p>
            <div className="chat-report-actions"><button className="primary-btn" disabled={busy}>Send report</button><button type="button" className="small-btn" onClick={() => setReportFor('')}>Cancel</button></div>
          </form>}
        </div>;
      })}
      <div ref={endRef} />
    </div>
    {feedback && <p className="ops-feedback" role="status">{feedback}</p>}
    <form className="chat-compose" onSubmit={e => void send(e)}>
      <label className="sr-only" htmlFor={'chat-body-' + id}>Message</label>
      <textarea id={'chat-body-' + id} value={body} onChange={e => setBody(e.target.value)} onKeyDown={onKey} rows={2} maxLength={4000} placeholder="Write a message" />
      {showLink && <label className="chat-link-field">Google Drive or https link<input type="url" inputMode="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://drive.google.com/…" /></label>}
      {file && <p className="chat-chosen"><span>📎 <strong>{file.name}</strong> · {formatSize(file.size)}</span>
        <button type="button" className="link-btn" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>Remove<span className="sr-only"> file</span></button></p>}
      {progress && <p role="status" className="chat-item-sub">{progress}</p>}
      <input ref={fileRef} id={'chat-file-' + id} className="sr-only" type="file" accept={FILE_ACCEPT}
        onChange={e => { const f = e.target.files?.[0] ?? null; setFeedback(''); if (f) { try { validateFile(f); setFile(f); setShowLink(false); setLink(''); } catch (err) { setFeedback(errorText(err)); e.target.value = ''; } } }} />
      <div className="chat-compose-actions">
        <label htmlFor={'chat-file-' + id} className="small-btn chat-attach">Photo or file</label>
        <button type="button" className="small-btn" aria-expanded={showLink} onClick={() => setShowLink(v => !v)}>{showLink ? 'Remove link' : 'Add link'}</button>
        <button className="primary-btn" disabled={busy}>Send</button>
      </div>
    </form>
  </div>;
}

function Reports({ client }: { client: SupabaseClient }) {
  const [list, setList] = useState<ChatReport[] | null>(null);
  const [message, setMessage] = useState('');
  const [opened, setOpened] = useState<{ report: ChatReport; messages: ChatOpenedMessage[]; files: Omit<ChatAttachment, 'id'>[]; signed: Signed } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setList(await chatReportList(client)); } catch (e) { setList([]); setMessage(errorText(e)); } }, [client]);
  useEffect(() => { void load(); }, [load]);
  async function open(r: ChatReport) {
    if (busy) return; setBusy(true); setMessage('');
    try {
      const messages = await chatOpenReport(client, r.report_id);
      const files = await chatReportFiles(client, r.report_id);
      setOpened({ report: r, messages, files, signed: await chatSignedUrls(client, files.map(f => f.storage_path)) }); setNote(''); await load();
    } catch (e) { setMessage(errorText(e)); } finally { setBusy(false); }
  }
  async function handle(event: FormEvent) {
    event.preventDefault(); if (!opened || busy) return; setBusy(true); setMessage('');
    try { await chatHandleReport(client, opened.report.report_id, note); setOpened(null); setMessage('Report marked as handled.'); await load(); } catch (e) { setMessage(errorText(e)); } finally { setBusy(false); }
  }
  if (opened) return <div className="chat-conv">
    <div className="chat-conv-head"><button className="small-btn" onClick={() => setOpened(null)}>Back<span className="sr-only"> to reports</span></button>
      <div className="chat-conv-title"><h3>Reported conversation</h3><span className="chat-item-sub">Opened by you · this opening is recorded</span></div></div>
    <p><strong>Reason:</strong> {opened.report.reason} <span className="chat-item-sub">— reported by {opened.report.reporter_name}, {formatDate(opened.report.created_at.slice(0, 10))}</span></p>
    <div className="chat-messages" aria-label="Reported conversation">
      {opened.messages.map(m => <div key={m.message_id} className={'chat-msg' + (m.reported ? ' reported' : '')}>
        <span className="chat-sender">{m.sender_name}{m.reported && <strong> · reported</strong>}</span>
        {m.deleted ? <p className="chat-deleted">Message deleted</p> : <>{m.body && <p className="chat-body">{m.body}</p>}{m.link_url && <MessageLink url={m.link_url} />}
          {opened.files.filter(a => a.message_id === m.message_id).map(a => <Attachment key={a.storage_path} a={a} url={opened.signed[a.storage_path]} />)}</>}
        <span className="chat-meta"><time dateTime={m.created_at}>{chatTime(m.created_at)}</time></span>
      </div>)}
    </div>
    {message && <p className="ops-feedback" role="status">{message}</p>}
    {!opened.report.handled_at && <form className="chat-report" onSubmit={e => void handle(e)}>
      <label>What did you do? (optional note, kept with the report)<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={2} /></label>
      <button className="primary-btn" disabled={busy}>Mark as handled</button>
    </form>}
  </div>;
  return <div>
    <p>Messages that staff reported. Opening one shows you that conversation, and <strong>every opening is recorded</strong>.</p>
    {message && <p className="ops-feedback" role="status">{message}</p>}
    {list === null ? <p role="status">Loading reports…</p> : list.length === 0 ? <p className="chat-empty">No reported messages.</p>
      : <ul className="chat-reports" aria-label="Reported messages">{list.map(r => <li key={r.report_id} className={r.handled_at ? 'handled' : ''}>
          <div><strong>{r.handled_at ? 'Handled' : 'Open'}</strong> · {formatDate(r.created_at.slice(0, 10))} · reported by {r.reporter_name}</div>
          <div>Message from <strong>{r.sender_name}</strong>: “{r.message_preview ?? ''}”</div>
          <div>Reason: {r.reason}</div>
          {r.handled_note && <div className="chat-item-sub">Note: {r.handled_note}</div>}
          <div className="chat-item-sub">Opened {r.times_opened} {r.times_opened === 1 ? 'time' : 'times'}</div>
          <button className="small-btn" disabled={busy} onClick={() => void open(r)}>Open conversation</button>
        </li>)}</ul>}
  </div>;
}
