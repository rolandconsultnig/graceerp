import { useCallback, useEffect, useRef, useState } from 'react';
import { memberPortalAPI } from '../services/api';
import { PageHeader, Card, Button, Input, Select, Spinner, NoticeBanner } from '../components/UI';
import PortalWebRtcDock from '../components/PortalWebRtcDock';
import { usePortalChat } from '../hooks/usePortalChat';

const EDIT_KEYS = [
  'first_name',
  'last_name',
  'middle_name',
  'email',
  'phone',
  'date_of_birth',
  'gender',
  'marital_status',
  'occupation',
  'address',
  'city',
  'state',
  'emergency_contact_name',
  'emergency_contact_phone',
];

function emptyForm() {
  return EDIT_KEYS.reduce((acc, k) => {
    acc[k] = '';
    return acc;
  }, {});
}

function rowToForm(row) {
  const f = emptyForm();
  for (const k of EDIT_KEYS) {
    let v = row[k];
    if (k === 'date_of_birth' && v) {
      v = String(v).slice(0, 10);
    }
    f[k] = v ?? '';
  }
  return f;
}

export default function MemberPortalPage() {
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [messages, setMessages] = useState([]);
  const [chatBody, setChatBody] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatNotice, setChatNotice] = useState(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingHideRef = useRef(null);
  const chatEndRef = useRef(null);
  const photoInputRef = useRef(null);

  const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/i, '') || '';

  const photoSrc = profile?.photo_url
    ? profile.photo_url.startsWith('http')
      ? profile.photo_url
      : `${apiOrigin}${profile.photo_url}`
    : '';

  const loadProfile = useCallback(async () => {
    setProfileError('');
    try {
      const res = await memberPortalAPI.getProfile();
      const d = res.data?.data;
      setProfile(d);
      setForm(rowToForm(d));
    } catch (e) {
      setProfileError(e.response?.data?.message || 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const scrollChatToEnd = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChat = useCallback(async () => {
    try {
      const res = await memberPortalAPI.listChat();
      setMessages(res.data?.data ?? []);
    } catch {
      /* keep existing messages */
    }
  }, []);

  const portalChat = usePortalChat({
    memberId: profile?.id,
    role: 'member',
    enabled: tab === 'chat' && !!profile?.id,
    onRefresh: loadChat,
  });

  useEffect(() => {
    if (tab !== 'chat') return undefined;
    loadChat();
    const ms = portalChat.wsConnected ? 45000 : 5000;
    const id = setInterval(loadChat, ms);
    return () => clearInterval(id);
  }, [tab, loadChat, portalChat.wsConnected]);

  useEffect(() => {
    if (tab === 'chat') scrollChatToEnd();
  }, [tab, messages]);

  useEffect(() => {
    return portalChat.subscribeSignals((msg) => {
      if (msg.type !== 'typing') return;
      if (msg.fromRole !== 'staff') return;
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
    if (tab !== 'chat') setPeerTyping(false);
  }, [tab]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setProfileError('');
    try {
      const payload = {};
      for (const k of EDIT_KEYS) {
        let v = form[k];
        if (k === 'date_of_birth' && v === '') v = null;
        payload[k] = v === '' ? null : v;
      }
      const res = await memberPortalAPI.updateProfile(payload);
      const d = res.data?.data;
      setProfile(d);
      setForm(rowToForm(d));
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const onPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoUploading(true);
    setProfileError('');
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await memberPortalAPI.uploadPhoto(fd);
      const d = res.data?.data;
      setProfile((p) => ({ ...p, ...d }));
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Photo upload failed.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    const text = chatBody.trim();
    if (!text || chatSending) return;
    setChatSending(true);
    try {
      await memberPortalAPI.postChat(text);
      setChatBody('');
      setChatNotice(null);
      await loadChat();
      scrollChatToEnd();
    } catch (err) {
      setChatNotice({ type: 'error', text: err.response?.data?.message || 'Could not send message.' });
    } finally {
      setChatSending(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  if (!profile) {
    const isUnlinked =
      /not linked|member profile/i.test(profileError || '') ||
      /congregation accounts/i.test(profileError || '');
    return (
      <div>
        <PageHeader title="Member portal" subtitle="Your church profile and messages" />
        <Card>
          <div className="p-8 text-sm text-left max-w-lg mx-auto">
            <p className="text-red-600 font-medium">{profileError || 'Profile unavailable.'}</p>
            {isUnlinked && (
              <p className="mt-4 text-xs text-gray-500">
                Staff must link your user account to a member profile. For the bundled demo, run{' '}
                <code className="bg-gray-100 px-1 rounded">database/fix-member-portal-demo.sql</code> or{' '}
                <code className="bg-gray-100 px-1 rounded">npm run seed</code> on a clean DB. Password:{' '}
                <span className="font-mono">GraceERP@2025</span>.
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Member portal"
        subtitle="Update your details and chat with the church office"
      />

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab('profile')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'profile'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Profile
        </button>
        <button
          type="button"
          onClick={() => setTab('chat')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'chat'
              ? 'border-purple-600 text-purple-800'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Live chat
        </button>
      </div>

      {profileError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">{profileError}</div>
      )}

      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="space-y-6">
          <Card>
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold font-display text-gray-800">Profile photo</h3>
              <p className="text-xs text-gray-500 mt-1">JPG or PNG, up to 8 MB</p>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-6 items-start">
              <div className="relative flex-shrink-0">
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt=""
                    className="w-28 h-28 rounded-2xl object-cover border border-gray-200 shadow-sm"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-800 text-white text-2xl font-bold flex items-center justify-center">
                    {(profile.first_name?.[0] || '') + (profile.last_name?.[0] || '') || '?'}
                  </div>
                )}
                {photoUploading && (
                  <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center">
                    <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={onPhotoChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={photoUploading}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {photoUploading ? 'Uploading…' : 'Change photo'}
                </Button>
              </div>
              <dl className="text-sm space-y-1 sm:ml-auto sm:text-right">
                <dt className="text-xs text-gray-400 uppercase tracking-wider">Member code</dt>
                <dd className="font-medium text-gray-800">{profile.member_code || '—'}</dd>
                <dt className="text-xs text-gray-400 uppercase tracking-wider mt-2">Congregation</dt>
                <dd className="text-gray-700">{profile.branch_name}</dd>
              </dl>
            </div>
          </Card>

          <Card>
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold font-display text-gray-800">Church contact</h3>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Church</span>
                <p className="font-medium text-gray-800">{profile.church_name}</p>
              </div>
              <div>
                <span className="text-gray-500">Phone</span>
                <p className="font-medium text-gray-800">{profile.church_phone || '—'}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-gray-500">Email</span>
                <p className="font-medium text-gray-800">{profile.church_email || '—'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold font-display text-gray-800">Your details</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <Input
                  label="First name"
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  required
                />
                <Input
                  label="Middle name"
                  value={form.middle_name}
                  onChange={(e) => setForm((f) => ({ ...f, middle_name: e.target.value }))}
                />
                <Input
                  label="Last name"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Date of birth"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                />
                <Input label="Occupation" value={form.occupation} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Select label="Gender" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </Select>
                <Select label="Marital status" value={form.marital_status} onChange={(e) => setForm((f) => ({ ...f, marital_status: e.target.value }))}>
                  <option value="">Select</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                  <option value="separated">Separated</option>
                </Select>
              </div>
              <Input label="Street address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                <Input label="State / region" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-semibold font-display text-gray-800">Next of kin</h3>
              <p className="text-xs text-gray-500 mt-1">Emergency contact on file</p>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              <Input
                label="Full name"
                value={form.emergency_contact_name}
                onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
              />
              <Input
                label="Phone"
                value={form.emergency_contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
              />
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      )}

      {tab === 'chat' && (
        <Card className="overflow-hidden flex flex-col min-h-[min(520px,75dvh)] max-h-[min(90dvh,900px)]">
          <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
            <h3 className="font-semibold text-gray-800">Messages with the office</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Messages sync live when connected. Voice/video use WebRTC (mic/camera need HTTPS unless you are on localhost).
            </p>
          </div>
          <PortalWebRtcDock
            subscribeSignals={portalChat.subscribeSignals}
            sendSignal={portalChat.sendSignal}
            wsConnected={portalChat.wsConnected}
            selfRole="member"
          />
          {chatNotice && (
            <NoticeBanner type="error" className="mx-4 mt-4 mb-0">
              {chatNotice.text}
            </NoticeBanner>
          )}
          {peerTyping && (
            <div className="px-4 py-1.5 text-xs text-purple-700 bg-purple-50/90 border-b border-purple-100 shrink-0">
              Someone from the office is typing…
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-gray-50/80">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No messages yet. Say hello below.</p>
            ) : (
              messages.map((m) => {
                const mine = !m.is_staff;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        mine
                          ? 'bg-purple-600 text-white rounded-br-md'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      {!mine && (
                        <p className="text-xs font-semibold text-purple-700 mb-1">{m.staff_name || 'Church office'}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`text-[10px] mt-1.5 ${mine ? 'text-purple-200' : 'text-gray-400'}`}>
                        {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendChat} className="p-4 border-t border-gray-100 flex gap-2 bg-white shrink-0">
            <input
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              placeholder="Type a message…"
              value={chatBody}
              onChange={(e) => {
                const v = e.target.value;
                setChatBody(v);
                setChatNotice(null);
                if (v.trim()) portalChat.sendTyping();
              }}
            />
            <Button type="submit" disabled={chatSending || !chatBody.trim()}>
              Send
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
