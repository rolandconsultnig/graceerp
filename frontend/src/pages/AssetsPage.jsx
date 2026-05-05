import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { assetsAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table, NoticeBanner } from '../components/UI';

const CATEGORIES = ['vehicle', 'equipment', 'instrument', 'it', 'furniture', 'building', 'land', 'other'];
const STATUSES = ['active', 'maintenance', 'disposed', 'transferred'];
const DEPREC_METHODS = [
  { value: 'straight_line', label: 'Straight-line' },
  { value: 'reducing_balance', label: 'Reducing balance' },
  { value: 'none', label: 'No depreciation' },
];
const MAINT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'preventive', label: 'Preventive' },
  { value: 'corrective', label: 'Corrective' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' },
];

const canManageAssets = (role) =>
  ['super_admin', 'branch_admin', 'finance_officer'].includes(role || '');

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function formatMoney(n, currency = 'NGN') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 });
}

function formatDepMethod(code) {
  return DEPREC_METHODS.find((d) => d.value === code)?.label || code || '—';
}

export default function AssetsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageAssets(user?.role);

  const [tab, setTab] = useState('register');

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryQ, setCategoryQ] = useState('');
  const [statusQ, setStatusQ] = useState('');
  const [loading, setLoading] = useState(true);

  const [upcoming, setUpcoming] = useState([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [histRows, setHistRows] = useState([]);
  const [histPagination, setHistPagination] = useState({});
  const [histPage, setHistPage] = useState(1);
  const [histLoading, setHistLoading] = useState(false);

  const [branches, setBranches] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const [maintAsset, setMaintAsset] = useState(null);
  const [maintRows, setMaintRows] = useState([]);
  const [maintLoading, setMaintLoading] = useState(false);
  const [maintForm, setMaintForm] = useState({
    maintenance_date: new Date().toISOString().slice(0, 10),
    description: '',
    maintenance_type: 'general',
    cost: '',
    vendor: '',
    performed_by: '',
    next_due_date: '',
    flag_asset_under_maintenance: false,
  });

  const [editMaint, setEditMaint] = useState(null);
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
      const res = await assetsAPI.getAll({
        page,
        limit: 15,
        search: search.trim() || undefined,
        category: categoryQ || undefined,
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
  }, [page, categoryQ, statusQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadUpcoming = async () => {
    setUpcomingLoading(true);
    try {
      const res = await assetsAPI.listMaintenanceUpcoming();
      setUpcoming(res.data?.data ?? []);
    } catch (e) {
      console.error(e);
      setUpcoming([]);
    } finally {
      setUpcomingLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const res = await assetsAPI.listMaintenanceHistory({ page: histPage, limit: 15 });
      setHistRows(res.data?.data ?? []);
      setHistPagination(res.data?.pagination ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setHistLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'maintenance') {
      loadUpcoming();
      loadHistory();
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'maintenance') loadHistory();
  }, [histPage, tab]);

  const openCreate = () => {
    setForm({
      branch_id: user?.branch_id || '',
      asset_tag: '',
      name: '',
      category: 'other',
      status: 'active',
      purchase_date: '',
      purchase_cost: '',
      salvage_value: '',
      useful_life_years: '',
      depreciation_method: 'straight_line',
      location: '',
      serial_number: '',
    });
    setFormOpen(true);
  };

  const handleCreate = async () => {
    if (!form.asset_tag?.trim() || !form.name?.trim()) {
      notify('error', 'Asset tag and name are required.');
      return;
    }
    if (!form.branch_id) {
      notify('error', 'Select a branch.');
      return;
    }
    setSaving(true);
    try {
      await assetsAPI.create({
        branch_id: form.branch_id,
        asset_tag: form.asset_tag.trim(),
        name: form.name.trim(),
        category: form.category,
        status: form.status,
        serial_number: form.serial_number?.trim() || undefined,
        purchase_date: form.purchase_date || undefined,
        purchase_cost: form.purchase_cost === '' ? null : Number(form.purchase_cost),
        salvage_value: form.salvage_value === '' ? null : Number(form.salvage_value),
        useful_life_years:
          form.useful_life_years === '' ? null : parseInt(form.useful_life_years, 10),
        depreciation_method: form.depreciation_method,
        location: form.location || null,
      });
      setFormOpen(false);
      notify('success', 'Asset created successfully.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not create asset.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (a) => {
    setEditForm({
      id: a.id,
      asset_tag: a.asset_tag || '',
      name: a.name || '',
      category: a.category || 'other',
      status: a.status || 'active',
      branch_id: a.branch_id || '',
      serial_number: a.serial_number || '',
      purchase_date: a.purchase_date ? String(a.purchase_date).slice(0, 10) : '',
      purchase_cost: a.purchase_cost ?? '',
      salvage_value: a.salvage_value ?? '',
      useful_life_years: a.useful_life_years ?? '',
      depreciation_method: a.depreciation_method || 'straight_line',
      current_value: a.current_value ?? '',
      location: a.location || '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name?.trim()) {
      notify('error', 'Name is required.');
      return;
    }
    setSaving(true);
    try {
      await assetsAPI.update(editForm.id, {
        asset_tag: editForm.asset_tag.trim(),
        name: editForm.name.trim(),
        category: editForm.category,
        status: editForm.status,
        branch_id: editForm.branch_id || undefined,
        serial_number: editForm.serial_number?.trim() || null,
        purchase_date: editForm.purchase_date || null,
        purchase_cost: editForm.purchase_cost === '' ? null : Number(editForm.purchase_cost),
        salvage_value: editForm.salvage_value === '' ? null : Number(editForm.salvage_value),
        useful_life_years:
          editForm.useful_life_years === '' ? null : parseInt(editForm.useful_life_years, 10),
        depreciation_method: editForm.depreciation_method,
        current_value: editForm.current_value === '' ? null : Number(editForm.current_value),
        location: editForm.location || null,
      });
      setEditOpen(false);
      notify('success', 'Asset updated successfully.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not update asset.');
    } finally {
      setSaving(false);
    }
  };

  const openMaintenance = async (asset) => {
    setMaintAsset(asset);
    setEditMaint(null);
    setMaintLoading(true);
    setMaintForm({
      maintenance_date: new Date().toISOString().slice(0, 10),
      description: '',
      maintenance_type: 'general',
      cost: '',
      vendor: '',
      performed_by: '',
      next_due_date: '',
      flag_asset_under_maintenance: false,
    });
    try {
      const res = await assetsAPI.listMaintenance(asset.id);
      setMaintRows(res.data?.data ?? []);
    } catch (e) {
      console.error(e);
      setMaintRows([]);
    } finally {
      setMaintLoading(false);
    }
  };

  const submitMaintenance = async () => {
    if (!maintForm.description?.trim()) {
      notify('error', 'Description is required.');
      return;
    }
    setSaving(true);
    try {
      await assetsAPI.addMaintenance(maintAsset.id, {
        maintenance_date: maintForm.maintenance_date,
        description: maintForm.description.trim(),
        maintenance_type: maintForm.maintenance_type,
        cost: maintForm.cost === '' ? null : Number(maintForm.cost),
        vendor: maintForm.vendor?.trim() || undefined,
        performed_by: maintForm.performed_by || undefined,
        next_due_date: maintForm.next_due_date || undefined,
        flag_asset_under_maintenance: maintForm.flag_asset_under_maintenance || undefined,
      });
      const res = await assetsAPI.listMaintenance(maintAsset.id);
      setMaintRows(res.data?.data ?? []);
      setMaintForm((f) => ({
        ...f,
        description: '',
        cost: '',
        vendor: '',
        flag_asset_under_maintenance: false,
      }));
      load();
      if (tab === 'maintenance') {
        loadUpcoming();
        loadHistory();
      }
      notify('success', 'Maintenance record logged.');
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not log maintenance.');
    } finally {
      setSaving(false);
    }
  };

  const saveEditMaint = async () => {
    if (!editMaint || !maintAsset) return;
    setSaving(true);
    try {
      await assetsAPI.updateMaintenance(maintAsset.id, editMaint.id, {
        maintenance_date: editMaint.maintenance_date,
        description: editMaint.description?.trim(),
        maintenance_type: editMaint.maintenance_type,
        cost: editMaint.cost === '' ? null : Number(editMaint.cost),
        vendor: editMaint.vendor?.trim() || null,
        performed_by: editMaint.performed_by?.trim() || null,
        next_due_date: editMaint.next_due_date || null,
      });
      const res = await assetsAPI.listMaintenance(maintAsset.id);
      setMaintRows(res.data?.data ?? []);
      setEditMaint(null);
      if (tab === 'maintenance') {
        loadUpcoming();
        loadHistory();
      }
      notify('success', 'Maintenance record updated.');
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not update record.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMaintRow = async (row) => {
    if (!maintAsset || !confirm('Delete this maintenance record?')) return;
    try {
      await assetsAPI.deleteMaintenance(maintAsset.id, row.id);
      const res = await assetsAPI.listMaintenance(maintAsset.id);
      setMaintRows(res.data?.data ?? []);
      if (tab === 'maintenance') {
        loadUpcoming();
        loadHistory();
      }
      notify('success', 'Maintenance record deleted.');
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not delete.');
    }
  };

  const dueBadge = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cmp = new Date(d);
    cmp.setHours(0, 0, 0, 0);
    if (cmp < today) return <Badge variant="danger">Overdue</Badge>;
    const diff = (cmp - today) / (86400000 * 30);
    if (diff <= 1) return <Badge variant="warning">Due soon</Badge>;
    return null;
  };

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle="Register property, depreciation (book value), and maintenance"
        action={canManage ? <Button onClick={openCreate}>+ Add asset</Button> : null}
      />
      {notice && <NoticeBanner type={notice.type}>{notice.text}</NoticeBanner>}

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'register'} onClick={() => setTab('register')}>
          Asset register
        </TabButton>
        <TabButton active={tab === 'maintenance'} onClick={() => setTab('maintenance')}>
          Maintenance hub
        </TabButton>
      </div>

      {tab === 'register' && (
        <Card>
          <div className="p-5 border-b border-gray-100 flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search tag, name, serial…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:border-purple-400"
            />
            <select
              value={categoryQ}
              onChange={(e) => {
                setCategoryQ(e.target.value);
                setPage(1);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
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
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-gray-400">{pagination.total ?? 0} assets</span>
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <Table headers={['Tag', 'Name', 'Branch', 'Book value', 'Depreciation', 'Category', 'Status', 'Actions']}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    No assets found
                  </td>
                </tr>
              ) : (
                rows.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{a.asset_tag}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{a.name}</td>
                    <td className="px-4 py-3 text-gray-600">{a.branch_name}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">
                      {formatMoney(a.depreciation?.book_value, a.currency)}
                      {a.depreciation?.is_depreciating && a.depreciation.accumulated_depreciation != null ? (
                        <span className="block text-xs text-gray-400">
                          Acc. dep.: {formatMoney(a.depreciation.accumulated_depreciation, a.currency)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {formatDepMethod(a.depreciation_method)}
                      {a.depreciation?.annual_depreciation != null ? (
                        <span className="block text-gray-400 mt-0.5">
                          ~{formatMoney(a.depreciation.annual_depreciation, a.currency)}/yr
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{a.category}</td>
                    <td className="px-4 py-3">
                      <Badge variant={a.status === 'active' ? 'success' : 'warning'}>{a.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button variant="outline" size="sm" onClick={() => openMaintenance(a)}>
                          Maintenance
                        </Button>
                        {canManage ? (
                          <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                            Edit
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Page {pagination.page} of {pagination.pages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  ← Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= pagination.pages}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === 'maintenance' && (
        <div className="space-y-6">
          <Card>
            <div className="p-5 border-b">
              <h3 className="text-sm font-semibold text-gray-800">Upcoming & overdue (by next due date)</h3>
              <p className="text-xs text-gray-500 mt-1">Rows with a scheduled next due date; open an asset to log work.</p>
            </div>
            {upcomingLoading ? (
              <Spinner />
            ) : (
              <Table headers={['Due', 'Asset', 'Branch', 'Last service', 'Type', 'Note']}>
                {upcoming.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">
                      No scheduled follow-ups. Log maintenance on an asset and set “next due”.
                    </td>
                  </tr>
                ) : (
                  upcoming.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {r.next_due_date}
                          {dueBadge(r.next_due_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-500">{r.asset_tag}</span>
                        <div className="font-medium text-gray-800">{r.asset_name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{r.branch_name}</td>
                      <td className="px-4 py-3 text-sm">{r.maintenance_date}</td>
                      <td className="px-4 py-3 text-xs">{r.maintenance_type || 'general'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={r.description}>
                        {r.description}
                      </td>
                    </tr>
                  ))
                )}
              </Table>
            )}
          </Card>

          <Card>
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-800">Maintenance history</h3>
              <span className="text-xs text-gray-400">{histPagination.total ?? 0} records</span>
            </div>
            {histLoading ? (
              <Spinner />
            ) : (
              <Table headers={['Date', 'Asset', 'Branch', 'Type', 'Cost', 'Vendor', 'Description']}>
                {histRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                      No maintenance logged yet.
                    </td>
                  </tr>
                ) : (
                  histRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{r.maintenance_date}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-gray-500">{r.asset_tag}</span>
                        <div className="font-medium text-gray-800">{r.asset_name}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{r.branch_name}</td>
                      <td className="px-4 py-3 text-xs">{r.maintenance_type || 'general'}</td>
                      <td className="px-4 py-3 text-sm tabular-nums">{formatMoney(r.cost)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{r.vendor || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={r.description}>
                        {r.description}
                      </td>
                    </tr>
                  ))
                )}
              </Table>
            )}
            {histPagination.pages > 1 && (
              <div className="flex justify-between px-5 py-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setHistPage((p) => Math.max(1, p - 1))} disabled={histPage === 1}>
                  ← Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistPage((p) => p + 1)}
                  disabled={histPage >= histPagination.pages}
                >
                  Next →
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title="New asset"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-gray-500 mb-4">
          Super admins pick the branch explicitly; others default to their branch. Depreciation computes book value from cost,
          salvage, life, purchase date, and method.
        </p>
        <div className="space-y-4">
          <Select label="Branch" value={form.branch_id || ''} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Asset tag" value={form.asset_tag || ''} onChange={(e) => setForm((f) => ({ ...f, asset_tag: e.target.value }))} />
          <Input label="Name" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Serial number (optional)" value={form.serial_number || ''} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" value={form.category || 'other'} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select label="Status" value={form.status || 'active'} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-purple-900 uppercase tracking-wide">Depreciation</p>
            <Input type="date" label="Purchase date" value={form.purchase_date || ''} onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                label="Purchase cost"
                value={form.purchase_cost ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, purchase_cost: e.target.value }))}
              />
              <Input
                type="number"
                label="Salvage / residual (optional)"
                value={form.salvage_value ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, salvage_value: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                label="Useful life (years)"
                value={form.useful_life_years ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, useful_life_years: e.target.value }))}
              />
              <Select
                label="Method"
                value={form.depreciation_method || 'straight_line'}
                onChange={(e) => setForm((f) => ({ ...f, depreciation_method: e.target.value }))}
              >
                {DEPREC_METHODS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Input label="Location (optional)" value={form.location || ''} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => !saving && setEditOpen(false)}
        title="Edit asset"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch" value={editForm.branch_id || ''} onChange={(e) => setEditForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Asset tag" value={editForm.asset_tag || ''} onChange={(e) => setEditForm((f) => ({ ...f, asset_tag: e.target.value }))} />
          <Input label="Name" value={editForm.name || ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Serial number" value={editForm.serial_number || ''} onChange={(e) => setEditForm((f) => ({ ...f, serial_number: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Category" value={editForm.category || 'other'} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select label="Status" value={editForm.status || 'active'} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-purple-900 uppercase tracking-wide">Depreciation</p>
            <Input type="date" label="Purchase date" value={editForm.purchase_date || ''} onChange={(e) => setEditForm((f) => ({ ...f, purchase_date: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                label="Purchase cost"
                value={editForm.purchase_cost ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, purchase_cost: e.target.value }))}
              />
              <Input
                type="number"
                label="Salvage / residual"
                value={editForm.salvage_value ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, salvage_value: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                label="Useful life (years)"
                value={editForm.useful_life_years ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, useful_life_years: e.target.value }))}
              />
              <Select
                label="Method"
                value={editForm.depreciation_method || 'straight_line'}
                onChange={(e) => setEditForm((f) => ({ ...f, depreciation_method: e.target.value }))}
              >
                {DEPREC_METHODS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              type="number"
              label="Manual current value (optional override)"
              value={editForm.current_value ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, current_value: e.target.value }))}
            />
            <p className="text-xs text-gray-500">When depreciation method is “none”, book value uses manual current value if set.</p>
          </div>
          <Input label="Location" value={editForm.location || ''} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={!!maintAsset}
        onClose={() => {
          if (saving) return;
          if (editMaint) setEditMaint(null);
          else setMaintAsset(null);
        }}
        title={maintAsset ? `Maintenance · ${maintAsset.name}` : ''}
        footer={
          editMaint ? (
            <>
              <Button variant="outline" onClick={() => setEditMaint(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveEditMaint} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMaintAsset(null)} disabled={saving}>
                Close
              </Button>
              {canManage ? (
                <Button onClick={submitMaintenance} disabled={saving}>
                  {saving ? 'Saving…' : 'Log maintenance'}
                </Button>
              ) : null}
            </>
          )
        }
      >
        {maintLoading ? (
          <Spinner />
        ) : editMaint ? (
          <div className="space-y-3">
            <Input
              label="Maintenance date"
              type="date"
              value={editMaint.maintenance_date?.slice?.(0, 10) || editMaint.maintenance_date}
              onChange={(e) => setEditMaint((x) => ({ ...x, maintenance_date: e.target.value }))}
            />
            <Select
              label="Type"
              value={editMaint.maintenance_type || 'general'}
              onChange={(e) => setEditMaint((x) => ({ ...x, maintenance_type: e.target.value }))}
            >
              {MAINT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input label="Description" value={editMaint.description || ''} onChange={(e) => setEditMaint((x) => ({ ...x, description: e.target.value }))} />
            <Input
              label="Cost"
              type="number"
              value={editMaint.cost ?? ''}
              onChange={(e) => setEditMaint((x) => ({ ...x, cost: e.target.value }))}
            />
            <Input label="Vendor" value={editMaint.vendor || ''} onChange={(e) => setEditMaint((x) => ({ ...x, vendor: e.target.value }))} />
            <Input label="Performed by" value={editMaint.performed_by || ''} onChange={(e) => setEditMaint((x) => ({ ...x, performed_by: e.target.value }))} />
            <Input
              label="Next due"
              type="date"
              value={editMaint.next_due_date?.slice?.(0, 10) || editMaint.next_due_date || ''}
              onChange={(e) => setEditMaint((x) => ({ ...x, next_due_date: e.target.value }))}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4 max-h-52 overflow-y-auto border border-gray-100 rounded-lg p-3 bg-gray-50">
              {maintRows.length === 0 ? (
                <p className="text-xs text-gray-400">No maintenance records yet.</p>
              ) : (
                maintRows.map((r) => (
                  <div key={r.id} className="text-xs border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-gray-700">
                        {r.maintenance_date} · {r.maintenance_type || 'general'}
                      </span>
                      {canManage ? (
                        <span className="flex gap-1 shrink-0">
                          <button type="button" className="text-purple-600 hover:underline" onClick={() => setEditMaint({ ...r })}>
                            Edit
                          </button>
                          <button type="button" className="text-red-600 hover:underline" onClick={() => deleteMaintRow(r)}>
                            Delete
                          </button>
                        </span>
                      ) : null}
                    </div>
                    <div className="text-gray-600">{r.description}</div>
                    {(r.vendor || r.cost != null) && (
                      <div className="text-gray-400 mt-0.5">
                        {r.vendor ? `${r.vendor}` : ''}
                        {r.cost != null ? ` · ${formatMoney(r.cost)}` : ''}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {canManage ? (
              <div className="space-y-3">
                <Input
                  label="Maintenance date"
                  type="date"
                  value={maintForm.maintenance_date}
                  onChange={(e) => setMaintForm((f) => ({ ...f, maintenance_date: e.target.value }))}
                />
                <Select
                  label="Type"
                  value={maintForm.maintenance_type}
                  onChange={(e) => setMaintForm((f) => ({ ...f, maintenance_type: e.target.value }))}
                >
                  {MAINT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Description"
                  value={maintForm.description}
                  onChange={(e) => setMaintForm((f) => ({ ...f, description: e.target.value }))}
                />
                <Input
                  label="Cost (optional)"
                  type="number"
                  value={maintForm.cost}
                  onChange={(e) => setMaintForm((f) => ({ ...f, cost: e.target.value }))}
                />
                <Input
                  label="Vendor (optional)"
                  value={maintForm.vendor}
                  onChange={(e) => setMaintForm((f) => ({ ...f, vendor: e.target.value }))}
                />
                <Input
                  label="Performed by (optional)"
                  value={maintForm.performed_by}
                  onChange={(e) => setMaintForm((f) => ({ ...f, performed_by: e.target.value }))}
                />
                <Input
                  label="Next due (optional)"
                  type="date"
                  value={maintForm.next_due_date}
                  onChange={(e) => setMaintForm((f) => ({ ...f, next_due_date: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={maintForm.flag_asset_under_maintenance}
                    onChange={(e) => setMaintForm((f) => ({ ...f, flag_asset_under_maintenance: e.target.checked }))}
                  />
                  Mark asset status as “maintenance” (use when work takes the asset offline)
                </label>
              </div>
            ) : (
              <p className="text-xs text-gray-500">You have read-only access to maintenance history.</p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
