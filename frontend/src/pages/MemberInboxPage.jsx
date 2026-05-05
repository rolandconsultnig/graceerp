import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../context/authStore';
import { memberPortalAPI } from '../services/api';
import { PageHeader, Card, Button, Spinner, NoticeBanner } from '../components/UI';
import PortalWebRtcDock from '../components/PortalWebRtcDock';
import { usePortalChat } from '../hooks/usePortalChat';

const STAFF_ROLES = ['super_admin', 'branch_admin', 'pastor'];

export default function MemberInboxPage() {
  const user = useAuthStore((s) => s.user);
  const [inbox, setInbox] = useState([]);
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState([]);
  const [threadMember, setThreadMember] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const notify = (type, text) => setNotice({ type, text });
  const [peerTyping, setPeerTyping] = useState(false);
  const typingHideRef = useRef(null);
  const bottomRef = useRef(null);

  const canAccess = user && STAFF_ROLES.includes(user.role);

  const loadInbox = useCallback(async () => {
    try {
      const res = await memberPortalAPI.staffInbox();
      setInbox(res.data?.data ?? []);
    } catch {
      setInbox([]);
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  useEffect(() => {
    if (!canAccess) return undefined;
    loadInbox();
    const id = setInterval(loadInbox, 12000);
    return () => clearInterval(id);
  }, [canAccess, loadInbox]);

  const loadThread = useCallback(async (memberId) => {
    if (!memberId) return;
    setLoadingThread(true);
    try {
      const res = await memberPortalAPI.staffThread(memberId);
      setThread(res.data?.data ?? []);
      setThreadMember(res.data?.member ?? null);
    } catch {
      setThread([]);
      setThreadMember(null);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setThread([]);
      setThreadMember(null);
      return;
    }
    loadThread(selectedId);
  }, [selectedId, loadThread]);

  const refreshThread = useCallback(() => {
    if (selectedId) loadThread(selectedId);
  }, [selectedId, loadThread]);

  const portalChat = usePortalChat({
    memberId: selectedId,
    role: 'staff',
    enabled: !!selectedId && canAccess,
    onRefresh: refreshThread,
  });

  useEffect(() => {
    if (!selectedId || !canAccess) return undefined;
    const ms = portalChat.wsConnected ? 45000 : 5000;
    const id = setInterval(() => loadThread(selectedId), ms);
    return () => clearInterval(id);
  }, [selectedId, loadThread, canAccess, portalChat.wsConnected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  useEffect(() => {
    return portalChat.subscribeSignals((msg) => {
      if (msg.type !== 'typing') return;
      if (msg.fromRole !== 'member') return;
      setPeerTyping(true);
      if (typingHideRef.current) clearTimeout(typingHideRef.current);
      typingHideRef.current = setTimeout(() => setPeerTyping(false), 2600);
    });
  }, [portalChat.subscribeSignals]);

  useEffect(
    () => () => {
      if (typingHideRef.current) clearTimeout(typingHideRef.current);
    },
    []
  );

  useEffect(() => {
    setPeerTyping(false);
  }, [selectedId]);

  const sendReply = async (e) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    try {
      await memberPortalAPI.staffReply(selectedId, text);
      setReply('');
      await loadThread(selectedId);
      await loadInbox();
      notify('success', 'Reply sent.');
    } catch (err) {
      notify('error', err.response?.data?.message || 'Could not send.');
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      <PageHeader
        title="Member chat inbox"
        subtitle="Conversations from the member portal"
      />

      {notice && <NoticeBanner type={notice.type}>{notice.text}</NoticeBanner>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[min(520px,80dvh)] lg:min-h-[480px]">
        <Card className="lg:col-span-2 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 font-semibold text-gray-800">Members</div>
          <div className="flex-1 overflow-y-auto max-h-[min(560px,65vh)]">
            {loadingInbox ? (
              <Spinner />
            ) : inbox.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No conversations yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {inbox.map((row) => (
                  <li key={row.member_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.member_id)}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-purple-50 transition-colors ${
                        selectedId === row.member_id ? 'bg-purple-50 border-l-4 border-purple-600' : 'border-l-4 border-transparent'
                      }`}
                    >
                      <p className="font-medium text-gray-800">
                        {row.first_name} {row.last_name}
                        <span className="text-gray-400 font-normal ml-1">{row.member_code}</span>
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{row.branch_name}</p>
                      <p className="text-xs text-gray-400 truncate mt-1">{row.last_preview}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {row.last_message_at ? new Date(row.last_message_at).toLocaleString() : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-3 flex flex-col overflow-hidden min-h-[320px] lg:min-h-[min(520px,75dvh)]">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500 p-8">Select a member to view messages.</div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-100 flex flex-wrap items-baseline justify-between gap-2 shrink-0">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {threadMember
                      ? `${threadMember.first_name} ${threadMember.last_name}`
                      : 'Member'}
                  </h3>
                  {threadMember?.member_code && (
                    <p className="text-xs text-gray-500">Code {threadMember.member_code}</p>
                  )}
                </div>
              </div>
              <PortalWebRtcDock
                subscribeSignals={portalChat.subscribeSignals}
                sendSignal={portalChat.sendSignal}
                wsConnected={portalChat.wsConnected}
                selfRole="staff"
              />
              {peerTyping && (
                <div className="px-4 py-1.5 text-xs text-purple-700 bg-purple-50/90 border-b border-purple-100 shrink-0">
                  Member is typing…
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-gray-50/80">
                {loadingThread ? (
                  <Spinner />
                ) : (
                  <>
                    {thread.map((m) => {
                      const staff = m.is_staff;
                      return (
                        <div key={m.id} className={`flex ${staff ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                              staff
                                ? 'bg-purple-600 text-white rounded-br-md'
                                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                            }`}
                          >
                            {staff && (
                              <p className="text-xs font-semibold text-purple-200 mb-1">{m.staff_name || 'Staff'}</p>
                            )}
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <p className={`text-[10px] mt-1.5 ${staff ? 'text-purple-200' : 'text-gray-400'}`}>
                              {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>
              <form onSubmit={sendReply} className="p-4 border-t border-gray-100 flex gap-2 bg-white shrink-0">
                <input
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  placeholder="Reply…"
                  value={reply}
                  onChange={(e) => {
                    const v = e.target.value;
                    setReply(v);
                    if (v.trim()) portalChat.sendTyping();
                  }}
                />
                <Button type="submit" disabled={sending || !reply.trim()}>
                  Send
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
