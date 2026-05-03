import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { projectAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table } from '../components/UI';

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

const P_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high'];

const PROJECT_MANAGE_ROLES = ['super_admin', 'branch_admin', 'finance_officer', 'dept_head', 'pastor'];

const DEPT_BUDGET_ACTOR_ROLES = [
  'super_admin',
  'branch_admin',
  'finance_officer',
  'dept_head',
  'pastor',
  'coordinating_elder',
  'coordinating_pastor',
];

const SUBMISSION_STATUS_LABEL = {
  draft: 'Draft (not submitted)',
  pending: '1/3 Awaiting department head',
  hod_approved: '2/3 Awaiting coordinating elder',
  elder_approved: '3/3 Awaiting coordinating pastor',
  approved: 'Fully approved',
  rejected: 'Rejected',
};

function canManageProjects(role) {
  return PROJECT_MANAGE_ROLES.includes(role || '');
}

function canActOnDeptBudget(role) {
  return DEPT_BUDGET_ACTOR_ROLES.includes(role || '');
}

function canApproveDeptBudget(user, row) {
  const r = user?.role;
  if (r === 'super_admin' || r === 'branch_admin') {
    return ['pending', 'hod_approved', 'elder_approved'].includes(row.status);
  }
  if (r === 'dept_head') return row.status === 'pending';
  if (r === 'coordinating_elder') return row.status === 'hod_approved';
  if (r === 'coordinating_pastor') return row.status === 'elder_approved';
  return false;
}

function canRejectDeptBudget(user) {
  return [
    'super_admin',
    'branch_admin',
    'finance_officer',
    'dept_head',
    'coordinating_elder',
    'coordinating_pastor',
  ].includes(user?.role || '');
}

function canDeleteDeptSubmission(user, row) {
  const r = user?.role;
  const manage = ['super_admin', 'branch_admin', 'finance_officer'].includes(r || '');
  if (row.status === 'draft') {
    return manage || row.submitted_by === user?.id;
  }
  if (row.status === 'rejected') {
    return manage;
  }
  return false;
}

function canEditDeptSubmission(user, row) {
  const r = user?.role;
  const manage = ['super_admin', 'branch_admin', 'finance_officer'].includes(r || '');
  if (row.status === 'draft') return canActOnDeptBudget(r);
  if (['pending', 'hod_approved', 'elder_approved'].includes(row.status)) return manage;
  return false;
}

