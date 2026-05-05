import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { meetingsAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table, NoticeBanner } from '../components/UI';

const STATUSES = ['scheduled', 'live', 'ended', 'cancelled'];

const canManageContent = (role) =>
  ['super_admin', 'branch_admin', 'pastor', 'content_manager'].includes(role || '');

const textAreaCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 min-h-[88px]';

function toDatetimeLocalValue(isoOrDb) {
  if (!isoOrDb) return '';
  const d = new Date(isoOrDb);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MeetingsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageContent(user?.role);

  const [rows, setRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusQ, setStatusQ] = useState('');
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [attForm, setAttForm] = useState({ member_id: '', display_name: '' });
  const [attSaving, setAttSaving] = useState(false);
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
      const res = await meetingsAPI.getAll({
        page,
        limit: 15,
        search: search.trim() || undefined,
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
  }, [page, statusQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    const start = new Date();
    start.setMinutes(start.getMinutes() + 30 - (start.getMinutes() % 15));
    setForm({
      branch_id: user?.role === 'super_admin' ? '' : user?.branch_id || '',
      title: '',
      description: '',
      meeting_type: '',
      host_name: user?.full_name || '',
      scheduled_start: toDatetimeLocalValue(start.toISOString()),
      scheduled_end: '',
      platform: 'jitsi',
      meeting_url: '',
      max_attendees: '',
      status: 'scheduled',
      is_public: true,
    });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      branch_id: row.branch_id || '',
      title: row.title || '',
      description: row.description || '',
      meeting_type: row.meeting_type || '',
      host_name: row.host_name || '',
      scheduled_start: toDatetimeLocalValue(row.scheduled_start),
      scheduled_end: row.scheduled_end ? toDatetimeLocalValue(row.scheduled_end) : '',
      platform: row.platform || 'jitsi',
      meeting_url: row.meeting_url || '',
      recording_url: row.recording_url || '',
      max_attendees: row.max_attendees ?? '',
      status: row.status || 'scheduled',
      is_public: row.is_public !== false,
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title?.trim() || !form.scheduled_start) {
      notify('error', 'Title and start time required');
      return;
    }
    setSaving(true);
    try {
      const scheduled_start = new Date(form.scheduled_start).toISOString();
      const scheduled_end =
        form.scheduled_end ? new Date(form.scheduled_end).toISOString() : null;

      const payload = {
        branch_id: form.branch_id || null,
        title: form.title.trim(),
        description: form.description || null,
        meeting_type: form.meeting_type?.trim() || null,
        host_name: form.host_name?.trim() || null,
        scheduled_start,
        scheduled_end,
        platform: form.platform || 'jitsi',
        meeting_url: form.meeting_url || null,
        recording_url: form.recording_url || null,
        max_attendees: form.max_attendees === '' ? null : parseInt(form.max_attendees, 10),
        status: form.status,
        is_public: form.is_public !== false,
      };

      const prevId = editing?.id;
      if (editing) await meetingsAPI.update(editing.id, payload);
      else await meetingsAPI.create(payload);
      setFormOpen(false);
      notify('success', editing ? 'Meeting updated.' : 'Meeting scheduled.');
      await load();
      if (prevId && detail?.id === prevId) await refreshAttendance(prevId);
    } catch (e) {
      notify('error', e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const refreshAttendance = async (id) => {
    try {
      const res = await meetingsAPI.getAttendance(id);
      setAttendance(res.data?.data ?? []);
    } catch {
      setAttendance([]);
    }
  };

  const openDetail = async (row) => {
    setDetail(row);
    setAttForm({ member_id: '', display_name: '' });
    await refreshAttendance(row.id);
  };

  const logAttendance = async () => {
    if (!detail) return;
    if (!attForm.member_id.trim() && !attForm.display_name.trim()) {
      notify('error', 'Enter member UUID or display name');
      return;
    }
    setAttSaving(true);
    try {
      await meetingsAPI.recordAttendance(detail.id, {
        member_id: attForm.member_id.trim() || undefined,
        display_name: attForm.display_name.trim() || undefined,
      });
      setAttForm({ member_id: '', display_name: '' });
      notify('success', 'Attendance recorded.');
      await refreshAttendance(detail.id);
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not record attendance');
    } finally {
      setAttSaving(false);
    }
  };

  const setMeetingStatus = async (row, status) => {
    try {
      await meetingsAPI.update(row.id, { status });
      load();
      if (detail?.id === row.id) setDetail((d) => ({ ...d, status }));
      notify('success', 'Meeting status updated.');
    } catch (e) {
      notify('error', e.response?.data?.message || 'Update failed');
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete meeting “${row.title}”?`)) return;
    try {
      await meetingsAPI.remove(row.id);
      load();
      if (detail?.id === row.id) setDetail(null);
      notify('success', 'Meeting deleted.');
    } catch (e) {
      notify('error', e.response?.data?.message || 'Delete failed');
    }
  };

  const statusVariant = (s) =>
    ({ scheduled: 'purple', live: 'success', ended: 'default', cancelled: 'danger' }[s] || 'default');

  return (
    <div>
      <PageHeader
        title="Live meetings"
        subtitle="Scheduled streams with optional attendance log."
        action={canManage ? <Button onClick={openCreate}>+ Schedule meeting</Button> : undefined}
      />

      {notice && <NoticeBanner type={notice.type}>{notice.text}</NoticeBanner>}

      <Card>
        <div className="p-5 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search meetings…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:border-purple-400"
          />
          <select
            value={statusQ}
            onChange={(e) => {
              setStatusQ(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-gray-400">{pagination.total ?? 0} meetings</span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <Table headers={['Meeting', 'Starts', 'Branch', 'Platform', 'Status', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No meetings scheduled.
                </td>
              </tr>
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{m.title}</div>
                    {m.host_name && <div className="text-xs text-gray-400">Host: {m.host_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {m.scheduled_start ? new Date(m.scheduled_start).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{m.branch_name || 'All / HQ'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{m.platform}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(m.status)}>{m.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => openDetail(m)}>
                        Details
                      </Button>
                      {canManage && m.status === 'scheduled' && (
                        <Button variant="outline" size="sm" onClick={() => setMeetingStatus(m, 'live')}>
                          Go live
                        </Button>
                      )}
                      {canManage && m.status === 'live' && (
                        <Button variant="outline" size="sm" onClick={() => setMeetingStatus(m, 'ended')}>
                          End
                        </Button>
                      )}
                      {canManage && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => remove(m)}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </Table>
        )}

        {pagination.pages > 1 && (
          <div className="flex justify-between px-5 py-4 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              Page {pagination.page} / {pagination.pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.title || 'Meeting'}
        footer={<Button variant="outline" onClick={() => setDetail(null)}>Close</Button>}
      >
        {detail && (
          <div className="space-y-4 text-sm text-gray-700">
            <p className="text-gray-500">
              {detail.scheduled_start && new Date(detail.scheduled_start).toLocaleString()}
              {detail.branch_name && ` · ${detail.branch_name}`}
            </p>
            {detail.meeting_url && (
              <a href={detail.meeting_url} target="_blank" rel="noreferrer" className="text-purple-600 font-medium">
                Join link ↗
              </a>
            )}
            {detail.description && <p className="whitespace-pre-wrap">{detail.description}</p>}

            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Attendance log</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <Input
                  label="Member ID (UUID)"
                  value={attForm.member_id}
                  onChange={(e) => setAttForm((f) => ({ ...f, member_id: e.target.value }))}
                  placeholder="optional"
                />
                <Input
                  label="Display name"
                  value={attForm.display_name}
                  onChange={(e) => setAttForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="guest label"
                />
              </div>
              <Button size="sm" onClick={logAttendance} disabled={attSaving}>
                {attSaving ? 'Recording…' : 'Record join'}
              </Button>

              <ul className="mt-3 space-y-1 max-h-40 overflow-y-auto text-xs text-gray-600">
                {attendance.map((a) => (
                  <li key={a.id}>
                    {a.display_name ||
                      [a.first_name, a.last_name].filter(Boolean).join(' ') ||
                      a.member_id ||
                      'Participant'}{' '}
                    · {a.joined_at ? new Date(a.joined_at).toLocaleString() : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit meeting' : 'Schedule meeting'}
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Congregation (optional)" value={form.branch_id || ''} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Church-wide</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Title" value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Host name" value={form.host_name || ''} onChange={(e) => setForm((f) => ({ ...f, host_name: e.target.value }))} />
          <Input label="Meeting type" value={form.meeting_type || ''} onChange={(e) => setForm((f) => ({ ...f, meeting_type: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Start</label>
              <input
                type="datetime-local"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-purple-400"
                value={form.scheduled_start || ''}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_start: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">End (optional)</label>
              <input
                type="datetime-local"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-purple-400"
                value={form.scheduled_end || ''}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_end: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Platform" value={form.platform || 'jitsi'} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
              <option value="jitsi">Jitsi</option>
              <option value="zoom">Zoom</option>
              <option value="youtube">YouTube</option>
              <option value="other">Other</option>
            </Select>
            <Select label="Status" value={form.status || 'scheduled'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <Input label="Meeting URL" value={form.meeting_url || ''} onChange={(e) => setForm((f) => ({ ...f, meeting_url: e.target.value }))} />
          <Input
            label="Recording URL"
            value={form.recording_url || ''}
            onChange={(e) => setForm((f) => ({ ...f, recording_url: e.target.value }))}
          />
          <Input
            label="Max attendees"
            type="number"
            min={0}
            value={form.max_attendees}
            onChange={(e) => setForm((f) => ({ ...f, max_attendees: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              className={textAreaCls}
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_public !== false}
              onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
            />
            Public listing
          </label>
        </div>
      </Modal>
    </div>
  );
}
