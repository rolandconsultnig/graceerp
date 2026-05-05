import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { eventsAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table, NoticeBanner } from '../components/UI';

const STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];

const canManageContent = (role) =>
  ['super_admin', 'branch_admin', 'pastor', 'content_manager'].includes(role || '');

const textAreaCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 min-h-[88px]';

export default function EventsPage() {
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
  const [rsvps, setRsvps] = useState([]);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [rsvpForm, setRsvpForm] = useState({ name: '', email: '', phone: '' });
  const [rsvpSaving, setRsvpSaving] = useState(false);
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
      const res = await eventsAPI.getAll({
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

  const defaultBranchId = () =>
    user?.role === 'super_admin' ? '' : user?.branch_id || '';

  const openCreate = () => {
    setEditing(null);
    setForm({
      branch_id: defaultBranchId(),
      title: '',
      description: '',
      event_type: '',
      venue: '',
      event_date: new Date().toISOString().slice(0, 10),
      start_time: '',
      end_time: '',
      capacity: '',
      rsvp_required: true,
      flyer_url: '',
      status: 'upcoming',
    });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      branch_id: row.branch_id || '',
      title: row.title || '',
      description: row.description || '',
      event_type: row.event_type || '',
      venue: row.venue || '',
      event_date: row.event_date ? String(row.event_date).slice(0, 10) : '',
      start_time: row.start_time ? String(row.start_time).slice(0, 5) : '',
      end_time: row.end_time ? String(row.end_time).slice(0, 5) : '',
      capacity: row.capacity ?? '',
      rsvp_required: row.rsvp_required !== false,
      flyer_url: row.flyer_url || '',
      status: row.status || 'upcoming',
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title?.trim() || !form.event_date) {
      notify('error', 'Title and date are required.');
      return;
    }
    if (!form.branch_id) {
      notify('error', 'Pick a congregation (header branch scope or dropdown).');
      return;
    }
    if (form.start_time && form.end_time && form.start_time >= form.end_time) {
      notify('error', 'End time must be later than start time.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        branch_id: form.branch_id,
        title: form.title.trim(),
        description: form.description || null,
        event_type: form.event_type?.trim() || null,
        venue: form.venue?.trim() || null,
        event_date: form.event_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        capacity: form.capacity === '' ? null : parseInt(form.capacity, 10),
        rsvp_required: form.rsvp_required !== false,
        flyer_url: form.flyer_url || null,
        status: form.status,
      };
      const prevId = editing?.id;
      if (editing) await eventsAPI.update(editing.id, payload);
      else await eventsAPI.create(payload);
      setFormOpen(false);
      notify('success', editing ? 'Event updated successfully.' : 'Event created successfully.');
      await load();
      if (prevId && detail?.id === prevId) await refreshDetail(prevId);
    } catch (e) {
      notify('error', e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const refreshDetail = async (id) => {
    try {
      const [ev, rv] = await Promise.all([eventsAPI.getOne(id), eventsAPI.listRsvps(id)]);
      setDetail(ev.data.data);
      setRsvps(rv.data?.data ?? []);
    } catch {
      setRsvps([]);
    }
  };

  const openDetail = async (row) => {
    setRsvpForm({ name: '', email: '', phone: '' });
    await refreshDetail(row.id);
  };

  const submitRsvp = async () => {
    if (!detail) return;
    if (!rsvpForm.name.trim() && !rsvpForm.email.trim()) {
      notify('error', 'Enter guest name or email');
      return;
    }
    setRsvpSaving(true);
    try {
      await eventsAPI.rsvp(detail.id, {
        name: rsvpForm.name.trim() || undefined,
        email: rsvpForm.email.trim() || undefined,
        phone: rsvpForm.phone.trim() || undefined,
      });
      setRsvpOpen(false);
      setRsvpForm({ name: '', email: '', phone: '' });
      notify('success', 'RSVP submitted successfully.');
      await refreshDetail(detail.id);
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'RSVP failed');
    } finally {
      setRsvpSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete event “${row.title}”?`)) return;
    try {
      await eventsAPI.remove(row.id);
      notify('success', 'Event deleted.');
      load();
      if (detail?.id === row.id) setDetail(null);
    } catch (e) {
      notify('error', e.response?.data?.message || 'Delete failed');
    }
  };

  const statusVariant = (s) =>
    ({ upcoming: 'purple', ongoing: 'success', completed: 'default', cancelled: 'danger' }[s] || 'default');

  return (
    <div>
      <PageHeader
        title="Events & programmes"
        subtitle="Branch-scoped programmes with RSVP and capacity."
        action={canManage ? <Button onClick={openCreate}>+ New event</Button> : undefined}
      />
      {notice && <NoticeBanner type={notice.type}>{notice.text}</NoticeBanner>}

      <Card>
        <div className="p-5 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search events…"
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
          <span className="ml-auto text-xs text-gray-400">{pagination.total ?? 0} events</span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <Table headers={['Event', 'When', 'Venue', 'Branch', 'RSVP', 'Status', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">
                  No events yet.
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{e.title}</div>
                    {e.event_type && <div className="text-xs text-gray-400">{e.event_type}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {e.event_date ? new Date(e.event_date).toLocaleDateString() : '—'}
                    {e.start_time && ` · ${String(e.start_time).slice(0, 5)}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{e.venue || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{e.branch_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{e.rsvp_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(e.status)}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => openDetail(e)}>
                        Details
                      </Button>
                      {canManage && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(e)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => remove(e)}>
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
        title={detail?.title || 'Event'}
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            {detail && ['upcoming', 'ongoing'].includes(detail.status) && (
              <Button onClick={() => setRsvpOpen(true)}>RSVP</Button>
            )}
            <Button variant="outline" onClick={() => setDetail(null)}>
              Close
            </Button>
          </div>
        }
      >
        {detail && (
          <div className="space-y-3 text-sm text-gray-700">
            <p className="text-gray-500">
              {detail.branch_name} · {detail.event_date && new Date(detail.event_date).toLocaleDateString()}
              {detail.start_time && ` · ${String(detail.start_time).slice(0, 5)}`}
            </p>
            {detail.venue && <p>Venue: {detail.venue}</p>}
            {detail.capacity != null && (
              <p>
                Capacity: {detail.capacity} · RSVP count: {detail.rsvp_count ?? 0}
              </p>
            )}
            {detail.description && <p className="whitespace-pre-wrap">{detail.description}</p>}
            <div className="border-t border-gray-100 pt-3 mt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">RSVP list</p>
              {rsvps.length === 0 ? (
                <p className="text-gray-400 text-sm">No RSVPs yet.</p>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {rsvps.map((r) => (
                    <li key={r.id} className="text-xs text-gray-600 flex justify-between gap-2">
                      <span>{r.name || r.email || 'Guest'}</span>
                      <Badge variant={r.status === 'confirmed' ? 'success' : 'warning'}>{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={rsvpOpen}
        onClose={() => setRsvpOpen(false)}
        title="RSVP"
        footer={
          <>
            <Button variant="outline" onClick={() => setRsvpOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRsvp} disabled={rsvpSaving}>
              {rsvpSaving ? 'Saving…' : 'Submit'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={rsvpForm.name} onChange={(e) => setRsvpForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Email" type="email" value={rsvpForm.email} onChange={(e) => setRsvpForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Phone" value={rsvpForm.phone} onChange={(e) => setRsvpForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit event' : 'New event'}
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
          <Select label="Congregation" value={form.branch_id || ''} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select congregation…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Title" value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Type" value={form.event_type || ''} onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))} />
          <Input label="Venue" value={form.venue || ''} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
          <div className="grid grid-cols-3 gap-3">
            <Input type="date" label="Date" value={form.event_date || ''} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
            <Input type="time" label="Start" value={form.start_time || ''} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
            <Input type="time" label="End" value={form.end_time || ''} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
          </div>
          <Input
            label="Capacity (optional)"
            type="number"
            min={0}
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              className={textAreaCls}
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <Input label="Flyer URL" value={form.flyer_url || ''} onChange={(e) => setForm((f) => ({ ...f, flyer_url: e.target.value }))} />
          <Select label="Status" value={form.status || 'upcoming'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.rsvp_required !== false}
              onChange={(e) => setForm((f) => ({ ...f, rsvp_required: e.target.checked }))}
            />
            RSVP required
          </label>
        </div>
      </Modal>
    </div>
  );
}
