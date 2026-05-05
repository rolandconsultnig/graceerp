import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { budgetAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table, NoticeBanner } from '../components/UI';

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

const canManageBudget = (role) => ['super_admin', 'branch_admin', 'finance_officer'].includes(role || '');
const B_STATUSES = ['draft', 'approved', 'active', 'closed'];

const EXP_STATUS_LABEL = {
  pending: '1/3 Awaiting department head',
  hod_approved: '2/3 Awaiting coordinating elder',
  elder_approved: '3/3 Awaiting coordinating pastor',
  approved: 'Fully approved (ready to pay)',
  rejected: 'Rejected',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

function canApproveExpenditure(user, row) {
  const r = user?.role;
  if (r === 'super_admin' || r === 'branch_admin') {
    return ['pending', 'hod_approved', 'elder_approved'].includes(row.status);
  }
  if (r === 'dept_head') return row.status === 'pending';
  if (r === 'coordinating_elder') return row.status === 'hod_approved';
  if (r === 'coordinating_pastor') return row.status === 'elder_approved';
  return false;
}

function canRejectExpenditure(user) {
  return [
    'super_admin',
    'branch_admin',
    'finance_officer',
    'dept_head',
    'coordinating_elder',
    'coordinating_pastor',
  ].includes(user?.role || '');
}

const canMarkPaid = (user) => ['super_admin', 'branch_admin', 'finance_officer'].includes(user?.role || '');

export default function BudgetPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageBudget(user?.role);

  const [tab, setTab] = useState('budgets');

  const [budRows, setBudRows] = useState([]);
  const [budPagination, setBudPagination] = useState({});
  const [budPage, setBudPage] = useState(1);
  const [budLoading, setBudLoading] = useState(true);

  const [expRows, setExpRows] = useState([]);
  const [expPagination, setExpPagination] = useState({});
  const [expPage, setExpPage] = useState(1);
  const [expLoading, setExpLoading] = useState(false);

  const [branches, setBranches] = useState([]);
  const [budgetPick, setBudgetPick] = useState([]);
  const [budModal, setBudModal] = useState(false);
  const [budForm, setBudForm] = useState({});
  const [expModal, setExpModal] = useState(false);
  const [expForm, setExpForm] = useState({});
  const [editExp, setEditExp] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const notify = (type, text) => setNotice({ type, text });

  useEffect(() => {
    branchesAPI
      .getAll({ limit: 300 })
      .then((r) => setBranches(r.data?.data ?? []))
      .catch(() => setBranches([]));
  }, []);

  const loadBudgets = async () => {
    setBudLoading(true);
    try {
      const res = await budgetAPI.getAll({ page: budPage, limit: 15 });
      const rows = res.data?.data ?? [];
      setBudRows(rows);
      setBudPagination(res.data?.pagination ?? {});
      setBudgetPick(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setBudLoading(false);
    }
  };

  useEffect(() => {
    loadBudgets();
  }, [budPage]);

  const loadExpenditure = async () => {
    setExpLoading(true);
    try {
      const res = await budgetAPI.listExpenditure({ page: expPage, limit: 20 });
      setExpRows(res.data?.data ?? []);
      setExpPagination(res.data?.pagination ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setExpLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'expenditure') loadExpenditure();
  }, [tab, expPage]);

  const openBudgetModal = () => {
    setBudForm({
      branch_id: user?.branch_id || '',
      fiscal_year: new Date().getFullYear(),
      department: '',
      total_amount: '',
      status: 'draft',
    });
    setBudModal(true);
  };

  const saveBudget = async () => {
    if (!budForm.fiscal_year || !budForm.department?.trim() || budForm.total_amount === '') {
      notify('error', 'Fiscal year, department, and total amount are required.');
      return;
    }
    if (!budForm.branch_id) {
      notify('error', 'Select a branch.');
      return;
    }
    setSaving(true);
    try {
      await budgetAPI.create({
        branch_id: budForm.branch_id,
        fiscal_year: parseInt(budForm.fiscal_year, 10),
        department: budForm.department.trim(),
        total_amount: Number(budForm.total_amount),
        status: budForm.status,
      });
      setBudModal(false);
      notify('success', 'Budget created successfully.');
      loadBudgets();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not create budget.');
    } finally {
      setSaving(false);
    }
  };

  const openExpModal = async () => {
    let buds = budRows;
    try {
      const res = await budgetAPI.getAll({ page: 1, limit: 200 });
      buds = res.data?.data ?? [];
      setBudgetPick(buds);
    } catch {
      setBudgetPick(budRows);
    }
    setExpForm({
      branch_id: user?.branch_id || '',
      budget_id: buds[0]?.id || '',
      title: '',
      amount: '',
      department: '',
      description: '',
    });
    setExpModal(true);
  };

  const saveExp = async () => {
    if (!expForm.title?.trim() || expForm.amount === '') {
      notify('error', 'Title and amount are required.');
      return;
    }
    if (!expForm.branch_id) {
      notify('error', 'Select a branch.');
      return;
    }
    setSaving(true);
    try {
      await budgetAPI.createExpenditure({
        branch_id: expForm.branch_id,
        budget_id: expForm.budget_id || undefined,
        title: expForm.title.trim(),
        amount: Number(expForm.amount),
        department: expForm.department || undefined,
        description: expForm.description || undefined,
      });
      setExpModal(false);
      notify('success', 'Expenditure request submitted.');
      loadExpenditure();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not create request.');
    } finally {
      setSaving(false);
    }
  };

  const saveExpEdit = async () => {
    if (!editExp) return;
    setSaving(true);
    try {
      const payload = {
        title: editExp.title,
        amount: editExp.amount != null ? Number(editExp.amount) : undefined,
      };
      if (canMarkPaid(user) && editExp.status === 'approved' && editExp.markPaid) {
        payload.status = 'paid';
        if (editExp.payment_date) payload.payment_date = editExp.payment_date;
        if (editExp.payment_method) payload.payment_method = editExp.payment_method;
      }
      await budgetAPI.updateExpenditure(editExp.id, payload);
      setEditExp(null);
      notify('success', 'Request updated.');
      loadExpenditure();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not update.');
    } finally {
      setSaving(false);
    }
  };

  const approveExp = async (row) => {
    try {
      await budgetAPI.approveExpenditure(row.id);
      notify('success', 'Approval recorded.');
      loadExpenditure();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Approval failed.');
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) {
      notify('error', 'Enter a rejection reason.');
      return;
    }
    setRejectSaving(true);
    try {
      await budgetAPI.rejectExpenditure(rejectTarget.id, { reason: rejectReason.trim() });
      setRejectTarget(null);
      setRejectReason('');
      notify('success', 'Request rejected.');
      loadExpenditure();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not reject.');
    } finally {
      setRejectSaving(false);
    }
  };

  const badgeVariant = (st) => {
    if (st === 'paid' || st === 'approved') return 'success';
    if (st === 'rejected' || st === 'cancelled') return 'danger';
    if (st === 'pending' || st === 'hod_approved' || st === 'elder_approved') return 'warning';
    return 'default';
  };

  const deleteExp = async (row) => {
    if (!confirm('Delete this expenditure request?')) return;
    try {
      await budgetAPI.deleteExpenditure(row.id);
      notify('success', 'Expenditure request deleted.');
      loadExpenditure();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not delete.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Budget & expenditure"
        subtitle="Annual budgets and spend approvals"
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTab('expenditure')}>
                Requests
              </Button>
              <Button onClick={openBudgetModal}>+ Budget</Button>
            </div>
          ) : null
        }
      />

      {notice && <NoticeBanner type={notice.type}>{notice.text}</NoticeBanner>}

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'budgets'} onClick={() => setTab('budgets')}>
          Budgets
        </TabButton>
        <TabButton active={tab === 'expenditure'} onClick={() => setTab('expenditure')}>
          Expenditure requests
        </TabButton>
      </div>

      {tab === 'budgets' && (
        <Card>
          <div className="p-5 border-b text-xs text-gray-400">{budPagination.total ?? 0} budgets</div>
          {budLoading ? (
            <Spinner />
          ) : (
            <Table headers={['FY', 'Department', 'Branch', 'Amount', 'Spent', 'Status']}>
              {budRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    No budgets
                  </td>
                </tr>
              ) : (
                budRows.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{b.fiscal_year}</td>
                    <td className="px-4 py-3 font-medium">{b.department}</td>
                    <td className="px-4 py-3 text-gray-600">{b.branch_name}</td>
                    <td className="px-4 py-3">{formatMoney(b.total_amount, b.currency)}</td>
                    <td className="px-4 py-3">{formatMoney(b.spent_amount, b.currency)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={b.status === 'active' ? 'success' : 'default'}>{b.status}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
          {budPagination.pages > 1 && (
            <div className="flex justify-between px-5 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setBudPage((p) => Math.max(1, p - 1))} disabled={budPage === 1}>
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBudPage((p) => p + 1)}
                disabled={budPage >= budPagination.pages}
              >
                Next →
              </Button>
            </div>
          )}
        </Card>
      )}

      {tab === 'expenditure' && (
        <Card>
          <div className="p-5 border-b flex justify-between">
            <span className="text-sm text-gray-600">{expPagination.total ?? 0} requests</span>
            {canManage ? <Button onClick={openExpModal}>+ Request</Button> : null}
          </div>
          {expLoading ? (
            <Spinner />
          ) : (
            <Table headers={['Title', 'Branch', 'Amount', 'Budget dept.', 'Approvals', 'Status', 'Actions']}>
              {expRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    No requests
                  </td>
                </tr>
              ) : (
                expRows.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{e.title}</td>
                    <td className="px-4 py-3 text-gray-600">{e.branch_name}</td>
                    <td className="px-4 py-3">{formatMoney(e.amount, e.currency)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{e.budget_department || '—'}</td>
                    <td className="px-4 py-3 text-center text-sm whitespace-nowrap" title="1 Dept head · 2 Coordinating elder · 3 Coordinating pastor">
                      <span className={e.hod_approved_at ? 'text-emerald-600 font-semibold' : 'text-gray-300'}>①</span>
                      <span className="text-gray-200 mx-0.5">·</span>
                      <span className={e.elder_approved_at ? 'text-emerald-600 font-semibold' : 'text-gray-300'}>②</span>
                      <span className="text-gray-200 mx-0.5">·</span>
                      <span className={e.pastor_approved_at ? 'text-emerald-600 font-semibold' : 'text-gray-300'}>③</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={badgeVariant(e.status)}>
                        {EXP_STATUS_LABEL[e.status] || e.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 items-center">
                        {canApproveExpenditure(user, e) && (
                          <Button size="sm" onClick={() => approveExp(e)}>
                            Approve
                          </Button>
                        )}
                        {canRejectExpenditure(user) && ['pending', 'hod_approved', 'elder_approved'].includes(e.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRejectTarget(e);
                              setRejectReason('');
                            }}
                          >
                            Reject
                          </Button>
                        )}
                        {canManage ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setEditExp({
                                  ...e,
                                  markPaid: false,
                                  payment_date: e.payment_date || '',
                                  payment_method: e.payment_method || '',
                                })
                              }
                            >
                              Edit
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => deleteExp(e)}>
                              Delete
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
          {expPagination.pages > 1 && (
            <div className="flex justify-between px-5 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setExpPage((p) => Math.max(1, p - 1))} disabled={expPage === 1}>
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpPage((p) => p + 1)}
                disabled={expPage >= expPagination.pages}
              >
                Next →
              </Button>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={budModal}
        onClose={() => !saving && setBudModal(false)}
        title="New budget line"
        footer={
          <>
            <Button variant="outline" onClick={() => setBudModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveBudget} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch" value={budForm.branch_id || ''} onChange={(e) => setBudForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input
            label="Fiscal year"
            type="number"
            value={budForm.fiscal_year ?? ''}
            onChange={(e) => setBudForm((f) => ({ ...f, fiscal_year: e.target.value }))}
          />
          <Input label="Department" value={budForm.department || ''} onChange={(e) => setBudForm((f) => ({ ...f, department: e.target.value }))} />
          <Input
            label="Total amount"
            type="number"
            value={budForm.total_amount ?? ''}
            onChange={(e) => setBudForm((f) => ({ ...f, total_amount: e.target.value }))}
          />
          <Select label="Status" value={budForm.status || 'draft'} onChange={(e) => setBudForm((f) => ({ ...f, status: e.target.value }))}>
            {B_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        open={expModal}
        onClose={() => !saving && setExpModal(false)}
        title="Expenditure request"
        footer={
          <>
            <Button variant="outline" onClick={() => setExpModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveExp} disabled={saving}>
              Submit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch" value={expForm.branch_id || ''} onChange={(e) => setExpForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            label="Link budget (optional)"
            value={expForm.budget_id || ''}
            onChange={(e) => setExpForm((f) => ({ ...f, budget_id: e.target.value }))}
          >
            <option value="">None</option>
            {(budgetPick.length ? budgetPick : budRows).map((b) => (
              <option key={b.id} value={b.id}>
                {b.fiscal_year} · {b.department}
              </option>
            ))}
          </Select>
          <Input label="Title" value={expForm.title || ''} onChange={(e) => setExpForm((f) => ({ ...f, title: e.target.value }))} />
          <Input type="number" label="Amount" value={expForm.amount ?? ''} onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} />
          <Input label="Department" value={expForm.department || ''} onChange={(e) => setExpForm((f) => ({ ...f, department: e.target.value }))} />
          <Input label="Description" value={expForm.description || ''} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} />
          <p className="text-xs text-gray-500">
            After submit, the request follows 3 approvals: department head → coordinating elder → coordinating pastor. Finance can record payment once fully approved.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!editExp}
        onClose={() => !saving && setEditExp(null)}
        title="Edit expenditure request"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditExp(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveExpEdit} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        {editExp && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Status: <strong>{EXP_STATUS_LABEL[editExp.status] || editExp.status}</strong>
            </p>
            <Input label="Title" value={editExp.title || ''} onChange={(e) => setEditExp((x) => ({ ...x, title: e.target.value }))} />
            <Input type="number" label="Amount" value={editExp.amount ?? ''} onChange={(e) => setEditExp((x) => ({ ...x, amount: e.target.value }))} />
            {canMarkPaid(user) && editExp.status === 'approved' && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <input
                    type="checkbox"
                    checked={!!editExp.markPaid}
                    onChange={(e) => setEditExp((x) => ({ ...x, markPaid: e.target.checked }))}
                  />
                  Record as paid (finance)
                </label>
                {editExp.markPaid && (
                  <>
                    <Input
                      type="date"
                      label="Payment date"
                      value={editExp.payment_date || ''}
                      onChange={(e) => setEditExp((x) => ({ ...x, payment_date: e.target.value }))}
                    />
                    <Input
                      label="Payment method"
                      value={editExp.payment_method || ''}
                      onChange={(e) => setEditExp((x) => ({ ...x, payment_method: e.target.value }))}
                      placeholder="e.g. Bank transfer"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejectTarget}
        onClose={() => !rejectSaving && setRejectTarget(null)}
        title="Reject expenditure request"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectSaving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitReject} disabled={rejectSaving || !rejectReason.trim()}>
              {rejectSaving ? 'Rejecting…' : 'Reject request'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-3">{rejectTarget?.title}</p>
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Reason (required)</label>
        <textarea
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[88px]"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Explain why this request is declined…"
        />
      </Modal>
    </div>
  );
}
