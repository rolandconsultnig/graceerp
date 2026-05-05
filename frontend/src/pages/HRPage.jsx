import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { canManageHrModule } from '../constants/roleAccess';
import { hrAPI, branchesAPI } from '../services/api';
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

const EMP_TYPES = ['full_time', 'part_time', 'contract', 'volunteer'];
const LEAVE_TYPES = ['annual', 'sick', 'compassionate', 'maternity', 'paternity', 'unpaid'];
const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

export default function HRPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageHrModule(user?.role);
  const hrReadOnlyFinance = user?.role === 'finance_officer';

  const [tab, setTab] = useState('staff');

  const [staffRows, setStaffRows] = useState([]);
  const [staffPagination, setStaffPagination] = useState({});
  const [staffPage, setStaffPage] = useState(1);
  const [staffSearch, setStaffSearch] = useState('');
  const [staffLoading, setStaffLoading] = useState(true);

  const [leaveRows, setLeaveRows] = useState([]);
  const [leavePagination, setLeavePagination] = useState({});
  const [leavePage, setLeavePage] = useState(1);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const [branches, setBranches] = useState([]);
  const [staffModal, setStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({});
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({});
  const [leaveStaffPick, setLeaveStaffPick] = useState([]);
  const [editLeave, setEditLeave] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const notify = (type, text) => setNotice({ type, text });

  useEffect(() => {
    branchesAPI
      .getAll({ limit: 300 })
      .then((r) => setBranches(r.data?.data ?? []))
      .catch(() => setBranches([]));
  }, []);

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await hrAPI.getAll({
        page: staffPage,
        limit: 15,
        search: staffSearch.trim() || undefined,
      });
      setStaffRows(res.data?.data ?? []);
      setStaffPagination(res.data?.pagination ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, [staffPage]);

  useEffect(() => {
    const t = setTimeout(() => {
      setStaffPage(1);
      loadStaff();
    }, 350);
    return () => clearTimeout(t);
  }, [staffSearch]);

  const loadLeave = async () => {
    setLeaveLoading(true);
    try {
      const res = await hrAPI.listLeaveRequests({ page: leavePage, limit: 20 });
      setLeaveRows(res.data?.data ?? []);
      setLeavePagination(res.data?.pagination ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'leave') loadLeave();
  }, [tab, leavePage]);

  const openStaffModal = () => {
    setStaffForm({
      branch_id: user?.branch_id || '',
      full_name: '',
      employment_type: 'full_time',
      department: '',
      email: '',
      employee_number: '',
      is_active: true,
    });
    setStaffModal(true);
  };

  const openEditStaff = (s) => {
    setStaffForm({
      id: s.id,
      branch_id: s.branch_id || '',
      full_name: s.full_name || '',
      employment_type: s.employment_type || 'full_time',
      department: s.department || '',
      email: s.email || '',
      employee_number: s.employee_number || '',
      is_active: s.is_active !== false,
    });
    setStaffModal(true);
  };

  const saveStaff = async () => {
    if (!staffForm.full_name?.trim()) {
      notify('error', 'Full name is required.');
      return;
    }
    if (!staffForm.branch_id) {
      notify('error', 'Select a branch.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        branch_id: staffForm.branch_id,
        full_name: staffForm.full_name.trim(),
        employment_type: staffForm.employment_type,
        department: staffForm.department || undefined,
        email: staffForm.email || undefined,
        employee_number: staffForm.employee_number || undefined,
        is_active: staffForm.is_active !== false,
      };
      if (staffForm.id) {
        await hrAPI.update(staffForm.id, payload);
      } else {
        await hrAPI.create(payload);
      }
      setStaffModal(false);
      notify('success', staffForm.id ? 'Staff record updated.' : 'Staff record created.');
      loadStaff();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not save staff record.');
    } finally {
      setSaving(false);
    }
  };

  const deleteStaffMember = async (s) => {
    if (!confirm(`Remove staff record for ${s.full_name}? This cannot be undone.`)) return;
    try {
      await hrAPI.remove(s.id);
      notify('success', 'Staff record removed.');
      loadStaff();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not remove staff.');
    }
  };

  const openLeaveModal = async () => {
    let list = staffRows;
    try {
      const res = await hrAPI.getAll({ page: 1, limit: 200 });
      list = res.data?.data ?? [];
    } catch {
      /* keep staffRows */
    }
    setLeaveStaffPick(list);
    setLeaveForm({
      staff_id: list[0]?.id || '',
      leave_type: 'annual',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      days_requested: '',
      reason: '',
    });
    setLeaveModal(true);
  };

  const saveLeave = async () => {
    if (!leaveForm.staff_id || !leaveForm.start_date || !leaveForm.end_date) {
      notify('error', 'Staff and dates are required.');
      return;
    }
    if (leaveForm.end_date < leaveForm.start_date) {
      notify('error', 'End date cannot be earlier than start date.');
      return;
    }
    setSaving(true);
    try {
      await hrAPI.createLeaveRequest({
        staff_id: leaveForm.staff_id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        days_requested: leaveForm.days_requested === '' ? undefined : parseInt(leaveForm.days_requested, 10),
        reason: leaveForm.reason || undefined,
      });
      setLeaveModal(false);
      notify('success', 'Leave request submitted.');
      loadLeave();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not submit leave request.');
    } finally {
      setSaving(false);
    }
  };

  const saveLeaveStatus = async () => {
    if (!editLeave) return;
    setSaving(true);
    try {
      await hrAPI.updateLeaveRequest(editLeave.id, { status: editLeave.status });
      setEditLeave(null);
      notify('success', 'Leave status updated.');
      loadLeave();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Could not update leave.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Human resources"
        subtitle={
          hrReadOnlyFinance
            ? 'View only — staff and leave lists for finance visibility (no edits).'
            : 'Staff records and leave workflow'
        }
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setTab('leave')}>
                Leave requests
              </Button>
              <Button onClick={openStaffModal}>+ Staff</Button>
            </div>
          ) : null
        }
      />
      {notice && <NoticeBanner type={notice.type}>{notice.text}</NoticeBanner>}

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'staff'} onClick={() => setTab('staff')}>
          Staff
        </TabButton>
        <TabButton active={tab === 'leave'} onClick={() => setTab('leave')}>
          Leave
        </TabButton>
      </div>

      {tab === 'staff' && (
        <Card>
          <div className="p-5 border-b flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Search staff…"
              value={staffSearch}
              onChange={(e) => {
                setStaffSearch(e.target.value);
                setStaffPage(1);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64"
            />
            <span className="ml-auto text-xs text-gray-400">{staffPagination.total ?? 0} staff</span>
          </div>
          {staffLoading ? (
            <Spinner />
          ) : (
            <Table
              headers={
                canManage
                  ? ['Name', 'Branch', 'Department', 'Type', 'Active', 'Actions']
                  : ['Name', 'Branch', 'Department', 'Type', 'Active']
              }
            >
              {staffRows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="text-center py-10 text-gray-400">
                    No staff
                  </td>
                </tr>
              ) : (
                staffRows.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{s.full_name}</div>
                      {s.employee_number ? (
                        <div className="text-xs text-gray-400 font-mono">{s.employee_number}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.branch_name}</td>
                    <td className="px-4 py-3 text-gray-600">{s.department || '—'}</td>
                    <td className="px-4 py-3 text-xs">{s.employment_type}</td>
                    <td className="px-4 py-3">
                      <Badge variant={s.is_active ? 'success' : 'default'}>{s.is_active ? 'active' : 'inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="outline" size="sm" onClick={() => openEditStaff(s)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => deleteStaffMember(s)}>
                            Remove
                          </Button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
          {staffPagination.pages > 1 && (
            <div className="flex justify-between px-5 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setStaffPage((p) => Math.max(1, p - 1))} disabled={staffPage === 1}>
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStaffPage((p) => p + 1)}
                disabled={staffPage >= staffPagination.pages}
              >
                Next →
              </Button>
            </div>
          )}
        </Card>
      )}

      {tab === 'leave' && (
        <Card>
          <div className="p-5 border-b flex justify-between">
            <span className="text-sm text-gray-600">{leavePagination.total ?? 0} requests</span>
            {canManage ? <Button onClick={openLeaveModal}>+ Request leave</Button> : null}
          </div>
          {leaveLoading ? (
            <Spinner />
          ) : (
            <Table
              headers={
                canManage
                  ? ['Staff', 'Branch', 'Type', 'Dates', 'Status', 'Actions']
                  : ['Staff', 'Branch', 'Type', 'Dates', 'Status']
              }
            >
              {leaveRows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="text-center py-10 text-gray-400">
                    No leave requests
                  </td>
                </tr>
              ) : (
                leaveRows.map((lr) => (
                  <tr key={lr.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{lr.staff_name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{lr.branch_name}</td>
                    <td className="px-4 py-3 text-xs">{lr.leave_type}</td>
                    <td className="px-4 py-3 text-xs">
                      {lr.start_date} → {lr.end_date}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          lr.status === 'approved' ? 'success' : lr.status === 'rejected' ? 'danger' : 'warning'
                        }
                      >
                        {lr.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <Button variant="outline" size="sm" onClick={() => setEditLeave({ ...lr })}>
                          Update
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </Table>
          )}
          {leavePagination.pages > 1 && (
            <div className="flex justify-between px-5 py-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setLeavePage((p) => Math.max(1, p - 1))} disabled={leavePage === 1}>
                ← Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLeavePage((p) => p + 1)}
                disabled={leavePage >= leavePagination.pages}
              >
                Next →
              </Button>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={staffModal}
        onClose={() => !saving && setStaffModal(false)}
        title={staffForm.id ? 'Edit staff' : 'New staff'}
        footer={
          <>
            <Button variant="outline" onClick={() => setStaffModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveStaff} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch" value={staffForm.branch_id || ''} onChange={(e) => setStaffForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input label="Full name" value={staffForm.full_name || ''} onChange={(e) => setStaffForm((f) => ({ ...f, full_name: e.target.value }))} />
          <Select
            label="Employment type"
            value={staffForm.employment_type || 'full_time'}
            onChange={(e) => setStaffForm((f) => ({ ...f, employment_type: e.target.value }))}
          >
            {EMP_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input label="Department" value={staffForm.department || ''} onChange={(e) => setStaffForm((f) => ({ ...f, department: e.target.value }))} />
          <Input label="Email" type="email" value={staffForm.email || ''} onChange={(e) => setStaffForm((f) => ({ ...f, email: e.target.value }))} />
          <Input
            label="Employee # (optional)"
            value={staffForm.employee_number || ''}
            onChange={(e) => setStaffForm((f) => ({ ...f, employee_number: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={staffForm.is_active !== false}
              onChange={(e) => setStaffForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Active
          </label>
        </div>
      </Modal>

      <Modal
        open={leaveModal}
        onClose={() => !saving && setLeaveModal(false)}
        title="Leave request"
        footer={
          <>
            <Button variant="outline" onClick={() => setLeaveModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveLeave} disabled={saving}>
              Submit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Staff"
            value={leaveForm.staff_id || ''}
            onChange={(e) => setLeaveForm((f) => ({ ...f, staff_id: e.target.value }))}
          >
            <option value="">Select…</option>
            {leaveStaffPick.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} · {s.branch_name}
              </option>
            ))}
          </Select>
          <Select
            label="Leave type"
            value={leaveForm.leave_type || 'annual'}
            onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value }))}
          >
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            label="Start"
            value={leaveForm.start_date || ''}
            onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))}
          />
          <Input type="date" label="End" value={leaveForm.end_date || ''} onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))} />
          <Input
            label="Days requested (optional)"
            type="number"
            value={leaveForm.days_requested ?? ''}
            onChange={(e) => setLeaveForm((f) => ({ ...f, days_requested: e.target.value }))}
          />
          <Input label="Reason" value={leaveForm.reason || ''} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={!!editLeave}
        onClose={() => !saving && setEditLeave(null)}
        title="Update leave status"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditLeave(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveLeaveStatus} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        {editLeave && (
          <Select label="Status" value={editLeave.status} onChange={(e) => setEditLeave((x) => ({ ...x, status: e.target.value }))}>
            {LEAVE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        )}
      </Modal>
    </div>
  );
}
