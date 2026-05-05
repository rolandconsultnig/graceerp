import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { libraryAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table, NoticeBanner } from '../components/UI';

const FORMATS = ['pdf', 'epub', 'docx', 'mp3', 'mp4', 'other'];
const TIERS = ['all', 'cell_leader', 'minister', 'pastor', 'admin'];

const canManageContent = (role) =>
  ['super_admin', 'branch_admin', 'pastor', 'content_manager'].includes(role || '');

const textAreaCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 min-h-[88px]';

export default function LibraryPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageContent(user?.role);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryQ, setCategoryQ] = useState('');
  const [formatQ, setFormatQ] = useState('');
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState(null);
  const [notice, setNotice] = useState(null);
  const notify = (type, text) => setNotice({ type, text });

  const load = async () => {
    setLoading(true);
    try {
      const res = await libraryAPI.getAll({
        page,
        limit: 15,
        search: search.trim() || undefined,
        category: categoryQ.trim() || undefined,
        format: formatQ || undefined,
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
  }, [page, formatQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
  }, [search, categoryQ]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      author: '',
      description: '',
      category: '',
      format: 'pdf',
      file_url: '',
      file_size_bytes: '',
      cover_url: '',
      access_tier: 'all',
      download_allowed: false,
      tags: '',
    });
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      title: row.title || '',
      author: row.author || '',
      description: row.description || '',
      category: row.category || '',
      format: row.format || 'pdf',
      file_url: row.file_url || '',
      file_size_bytes: row.file_size_bytes ?? '',
      cover_url: row.cover_url || '',
      access_tier: row.access_tier || 'all',
      download_allowed: !!row.download_allowed,
      tags: Array.isArray(row.tags) ? row.tags.join(', ') : '',
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.title?.trim()) {
      notify('error', 'Title required');
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
        title: form.title.trim(),
        author: form.author?.trim() || null,
        description: form.description || null,
        category: form.category?.trim() || null,
        format: form.format,
        file_url: form.file_url || null,
        file_size_bytes: form.file_size_bytes === '' ? null : parseInt(form.file_size_bytes, 10),
        cover_url: form.cover_url || null,
        access_tier: form.access_tier,
        download_allowed: !!form.download_allowed,
        tags,
      };
      if (editing) await libraryAPI.update(editing.id, payload);
      else await libraryAPI.create(payload);
      setFormOpen(false);
      notify('success', editing ? 'Resource updated.' : 'Resource added.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete “${row.title}”?`)) return;
    try {
      await libraryAPI.remove(row.id);
      load();
      if (view?.id === row.id) setView(null);
      notify('success', 'Resource deleted.');
    } catch (e) {
      notify('error', e.response?.data?.message || 'Delete failed');
    }
  };

  const openView = async (row) => {
    try {
      const res = await libraryAPI.getOne(row.id);
      setView(res.data.data);
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not open resource');
    }
  };

  return (
    <div>
      <PageHeader
        title="E-library"
        subtitle="Digital resources by category — opening a resource increments views."
        action={canManage ? <Button onClick={openCreate}>+ Add resource</Button> : undefined}
      />

      {notice && <NoticeBanner type={notice.type}>{notice.text}</NoticeBanner>}

      <Card>
        <div className="p-5 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search title, author…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:border-purple-400"
          />
          <input
            type="text"
            placeholder="Category"
            value={categoryQ}
            onChange={(e) => {
              setCategoryQ(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:border-purple-400"
          />
          <select
            value={formatQ}
            onChange={(e) => {
              setFormatQ(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
          >
            <option value="">All formats</option>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-gray-400">{pagination.total ?? 0} resources</span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <Table headers={['Title', 'Author', 'Category', 'Format', 'Views', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No resources yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.author || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.category || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="info">{r.format}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.view_count ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => openView(r)}>
                        Open
                      </Button>
                      {canManage && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => remove(r)}>
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
        title={view?.title || 'Resource'}
        footer={
          <div className="flex flex-wrap gap-2 justify-end">
            {view?.file_url && (
              <a href={view.file_url} target="_blank" rel="noreferrer">
                <Button>Open file ↗</Button>
              </a>
            )}
            <Button variant="outline" onClick={() => setView(null)}>
              Close
            </Button>
          </div>
        }
      >
        {view && (
          <div className="space-y-2 text-sm text-gray-700">
            {view.author && (
              <p>
                <span className="text-gray-400">Author:</span> {view.author}
              </p>
            )}
            {view.category && (
              <p>
                <span className="text-gray-400">Category:</span> {view.category}
              </p>
            )}
            {view.description && <p className="whitespace-pre-wrap">{view.description}</p>}
            <p className="text-xs text-gray-400 pt-2">Views after open: {view.view_count ?? 0}</p>
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit resource' : 'New resource'}
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
          <Input label="Title" value={form.title || ''} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Author" value={form.author || ''} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Category" value={form.category || ''} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            <Select label="Format" value={form.format || 'pdf'} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              className={textAreaCls}
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <Input label="File URL" value={form.file_url || ''} onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))} />
          <Input
            label="File size (bytes)"
            type="number"
            min={0}
            value={form.file_size_bytes}
            onChange={(e) => setForm((f) => ({ ...f, file_size_bytes: e.target.value }))}
          />
          <Input label="Cover image URL" value={form.cover_url || ''} onChange={(e) => setForm((f) => ({ ...f, cover_url: e.target.value }))} />
          <Input label="Tags (comma-separated)" value={form.tags || ''} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
          <Select label="Access tier" value={form.access_tier || 'all'} onChange={(e) => setForm((f) => ({ ...f, access_tier: e.target.value }))}>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
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
