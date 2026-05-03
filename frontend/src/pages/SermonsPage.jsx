import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { sermonsAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table } from '../components/UI';

const TIERS = ['all', 'cell_leader', 'minister', 'pastor', 'admin'];

const canManageContent = (role) =>
  ['super_admin', 'branch_admin', 'pastor', 'content_manager'].includes(role || '');

const textAreaCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 min-h-[88px]';

export default function SermonsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageContent(user?.role);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [seriesQ, setSeriesQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [view, setView] = useState(null);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      branchesAPI.getAll({ limit: 300 }).then((r) => setBranches(r.data?.data ?? [])).catch(() => setBranches([]));
    }
  }, [user?.role]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await sermonsAPI.getAll({
        page,
        limit: 15,
        search: search.trim() || undefined,
        series: seriesQ.trim() || undefined,
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
  }, [page, seriesQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      branch_id: '',
      title: '',
      preacher_name: '',
      series: '',
      scripture_ref: '',
      sermon_date: new Date().toISOString().slice(0, 10),
      duration_minutes: '',
      description: '',
      tags: '',
      audio_url: '',
      video_url: '',
      access_tier: 'all',
      language: 'English',
      download_allowed: true,
    });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      branch_id: row.branch_id || '',
      title: row.title || '',
      preacher_name: row.preacher_name || '',
      series: row.series || '',
      scripture_ref: row.scripture_ref || '',
      sermon_date: row.sermon_date ? String(row.sermon_date).slice(0, 10) : '',
      duration_minutes: row.duration_minutes ?? '',
      description: row.description || '',
      tags: Array.isArray(row.tags) ? row.tags.join(', ') : '',
      audio_url: row.audio_url || '',
      video_url: row.video_url || '',
      access_tier: row.access_tier || 'all',
      language: row.language || 'English',
      download_allowed: row.download_allowed !== false,
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title?.trim() || !form.preacher_name?.trim() || !form.sermon_date) {
      alert('Title, preacher, and date are required.');
      return;
    }
    setSaving(true);
    try {
      const tags = form.tags
        ? form.tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : null;
      const payload = {
        branch_id: form.branch_id || null,
        title: form.title.trim(),
        preacher_name: form.preacher_name.trim(),
        series: form.series?.trim() || null,
        scripture_ref: form.scripture_ref?.trim() || null,
        sermon_date: form.sermon_date,
        duration_minutes: form.duration_minutes === '' ? null : parseInt(form.duration_minutes, 10),
        description: form.description || null,
        tags,
        audio_url: form.audio_url || null,
        video_url: form.video_url || null,
        access_tier: form.access_tier,
        language: form.language || 'English',
        download_allowed: form.download_allowed !== false,
      };
      if (editing) {
        await sermonsAPI.update(editing.id, payload);
      } else {
        await sermonsAPI.create(payload);
      }
      setFormOpen(false);
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete sermon “${row.title}”?`)) return;
    try {
      await sermonsAPI.remove(row.id);
      load();
      if (view?.id === row.id) setView(null);
    } catch (e) {
      alert(e.response?.data?.message || 'Delete failed');
    }
  };

  const openView = async (row) => {
    try {
      const res = await sermonsAPI.getOne(row.id);
      setView(res.data.data);
    } catch (e) {
      alert(e.response?.data?.message || 'Could not load sermon');
    }
  };

  return (
    <div>
      <PageHeader
        title="Sermon repository"
        subtitle="Teachings with media links — plays increment when you open a sermon."
        action={canManage ? <Button onClick={openCreate}>+ Add sermon</Button> : undefined}
      />

      <Card>
        <div className="p-5 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search title, preacher, scripture…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:border-purple-400"
          />
          <input
            type="text"
            placeholder="Series filter"
            value={seriesQ}
            onChange={(e) => {
              setSeriesQ(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:border-purple-400"
          />
          <span className="ml-auto text-xs text-gray-400">{pagination.total ?? 0} sermons</span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <Table headers={['Title', 'Preacher', 'Date', 'Branch', 'Plays', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No sermons yet.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{s.title}</div>
                    {s.series && <div className="text-xs text-gray-400">{s.series}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.preacher_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {s.sermon_date ? new Date(s.sermon_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.branch_name || 'All / HQ'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.play_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => openView(s)}>
                        Open
                      </Button>
                      {canManage && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => remove(s)}>
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
        open={!!view}
        onClose={() => setView(null)}
        title={view?.title || 'Sermon'}
        footer={<Button variant="outline" onClick={() => setView(null)}>Close</Button>}
      >
        {view && (
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              <span className="text-gray-400">Preacher:</span> {view.preacher_name}
            </p>
            <p>
              <span className="text-gray-400">Date:</span>{' '}
              {view.sermon_date ? new Date(view.sermon_date).toLocaleDateString() : '—'}
            </p>
            {view.scripture_ref && (
              <p>
                <span className="text-gray-400">Scripture:</span> {view.scripture_ref}
              </p>
            )}
            {view.description && <p className="text-gray-600 whitespace-pre-wrap">{view.description}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              {view.audio_url && (
                <a href={view.audio_url} target="_blank" rel="noreferrer" className="text-purple-600 text-sm">
                  Audio ↗
                </a>
              )}
              {view.video_url && (
                <a href={view.video_url} target="_blank" rel="noreferrer" className="text-purple-600 text-sm">
                  Video ↗
                </a>
              )}
            </div>
            <p className="text-xs text-gray-400 pt-2">Play count (after this open): {view.play_count ?? 0}</p>
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit sermon' : 'New sermon'}
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
          {user?.role === 'super_admin' && (
            <Select label="Congregation" value={form.branch_id || ''} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}>
              <option value="">Church-wide / not specific</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
          <Input label="Title" value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input
            label="Preacher"
            value={form.preacher_name || ''}
            onChange={(e) => setForm((f) => ({ ...f, preacher_name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Series" value={form.series || ''} onChange={(e) => setForm((f) => ({ ...f, series: e.target.value }))} />
            <Input
              label="Scripture"
              value={form.scripture_ref || ''}
              onChange={(e) => setForm((f) => ({ ...f, scripture_ref: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" label="Sermon date" value={form.sermon_date || ''} onChange={(e) => setForm((f) => ({ ...f, sermon_date: e.target.value }))} />
            <Input
              label="Duration (min)"
              type="number"
              min={0}
              value={form.duration_minutes}
              onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              className={textAreaCls}
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <Input label="Tags (comma-separated)" value={form.tags || ''} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
          <Input label="Audio URL" value={form.audio_url || ''} onChange={(e) => setForm((f) => ({ ...f, audio_url: e.target.value }))} />
          <Input label="Video URL" value={form.video_url || ''} onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Access tier" value={form.access_tier || 'all'} onChange={(e) => setForm((f) => ({ ...f, access_tier: e.target.value }))}>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
            <Input label="Language" value={form.language || ''} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.download_allowed}
              onChange={(e) => setForm((f) => ({ ...f, download_allowed: e.target.checked }))}
            />
            Downloads allowed
          </label>
        </div>
      </Modal>
    </div>
  );
}