export default function ProjectsPage() {
  const user = useAuthStore((s) => s.user);
  const canProj = canManageProjects(user?.role);
  const canDept = canActOnDeptBudget(user?.role);

  const [tab, setTab] = useState('projects');

  const [projRows, setProjRows] = useState([]);
  const [projPagination, setProjPagination] = useState({});
  const [projPage, setProjPage] = useState(1);
  const [projLoading, setProjLoading] = useState(true);

  const [budRows, setBudRows] = useState([]);
  const [budPagination, setBudPagination] = useState({});
  const [budPage, setBudPage] = useState(1);
  const [budLoading, setBudLoading] = useState(false);

  const [branches, setBranches] = useState([]);
  const [projectPick, setProjectPick] = useState([]);

  const [projModal, setProjModal] = useState(false);
  const [projForm, setProjForm] = useState({});
  const [budModal, setBudModal] = useState(false);
  const [budForm, setBudForm] = useState({});
  const [editBud, setEditBud] = useState(null);

  const [saving, setSaving] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSaving, setRejectSaving] = useState(false);

  useEffect(() => {
    branchesAPI
      .getAll({ limit: 300 })
      .then((r) => setBranches(r.data?.data ?? []))
      .catch(() => setBranches([]));
  }, []);

  const loadProjects = async () => {
    setProjLoading(true);
    try {
      const res = await projectAPI.listProjects({ page: projPage, limit: 15 });
      setProjRows(res.data?.data ?? []);
      setProjPagination(res.data?.pagination ?? {});
      setProjectPick(res.data?.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setProjLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [projPage]);

  const loadDeptBudgets = async () => {
    setBudLoading(true);
    try {
      const res = await projectAPI.listDeptBudgets({ page: budPage, limit: 20 });
      setBudRows(res.data?.data ?? []);
      setBudPagination(res.data?.pagination ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setBudLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'dept-budgets') loadDeptBudgets();
  }, [tab, budPage]);

  const openProjModal = () => {
    setProjForm({
      branch_id: user?.branch_id || '',
      name: '',
      code: '',
      department: '',
      status: 'planning',
      priority: 'medium',
      start_date: '',
      end_date: '',
      budget_amount: '',
      description: '',
    });
    setProjModal(true);
  };

  const saveProject = async () => {
    if (!projForm.name?.trim()) {
      alert('Project name is required.');
      return;
    }
    if (!projForm.branch_id) {
      alert('Select a branch.');
      return;
    }
    setSaving(true);
    try {
      await projectAPI.createProject({
        branch_id: projForm.branch_id,
        name: projForm.name.trim(),
        code: projForm.code?.trim() || undefined,
        department: projForm.department?.trim() || undefined,
        status: projForm.status,
        priority: projForm.priority,
        start_date: projForm.start_date || undefined,
        end_date: projForm.end_date || undefined,
        budget_amount: projForm.budget_amount !== '' ? Number(projForm.budget_amount) : undefined,
        description: projForm.description?.trim() || undefined,
      });
      setProjModal(false);
      loadProjects();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not create project.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (row) => {
    if (!confirm(`Delete project “${row.name}”?`)) return;
    try {
      await projectAPI.removeProject(row.id);
      loadProjects();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not delete.');
    }
  };

  const openBudModal = async () => {
    let projs = projectPick;
    try {
      const res = await projectAPI.listProjects({ page: 1, limit: 200 });
      projs = res.data?.data ?? [];
      setProjectPick(projs);
    } catch {
      setProjectPick(projectPick);
    }
    setBudForm({
      branch_id: user?.branch_id || '',
      fiscal_year: new Date().getFullYear(),
      department: '',
      title: '',
      narrative: '',
      requested_amount: '',
      project_id: '',
      submitNow: false,
    });
    setBudModal(true);
  };

  const saveBud = async () => {
    if (!budForm.title?.trim() || budForm.requested_amount === '' || !budForm.department?.trim()) {
      alert('Title, department, and requested amount are required.');
      return;
    }
    if (!budForm.branch_id) {
      alert('Select a branch.');
      return;
    }
    setSaving(true);
    try {
      await projectAPI.createDeptBudget({
        branch_id: budForm.branch_id,
        fiscal_year: parseInt(budForm.fiscal_year, 10),
        department: budForm.department.trim(),
        title: budForm.title.trim(),
        narrative: budForm.narrative?.trim() || undefined,
        requested_amount: Number(budForm.requested_amount),
        project_id: budForm.project_id || undefined,
        status: budForm.submitNow ? 'pending' : 'draft',
      });
      setBudModal(false);
      loadDeptBudgets();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not create submission.');
    } finally {
      setSaving(false);
    }
  };

  const submitDraft = async (row) => {
    try {
      await projectAPI.submitDeptBudget(row.id);
      loadDeptBudgets();
    } catch (e) {
      alert(e.response?.data?.message || 'Submit failed.');
    }
  };

  const approveBud = async (row) => {
    try {
      await projectAPI.approveDeptBudget(row.id);
      loadDeptBudgets();
    } catch (e) {
      alert(e.response?.data?.message || 'Approval failed.');
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejectSaving(true);
    try {
      await projectAPI.rejectDeptBudget(rejectTarget.id, { reason: rejectReason.trim() });
      setRejectTarget(null);
      setRejectReason('');
      loadDeptBudgets();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not reject.');
    } finally {
      setRejectSaving(false);
    }
  };

  const deleteBud = async (row) => {
    if (!confirm('Delete this departmental budget submission?')) return;
    try {
      await projectAPI.deleteDeptBudget(row.id);
      loadDeptBudgets();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not delete.');
    }
  };

  const saveBudEdit = async () => {
    if (!editBud) return;
    setSaving(true);
    try {
      await projectAPI.updateDeptBudget(editBud.id, {
        fiscal_year: parseInt(editBud.fiscal_year, 10),
        department: editBud.department?.trim(),
        title: editBud.title?.trim(),
        narrative: editBud.narrative || undefined,
        requested_amount: Number(editBud.requested_amount),
        project_id: editBud.project_id || null,
      });
      setEditBud(null);
      loadDeptBudgets();
    } catch (e) {
      alert(e.response?.data?.message || 'Could not update.');
    } finally {
      setSaving(false);
    }
  };

  const badgeVariant = (st) => {
    if (st === 'approved') return 'success';
    if (st === 'rejected') return 'danger';
    if (st === 'draft') return 'default';
    if (st === 'pending' || st === 'hod_approved' || st === 'elder_approved') return 'warning';
    return 'default';
  };

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle="Branch projects and departmental budget submissions"
        action={
          canProj ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTab('dept-budgets')}>
                Dept budgets
              </Button>
              <Button onClick={openProjModal}>+ Project</Button>
            </div>
          ) : null
        }
      />

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'projects'} onClick={() => setTab('projects')}>
          Projects
        </TabButton>
        <TabButton active={tab === 'dept-budgets'} onClick={() => setTab('dept-budgets')}>
          Department budget submissions
        </TabButton>
      </div>

      {tab === 'projects' && (
        <Card>
          <div className="p-5 border-b text-xs text-gray-400">{projPagination.total ?? 0} projects</div>
          {projLoading ? (
            <Spinner />
          ) : (
            <Table headers={['Name', 'Branch', 'Department', 'Status', 'Budget', 'Dates', 'Actions']}>
              {projRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    No projects yet
                  </td>
                </tr>
              ) : (
                projRows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {p.code ? (
                        <span className="text-gray-500 mr-2 font-mono text-xs">{p.code}</span>
                      ) : null}
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.branch_name}</td>
                    <td className="px-4 py-3 text-sm">{p.department || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === 'active' ? 'success' : 'default'}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatMoney(p.budget_amount, p.currency)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {p.start_date || '—'} → {p.end_date || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {canProj ? (
                        <Button variant="danger" size="sm" onClick={() => deleteProject(p)}>
                          Delete
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
          {projPagination.pages > 1 && (
            <div className="flex justify-between px-5 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setProjPage((x) => Math.max(1, x - 1))} disabled={projPage === 1}>
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProjPage((x) => x + 1)}
                disabled={projPage >= projPagination.pages}
              >
                Next →
              </Button>
            </div>
          )}
        </Card>
      )}

      {tab === 'dept-budgets' && (
        <Card>
          <div className="p-5 border-b flex justify-between items-center">
            <span className="text-sm text-gray-600">{budPagination.total ?? 0} submissions</span>
            {canDept ? <Button onClick={openBudModal}>+ Submission</Button> : null}
          </div>
          {budLoading ? (
            <Spinner />
          ) : (
            <Table headers={['Title', 'Branch', 'FY', 'Dept', 'Amount', 'Approvals', 'Status', 'Actions']}>
              {budRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-400">
                    No departmental budget submissions
                  </td>
                </tr>
              ) : (
                budRows.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.title}</td>
                    <td className="px-4 py-3 text-gray-600">{d.branch_name}</td>
                    <td className="px-4 py-3">{d.fiscal_year}</td>
                    <td className="px-4 py-3 text-sm">{d.department}</td>
                    <td className="px-4 py-3">{formatMoney(d.requested_amount, d.currency)}</td>
                    <td className="px-4 py-3 text-center text-sm whitespace-nowrap">
                      <span className={d.hod_approved_at ? 'text-emerald-600 font-semibold' : 'text-gray-300'}>①</span>
                      <span className="text-gray-200 mx-0.5">·</span>
                      <span className={d.elder_approved_at ? 'text-emerald-600 font-semibold' : 'text-gray-300'}>②</span>
                      <span className="text-gray-200 mx-0.5">·</span>
                      <span className={d.pastor_approved_at ? 'text-emerald-600 font-semibold' : 'text-gray-300'}>③</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={badgeVariant(d.status)}>
                        {SUBMISSION_STATUS_LABEL[d.status] || d.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 items-center">
                        {d.status === 'draft' && canDept && (
                          <Button size="sm" onClick={() => submitDraft(d)}>
                            Submit
                          </Button>
                        )}
                        {canApproveDeptBudget(user, d) && (
                          <Button size="sm" onClick={() => approveBud(d)}>
                            Approve
                          </Button>
                        )}
                        {canRejectDeptBudget(user) && ['pending', 'hod_approved', 'elder_approved'].includes(d.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRejectTarget(d);
                              setRejectReason('');
                            }}
                          >
                            Reject
                          </Button>
                        )}
                        {canEditDeptSubmission(user, d) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const r = await projectAPI.listProjects({ page: 1, limit: 200 });
                                setProjectPick(r.data?.data ?? []);
                              } catch {
                                /* keep existing list */
                              }
                              setEditBud({ ...d });
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        {canDeleteDeptSubmission(user, d) && (
                          <Button variant="danger" size="sm" onClick={() => deleteBud(d)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
          {budPagination.pages > 1 && (
            <div className="flex justify-between px-5 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setBudPage((x) => Math.max(1, x - 1))} disabled={budPage === 1}>
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBudPage((x) => x + 1)}
                disabled={budPage >= budPagination.pages}
              >
                Next →
              </Button>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={projModal}
        onClose={() => !saving && setProjModal(false)}
        title="New project"
        footer={
          <>
            <Button variant="outline" onClick={() => setProjModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveProject} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch" value={projForm.branch_id || ''} onChange={(e) => setProjForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Name" value={projForm.name || ''} onChange={(e) => setProjForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Code (optional)" value={projForm.code || ''} onChange={(e) => setProjForm((f) => ({ ...f, code: e.target.value }))} />
          <Input label="Department" value={projForm.department || ''} onChange={(e) => setProjForm((f) => ({ ...f, department: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={projForm.status || 'planning'} onChange={(e) => setProjForm((f) => ({ ...f, status: e.target.value }))}>
              {P_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select label="Priority" value={projForm.priority || 'medium'} onChange={(e) => setProjForm((f) => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" label="Start" value={projForm.start_date || ''} onChange={(e) => setProjForm((f) => ({ ...f, start_date: e.target.value }))} />
            <Input type="date" label="End" value={projForm.end_date || ''} onChange={(e) => setProjForm((f) => ({ ...f, end_date: e.target.value }))} />
          </div>
          <Input
            type="number"
            label="Budget amount (optional)"
            value={projForm.budget_amount ?? ''}
            onChange={(e) => setProjForm((f) => ({ ...f, budget_amount: e.target.value }))}
          />
          <Input label="Description" value={projForm.description || ''} onChange={(e) => setProjForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={budModal}
        onClose={() => !saving && setBudModal(false)}
        title="Department budget submission"
        footer={
          <>
            <Button variant="outline" onClick={() => setBudModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveBud} disabled={saving}>
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
          <Select
            label="Link project (optional)"
            value={budForm.project_id || ''}
            onChange={(e) => setBudForm((f) => ({ ...f, project_id: e.target.value }))}
          >
            <option value="">None</option>
            {projectPick.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            label="Fiscal year"
            value={budForm.fiscal_year ?? ''}
            onChange={(e) => setBudForm((f) => ({ ...f, fiscal_year: e.target.value }))}
          />
          <Input label="Department" value={budForm.department || ''} onChange={(e) => setBudForm((f) => ({ ...f, department: e.target.value }))} />
          <Input label="Title" value={budForm.title || ''} onChange={(e) => setBudForm((f) => ({ ...f, title: e.target.value }))} />
          <Input type="number" label="Requested amount" value={budForm.requested_amount ?? ''} onChange={(e) => setBudForm((f) => ({ ...f, requested_amount: e.target.value }))} />
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Narrative</label>
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[88px]"
            value={budForm.narrative || ''}
            onChange={(e) => setBudForm((f) => ({ ...f, narrative: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!budForm.submitNow}
              onChange={(e) => setBudForm((f) => ({ ...f, submitNow: e.target.checked }))}
            />
            Submit immediately for approval (otherwise saved as draft)
          </label>
          <p className="text-xs text-gray-500">
            After submit, approvals follow: department head → coordinating elder → coordinating pastor (same as expenditure requests).
          </p>
        </div>
      </Modal>

      <Modal
        open={!!editBud}
        onClose={() => !saving && setEditBud(null)}
        title="Edit submission"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditBud(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveBudEdit} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        {editBud && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Status: <strong>{SUBMISSION_STATUS_LABEL[editBud.status] || editBud.status}</strong>
            </p>
            <Input
              type="number"
              label="Fiscal year"
              value={editBud.fiscal_year ?? ''}
              onChange={(e) => setEditBud((x) => ({ ...x, fiscal_year: e.target.value }))}
            />
            <Input label="Department" value={editBud.department || ''} onChange={(e) => setEditBud((x) => ({ ...x, department: e.target.value }))} />
            <Input label="Title" value={editBud.title || ''} onChange={(e) => setEditBud((x) => ({ ...x, title: e.target.value }))} />
            <Input
              type="number"
              label="Requested amount"
              value={editBud.requested_amount ?? ''}
              onChange={(e) => setEditBud((x) => ({ ...x, requested_amount: e.target.value }))}
            />
            <Select
              label="Project (optional)"
              value={editBud.project_id || ''}
              onChange={(e) => setEditBud((x) => ({ ...x, project_id: e.target.value || null }))}
            >
              <option value="">None</option>
              {projectPick.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Narrative</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[88px]"
              value={editBud.narrative || ''}
              onChange={(e) => setEditBud((x) => ({ ...x, narrative: e.target.value }))}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejectTarget}
        onClose={() => !rejectSaving && setRejectTarget(null)}
        title="Reject departmental budget submission"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectSaving}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitReject} disabled={rejectSaving || !rejectReason.trim()}>
              {rejectSaving ? 'Rejecting…' : 'Reject'}
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
          placeholder="Explain why this submission is declined…"
        />
      </Modal>
    </div>
  );
}
