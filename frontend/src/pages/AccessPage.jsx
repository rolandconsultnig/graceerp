import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { usersAPI, branchesAPI } from '../services/api';
import { PageHeader, Card, Badge, Button, Modal, Input, Select, Spinner, Table, NoticeBanner } from '../components/UI';

const ROLES = [
  ['super_admin', 'Super administrator'],
  ['branch_admin', 'Branch administrator'],
  ['finance_officer', 'Finance officer'],
  ['pastor', 'Pastor'],
  ['content_manager', 'Content manager'],
  ['hr_officer', 'HR officer'],
  ['dept_head', 'Department head'],
  ['coordinating_elder', 'Coordinating elder'],
  ['coordinating_pastor', 'Coordinating pastor'],
  ['member', 'Member portal'],
];

const roleBadgeVariant = (r) =>
  ({
    super_admin: 'purple',
    branch_admin: 'info',
    finance_officer: 'success',
    pastor: 'warning',
    member: 'default',
  }[r] || 'default');

export default function AccessPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = user?.role === 'super_admin';
  const canView = ['super_admin', 'branch_admin'].includes(user?.role);

  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'finance_officer',
    branch_id: '',
    password: '',
  });
  const [inviteSaving, setInviteSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const loadBranches = async () => {
    try {
      const res = await branchesAPI.getAll({ limit: 300 });
      setBranches(res.data?.data ?? []);
    } catch {
      setBranches([]);
    }
  };

  const loadStaff = async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const res = await usersAPI.getAll({
        page,
        limit: 15,
        search: search.trim() || undefined,
        role: roleFilter || undefined,
      });
      setStaff(res.data?.data ?? []);
      setPagination(res.data?.pagination ?? {});
    } catch (e) {
      setBanner({ type: 'error', text: e.response?.data?.message || 'Could not load staff accounts.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) loadBranches();
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    loadStaff();
  }, [page, roleFilter, search, canView]);

  const openInvite = () => {
    setBanner(null);
    setInviteForm({
      email: '',
      full_name: '',
      role: 'finance_officer',
      branch_id: '',
      password: '',
    });
    setInviteOpen(true);
  };

  const submitInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.full_name.trim()) {
      setBanner({ type: 'error', text: 'Email and full name are required.' });
      return;
    }
    const needsBranch = ['branch_admin', 'finance_officer', 'pastor', 'dept_head', 'member'].includes(inviteForm.role);
    if (needsBranch && !inviteForm.branch_id) {
      setBanner({ type: 'error', text: 'Pick a congregation for this role.' });
      return;
    }
    setInviteSaving(true);
    try {
      const payload = {
        email: inviteForm.email.trim(),
        full_name: inviteForm.full_name.trim(),
        role: inviteForm.role,
        branch_id: inviteForm.branch_id || undefined,
        password: inviteForm.password || undefined,
      };
      const res = await usersAPI.create(payload);
      setInviteOpen(false);
      await loadStaff();
      if (res.data?.temporaryPassword) {
        setBanner({
          type: 'success',
          text: 'Account created. Copy the temporary password below — it will not be shown again.',
          detail: res.data.temporaryPassword,
        });
      } else {
        setBanner({ type: 'success', text: 'Account created.' });
      }
    } catch (e) {
      setBanner({ type: 'error', text: e.response?.data?.message || 'Invite failed.' });
    } finally {
      setInviteSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditRow(row);
    setEditForm({
      full_name: row.full_name || '',
      role: row.role || '',
      branch_id: row.branch_id || '',
      is_active: row.is_active,
      password: '',
    });
    setEditOpen(true);
  };

  const submitEdit = async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      await usersAPI.update(editRow.id, {
        full_name: editForm.full_name.trim(),
        role: editForm.role,
        branch_id: editForm.branch_id || null,
        is_active: editForm.is_active,
        password: editForm.password || undefined,
      });
      setEditOpen(false);
      await loadStaff();
    } catch (e) {
      setBanner({ type: 'error', text: e.response?.data?.message || 'Update failed.' });
    } finally {
      setEditSaving(false);
    }
  };

  const deactivate = async (row) => {
    if (!window.confirm(`Deactivate ${row.full_name}? They will not be able to sign in.`)) return;
    try {
      await usersAPI.deactivate(row.id);
      await loadStaff();
    } catch (e) {
      setBanner({ type: 'error', text: e.response?.data?.message || 'Could not deactivate.' });
    }
  };

  if (!canView) {
    return (
      <div>
        <PageHeader title="Roles & access" subtitle="Restricted area" />
        <Card>
          <div className="p-10 text-center text-gray-500 text-sm">
            You need branch administrator or super administrator rights to view staff accounts.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Roles & access"
        subtitle={
          canManage
            ? 'Invite staff, assign roles, and deactivate accounts.'
            : 'Staff assigned to your congregation (read-only).'
        }
        action={canManage ? <Button onClick={openInvite}>+ Invite staff</Button> : undefined}
      />

      {banner && (
        <NoticeBanner type={banner.type} detail={banner.detail}>
          {banner.text}
        </NoticeBanner>
      )}

      <Card>
        <div className="p-5 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:border-purple-400"
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
          >
            <option value="">All roles</option>
            {ROLES.map(([value]) => (
              <option key={value} value={value}>
                {value.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-gray-400">{pagination.total ?? 0} accounts</span>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <Table headers={['Staff', 'Role', 'Congregation', 'Status', 'Last login', 'Actions']}>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  No matching accounts.
                </td>
              </tr>
            ) : (
              staff.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{u.full_name}</div>
                    <div className="text-xs text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={roleBadgeVariant(u.role)}>{u.role.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{u.branch_name || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.is_active ? 'success' : 'default'}>{u.is_active ? 'active' : 'inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.last_login ? new Date(u.last_login).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                          Edit
                        </Button>
                        {u.id !== user?.id && u.is_active && (
                          <Button variant="danger" size="sm" onClick={() => deactivate(u)}>
                            Deactivate
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
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
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
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

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite staff"
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitInvite} disabled={inviteSaving}>
              {inviteSaving ? 'Creating…' : 'Create account'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Full name"
            value={inviteForm.full_name}
            onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))}
          />
          <Select label="Role" value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}>
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Congregation"
            value={inviteForm.branch_id}
            onChange={(e) => setInviteForm((f) => ({ ...f, branch_id: e.target.value }))}
          >
            <option value="">None / HQ-wide</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Input
            label="Initial password (optional)"
            type="password"
            autoComplete="new-password"
            value={inviteForm.password}
            onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Leave blank to auto-generate"
          />
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit account"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Full name"
            value={editForm.full_name || ''}
            onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
          />
          <Select label="Role" value={editForm.role || ''} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Congregation"
            value={editForm.branch_id || ''}
            onChange={(e) => setEditForm((f) => ({ ...f, branch_id: e.target.value }))}
          >
            <option value="">None</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!!editForm.is_active}
              onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            Account active (can sign in)
          </label>
          <Input
            label="New password (optional)"
            type="password"
            autoComplete="new-password"
            value={editForm.password || ''}
            onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Leave blank to keep current password"
          />
        </div>
      </Modal>
    </div>
  );
}
