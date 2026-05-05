import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { commsAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table, NoticeBanner } from '../components/UI';

const textAreaCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 min-h-[120px]';

const CHANNELS = ['sms', 'email', 'push', 'whatsapp', 'in_app', 'all'];
const AUDIENCES = ['all', 'branch', 'department', 'tier', 'custom', 'individual'];
const STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed'];

const canManageComms = (role) =>
  ['super_admin', 'branch_admin', 'pastor', 'content_manager'].includes(role || '');

export default function CommunicationsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageComms(user?.role);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [channelQ, setChannelQ] = useState('');
  const [statusQ, setStatusQ] = useState('');
  const [loading, setLoading] = useState(true);

  const [branches, setBranches] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const notify = (type, text) => setNotice({ type, text });

  useEffect(() => {
    branchesAPI
      .getAll({ limit: 300 })
      .then((r) => setBranches(r.data?.data ?? []))
      .catch(() => setBranches([]));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await commsAPI.getAll({
        page,
        limit: 15,
        search: search.trim() || undefined,
        channel: channelQ || undefined,
        status: statusQ || undefined,
      });
      setRows(res.data?.data ?? []);
      setPagination(res.data?.pagination ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, channelQ, statusQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const openModal = () => {
    setForm({
      branch_id: '',
      title: '',
      body: '',
      channel: 'in_app',
      audience_type: 'all',
      status: 'draft',
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.title?.trim() || !form.body?.trim()) {
      notify('error', 'Title and body are required.');
      return;
    }
    setSaving(true);
    try {
      await commsAPI.create({
        branch_id: form.branch_id || undefined,
        title: form.title.trim(),
        body: form.body.trim(),
        channel: form.channel,
        audience_type: form.audience_type,
        status: form.status,
      });
      setModal(false);
      notify('success', 'Message saved.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not save message.');
    } finally {
      setSaving(false);
    }
  };

  const sendMsg = async (id) => {
    try {
      await commsAPI.send(id);
      notify('success', 'Send queued.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Send failed.');
    }
  };

  const removeMsg = async (id) => {
    if (!confirm('Delete this message?')) return;
    try {
      await commsAPI.remove(id);
      notify('success', 'Message deleted.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Delete failed.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Communications"
        subtitle="Outbound message drafts and delivery log"
        action={canManage ? <Button onClick={openModal}>+ Compose</Button> : null}
      />

      {notice && <NoticeBanner type={notice.type}>{notice.text}</NoticeBanner>}

      <Card>
        <div className="p-5 border-b flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search title or body…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56"
          />
          <select
            value={channelQ}
            onChange={(e) => {
              setChannelQ(e.target.value);
              setPage(1);
            }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={statusQ}
            onChange={(e) => {
              setStatusQ(e.target.value);
              setPage(1);
            }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-gray-400">{pagination.total ?? 0} messages</span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <Table headers={['Title', 'Channel', 'Audience', 'Branch', 'Status', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No messages
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium max-w-[220px] truncate">{m.title}</td>
                  <td className="px-4 py-3 text-xs">{m.channel}</td>
                  <td className="px-4 py-3 text-xs">{m.audience_type}</td>
                  <td className="px-4 py-3 text-gray-600">{m.branch_name || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.status === 'sent' ? 'success' : m.status === 'failed' ? 'danger' : 'default'}>{m.status}</Badge>
                  </td>
                  <td className="px-4 py-3 flex flex-wrap gap-2">
                    {canManage && m.status !== 'sent' ? (
                      <Button variant="outline" size="sm" onClick={() => sendMsg(m.id)}>
                        Send (simulated)
                      </Button>
                    ) : null}
                    {canManage ? (
                      <Button variant="danger" size="sm" onClick={() => removeMsg(m.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </Table>
        )}

        {pagination.pages > 1 && (
          <div className="flex justify-between px-5 py-4 border-t">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              ← Prev
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.pages}>
              Next →
            </Button>
          </div>
        )}
      </Card>

      <Modal
        open={modal}
        onClose={() => !saving && setModal(false)}
        title="Compose message"
        footer={
          <>
            <Button variant="outline" onClick={() => setModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              Save draft
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch (optional)" value={form.branch_id || ''} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Church-wide</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Title" value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Body</label>
            <textarea className={textAreaCls} value={form.body || ''} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Channel" value={form.channel || 'in_app'} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              label="Audience"
              value={form.audience_type || 'all'}
              onChange={(e) => setForm((f) => ({ ...f, audience_type: e.target.value }))}
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
          <Select label="Status" value={form.status || 'draft'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {STATUSES.filter((s) => s !== 'sent' && s !== 'failed').map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
}
