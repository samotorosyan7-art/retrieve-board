'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/components/store';
import { PageHeader, Photo } from '@/components/ui';
import { CHAT_ROOMS } from '@/lib/constants';
import { dmRoom } from '@/lib/helpers';
import { MessagesSquareIcon, SendHorizontalIcon } from 'lucide-react';

export default function ChatPage() {
  const { team, currentUser, chatMessages, chatUnreadByRoom, loadRoom, sendMessage, setActiveChatRoom } = useStore();
  const [room, setRoom] = useState('general');
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const rooms = CHAT_ROOMS.filter(r => !r.billingOnly || currentUser?.isAdmin);
  const msgs = chatMessages[room] || [];

  // The open room counts as read; leaving the page stops that.
  // Messages that arrived while the tab was in the background are read when it comes back.
  useEffect(() => {
    setActiveChatRoom(room);
    const onVisible = () => { if (!document.hidden) setActiveChatRoom(room); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); setActiveChatRoom(null); };
  }, [room, setActiveChatRoom]);

  useEffect(() => {
    let live = true;
    loadRoom(room).then(() => { if (live) setLoaded(l => ({ ...l, [room]: true })); });
    return () => { live = false; };
  }, [room, loadRoom]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, room]);

  const channel = rooms.find(r => r.id === room);
  const ChannelIcon = channel?.icon ?? MessagesSquareIcon;
  let roomName = channel ? `# ${channel.name}` : '';
  let roomDesc = channel?.desc || '';
  if (room.startsWith('dm_')) {
    const other = room.slice(3).split('__').find(id => id !== currentUser?.id);
    roomName = team.find(e => e.id === other)?.name || 'Direct Message';
    roomDesc = 'Private direct message';
  }

  function send() {
    if (!text.trim()) return;
    sendMessage(room, text.trim());
    setText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }

  let lastDate = '';

  return (
    <div className="page active" id="page-chat">
      <PageHeader title="Team" light="Chat" sub="Real-time messaging · messages stored securely" />
      <div className="chat-layout">
        <div className="chat-sidebar">
          <div className="chat-sb-hdr">Channels</div>
          <div className="chat-room-list">
            {rooms.map(r => (
              <div key={r.id} className={`chat-room-row${room === r.id ? ' active' : ''}`} onClick={() => setRoom(r.id)}>
                <span className="chat-room-icon"><r.icon size={14} /></span>
                <div className="chat-room-name"># {r.name}</div>
                <UnreadBadge n={room === r.id ? 0 : chatUnreadByRoom[r.id]} />
              </div>
            ))}
          </div>
          <div className="chat-sb-hdr chat-dm-hdr">Direct Messages</div>
          <div className="chat-dm-list">
            {team.filter(e => e.id !== currentUser?.id).map(e => (
              <div key={e.id} className={`chat-room-row${room === dmRoom(currentUser!.id, e.id) ? ' active' : ''}`} onClick={() => setRoom(dmRoom(currentUser!.id, e.id))}>
                <div className="chat-msg-av" style={{ width: 22, height: 22, fontSize: 9, background: e.color }}>{e.init}</div>
                <div className="chat-room-name">{e.name.split(' ')[0]}</div>
                <UnreadBadge n={room === dmRoom(currentUser!.id, e.id) ? 0 : chatUnreadByRoom[dmRoom(currentUser!.id, e.id)]} />
              </div>
            ))}
          </div>
        </div>

        <div className="chat-main">
          {!loaded[room] && !chatMessages[room] ? (
            <div className="chat-empty"><MessagesSquareIcon size={28} />Loading messages…</div>
          ) : (
            <>
              <div className="chat-hdr">
                <ChannelIcon size={18} />
                <div><div className="chat-hdr-name">{roomName}</div><div className="chat-hdr-sub">{roomDesc}</div></div>
              </div>
              <div className="chat-messages" ref={listRef}>
                {msgs.length === 0 ? (
                  <div className="chat-empty"><ChannelIcon size={28} /><span>No messages yet — say hello!</span></div>
                ) : msgs.map(m => {
                  const e = team.find(x => x.id === m.who);
                  const isOwn = m.who === currentUser?.id;
                  const d = m.time ? new Date(m.time) : new Date();
                  const dateStr = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
                  const showDate = dateStr !== lastDate;
                  lastDate = dateStr;
                  return (
                    <div key={m.id} style={{ display: 'contents' }}>
                      {showDate && <div className="chat-date-divider">{dateStr}</div>}
                      <div className={`chat-msg${isOwn ? ' own' : ''}`}>
                        <div className="chat-msg-av" style={{ background: e?.color || '#64748B' }} title={e?.name || 'Unknown'}>
                          <Photo src={e?.img} />
                          {e?.init || '?'}
                        </div>
                        <div className="chat-msg-body">
                          <div className="chat-bubble">{m.text}</div>
                          <div className="chat-msg-meta">
                            {!isOwn && <><span>{e?.name.split(' ')[0] || ''}</span>·</>}
                            <span>{d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="chat-input-row">
                <textarea
                  ref={inputRef}
                  className="chat-input" rows={1} placeholder={`Message ${roomName}…`}
                  value={text}
                  onChange={e => {
                    setText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <button className="chat-send-btn" onClick={send}><SendHorizontalIcon size={16} /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UnreadBadge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="chat-unread-badge" title={`${n} unread`}>{n > 99 ? '99+' : n}</span>;
}
