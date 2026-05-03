import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { documentsAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table } from '../components/UI';

const canManageDocs = (role) => ['super_admin', 'branch_admin'].includes(role || '');

export default function DocumentsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageDocs(user?.role);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [branches, setBranches] = useState([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [uploadMeta, setUploadMeta] = useState({
    title: '',
    branch_id: '',
    document_type: '',
    category: '',
    tags: '',
  });
  const [editDoc, setEditDoc] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    branchesAPI
      .getAll({ limit: 300 })
      .then((r) => setBranches(r.data?.data ?? []))
      .catch(() => setBranches([]));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await documentsAPI.getAll({
        page,
        limit: 15,
        search: search.trim() || undefined,
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
  }, [page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const openUpload = () => {
    setFile(null);
    setUploadMeta({
      title: '',
      branch_id: '',
      document_type: '',
      category: '',
      tags: '',
    });
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    if (!file) {
      alert('Choose a file.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', uploadMeta.title?.trim() || file.name);
    if (uploadMeta.branch_id) fd.append('branch_id', uploadMeta.branch_id);
    if (uploadMeta.document_type) fd.append('document_type', uploadMeta.document_type);
    if (uploadMeta.category) fd.append('category', uploadMeta.category);
    if (uploadMeta.tags?.trim()) fd.append('tags', uploadMeta.tags.trim());

    setSaving(true);
    try {
      await documentsAPI.uploadFile(fd);
      setUploadOpen(false);
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editDoc) return;
    const raw = (editDoc.tagsStr ?? '').trim();
    let tagsPayload = undefined;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        tagsPayload = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        tagsPayload = raw.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    setSaving(true);
    try {
      await documentsAPI.update(editDoc.id, {
        title: editDoc.title,
        document_type: editDoc.document_type || undefined,
        category: editDoc.category || undefined,
        version: editDoc.version !== '' && editDoc.version != null ? Number(editDoc.version) : undefined,
        tags: tagsPayload,
      });
      setEditDoc(null);
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const removeDoc = async (d) => {
    if (!confirm('Delete this document record?')) return;
    try {
      await documentsAPI.remove(d.id);
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Delete failed.');
    }
  };

  const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/i, '') || '';

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Policies, manuals, and uploaded files"
        action={canManage ? <Button onClick={openUpload}>+ Upload</Button> : null}
      />

      <Card>
        <div className="p-5 border-b flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search title…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64"
          />
          <span className="ml-auto text-xs text-gray-400">{pagination.total ?? 0} documents</span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <Table headers={['Title', 'Type', 'Branch', 'File', 'Version', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No documents
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{d.document_type || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{d.branch_name || '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {d.file_url ? (
                      <a
                        className="text-purple-600 hover:underline"
                        href={`${apiOrigin}${d.file_url}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">{d.version ?? '—'}</td>
                  <td className="px-4 py-3 flex gap-2">
                    {canManage ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditDoc({
                              ...d,
                              tagsStr:
                                typeof d.tags === 'object' && d.tags !== null ? JSON.stringify(d.tags) : d.tags || '',
                            })
                          }
                        >
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => removeDoc(d)}>
                          Delete
                        </Button>
                      </>
                    ) : (
                      '—'
                    )}
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
        open={uploadOpen}
        onClose={() => !saving && setUploadOpen(false)}
        title="Upload document"
        footer={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitUpload} disabled={saving}>
              {saving ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input type="file" label="File" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Input label="Title" value={uploadMeta.title} onChange={(e) => setUploadMeta((m) => ({ ...m, title: e.target.value }))} placeholder="Defaults to filename" />
          <Select label="Branch (optional)" value={uploadMeta.branch_id} onChange={(e) => setUploadMeta((m) => ({ ...m, branch_id: e.target.value }))}>
            <option value="">Church-wide</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Document type" value={uploadMeta.document_type} onChange={(e) => setUploadMeta((m) => ({ ...m, document_type: e.target.value }))} />
          <Input label="Category" value={uploadMeta.category} onChange={(e) => setUploadMeta((m) => ({ ...m, category: e.target.value }))} />
          <Input label="Tags (comma-separated or JSON array)" value={uploadMeta.tags} onChange={(e) => setUploadMeta((m) => ({ ...m, tags: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={!!editDoc}
        onClose={() => !saving && setEditDoc(null)}
        title="Edit metadata"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditDoc(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        {editDoc && (
          <div className="space-y-4">
            <Input label="Title" value={editDoc.title || ''} onChange={(e) => setEditDoc((d) => ({ ...d, title: e.target.value }))} />
            <Input label="Document type" value={editDoc.document_type || ''} onChange={(e) => setEditDoc((d) => ({ ...d, document_type: e.target.value }))} />
            <Input label="Category" value={editDoc.category || ''} onChange={(e) => setEditDoc((d) => ({ ...d, category: e.target.value }))} />
            <Input label="Version" type="number" value={editDoc.version ?? ''} onChange={(e) => setEditDoc((d) => ({ ...d, version: e.target.value }))} />
            <Input label="Tags (comma-separated or JSON)" value={editDoc.tagsStr ?? ''} onChange={(e) => setEditDoc((d) => ({ ...d, tagsStr: e.target.value }))} />
          </div>
        )}
      </Modal>
    </div>
  );
}
