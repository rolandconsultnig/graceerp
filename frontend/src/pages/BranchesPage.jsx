import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table } from '../components/UI';

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'archived', label: 'Archived' },
];

const emptyForm = () => ({
  name: '',
  code: '',
  address: '',
  city: '',
  state: '',
  country: 'Nigeria',
  phone: '',
  email: '',
  service_schedule: '',
  capacity: '',
  is_headquarters: false,
  status: 'active',
});

export default function BranchesPage() {
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === 'super_admin';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setBanner(null);
    try {
      const params = isSuper
        ? { include_all_statuses: true, limit: 500 }
        : { limit: 100 };
      const res = await branchesAPI.getAll(params);
      setRows(res.data?.data ?? []);
    } catch (e) {
      setBanner({ type: 'error', text: e.response?.data?.message || 'Could not load congregations.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [isSuper]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (b) => {
    setEditingId(b.id);
    setForm({
      name: b.name || '',
      code: b.code || '',
      address: b.address || '',
      city: b.city || '',
      state: b.state || '',
      country: b.country || 'Nigeria',
      phone: b.phone || '',
      email: b.email || '',
      service_schedule: b.service_schedule || '',
      capacity: b.capacity != null ? String(b.capacity) : '',
      is_headquarters: !!b.is_headquarters,
      status: b.status || 'active',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setBanner({ type: 'error', text: 'Name is required.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        capacity: form.capacity === '' ? null : parseInt(form.capacity, 10),
      };
      if (payload.capacity !== null && Number.isNaN(payload.capacity)) {
        setBanner({ type: 'error', text: 'Capacity must be a number.' });
        setSaving(false);
        return;
      }
      if (editingId) {
        await branchesAPI.update(editingId, payload);
      } else {
        await branchesAPI.create(payload);
      }
      setShowModal(false);
      await load();
    } catch (e) {
      setBanner({ type: 'error', text: e.response?.data?.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (b) => {
    if (!window.confirm(`Archive "${b.name}"? Members linked here stay in the database; you can set status back to active later.`)) return;
    try {
      await branchesAPI.remove(b.id);
      await load();
    } catch (e) {
      setBanner({ type: 'error', text: e.response?.data?.message || 'Archive failed.' });
    }
  };

  const statusBadge = (s) => {
    const map = {
      active: 'success',
      pending: 'warning',
      suspended: 'danger',
      archived: 'default',
    };
    return <Badge variant={map[s] || 'default'}>{s}</Badge>;
  };

  return (
    <div>
      <PageHeader
        title="Congregations & branches"
        subtitle={
          isSuper
            ? 'Create congregations, mark HQ, and archive unused sites.'
            : 'Your assigned congregation — contact HQ for structural changes.'
        }
        action={
          isSuper ? (
            <Button onClick={openCreate}>+ Add congregation</Button>
          ) : undefined
        }
      />

      {banner && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            banner.type === 'error' ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
          }`}
        >
          {banner.text}
        </div>
      )}

      <Card>
        {loading ? (
          <Spinner />
        ) : (
          <Table headers={['Congregation', 'Location', 'Code', 'HQ', 'Status', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No congregations found.
                </td>
              </tr>
            ) : (
              rows.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{b.name}</div>
                    {b.email && <div className="text-xs text-gray-400">{b.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {[b.city, b.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm font-mono">{b.code || '—'}</td>
                  <td className="px-4 py-3">{b.is_headquarters ? <Badge variant="purple">HQ</Badge> : '—'}</td>
                  <td className="px-4 py-3">{statusBadge(b.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {isSuper && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openEdit(b)}>
                            Edit
                          </Button>
                          {b.status !== 'archived' && (
                            <Button variant="danger" size="sm" onClick={() => handleArchive(b)}>
                              Archive
                            </Button>
                          )}
                        </>
                      )}
                      {!isSuper && (
                        <span className="text-xs text-gray-400">View only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </Table>
        )}
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit congregation' : 'New congregation'}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Main sanctuary · Citec Estate"
          />
          <Input
            label="Short code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="Optional unique code"
          />
        </div>
        <Input
          label="Address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          <Input label="State" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <Input
          label="Service schedule"
          value={form.service_schedule}
          onChange={(e) => setForm((f) => ({ ...f, service_schedule: e.target.value }))}
          placeholder="e.g. Sun 9am · Wed 6pm"
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Seating capacity"
            type="number"
            min={0}
            value={form.capacity}
            onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
          />
          <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_headquarters}
            onChange={(e) => setForm((f) => ({ ...f, is_headquarters: e.target.checked }))}
          />
          Headquarters congregation (clears HQ flag from others)
        </label>
        </div>
      </Modal>
    </div>
  );
}
