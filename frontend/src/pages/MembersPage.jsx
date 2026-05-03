import { useEffect, useRef, useState } from 'react';
import { membersAPI } from '../services/api';
import useAuthStore from '../context/authStore';
import { PageHeader, Card, StatsGrid, StatCard, Badge, Button, Modal, Input, Select, Avatar, Spinner, Table } from '../components/UI';

const TIERS = ['general_member','cell_leader','deacon','deaconess','minister','pastor','exec_pastor','bishop'];
const DEPTS = ['Choir','Ushering','Media','Finance','Children','Prayer','IT','Protocol','Welfare','Admin'];

const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/i, '') || '';

function memberPhotoSrc(photoUrl) {
  if (!photoUrl) return null;
  if (photoUrl.startsWith('http')) return photoUrl;
  return `${apiOrigin}${photoUrl}`;
}

export default function MembersPage() {
  const user = useAuthStore((s) => s.user);
  const canEditMembers = ['super_admin', 'branch_admin', 'pastor'].includes(user?.role || '');

  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [form, setForm] = useState({});
  const [editMember, setEditMember] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [editPhotoUploading, setEditPhotoUploading] = useState(false);
  const addPhotoInputRef = useRef(null);
  const editPhotoInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        membersAPI.getAll({ page, limit: 15, search, tier: tierFilter, status: statusFilter }),
        membersAPI.stats(),
      ]);
      setMembers(mRes.data.data);
      setPagination(mRes.data.pagination);
      setStats(sRes.data.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, search, tierFilter, statusFilter]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await membersAPI.create(form);
      const id = res.data?.data?.id;
      if (newPhotoFile && id) {
        const fd = new FormData();
        fd.append('photo', newPhotoFile);
        await membersAPI.uploadPhoto(id, fd);
      }
      setShowModal(false);
      setForm({});
      setNewPhotoFile(null);
      if (addPhotoInputRef.current) addPhotoInputRef.current.value = '';
      load();
    } catch (e) { alert(e.response?.data?.message || 'Failed to create member'); }
    finally { setSaving(false); }
  };

  const openEdit = async (row) => {
    if (!canEditMembers) return;
    try {
      const res = await membersAPI.getOne(row.id);
      const d = res.data?.data;
      setEditMember(d);
      setEditForm({
        first_name: d.first_name || '',
        last_name: d.last_name || '',
        email: d.email || '',
        phone: d.phone || '',
        gender: d.gender || '',
        tier: d.tier || '',
        department: d.department || '',
        status: d.status || 'active',
      });
      setShowEdit(true);
    } catch (e) {
      alert(e.response?.data?.message || 'Could not load member');
    }
  };

  const handleEditSave = async () => {
    if (!editMember?.id) return;
    setEditSaving(true);
    try {
      await membersAPI.update(editMember.id, {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        gender: editForm.gender || null,
        tier: editForm.tier || undefined,
        department: editForm.department || null,
        status: editForm.status,
      });
      setShowEdit(false);
      setEditMember(null);
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const handleEditPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editMember?.id) return;
    setEditPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await membersAPI.uploadPhoto(editMember.id, fd);
      setEditMember(res.data?.data);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Photo upload failed');
    } finally {
      setEditPhotoUploading(false);
    }
  };

  const tierColor = (t) => ({
    general_member: 'default', cell_leader: 'purple',
    deacon: 'info', deaconess: 'info', minister: 'warning',
    pastor: 'success', exec_pastor: 'success', bishop: 'danger'
  }[t] || 'default');

  return (
    <div>
      <PageHeader
        title="Members Database"
        subtitle="All registered members across branches"
        action={canEditMembers ? <Button onClick={() => setShowModal(true)}>+ Add Member</Button> : null}
      />

      <StatsGrid>
        <StatCard icon="👥" value={stats.total || 0}      label="Total Members"    accent="purple" />
        <StatCard icon="✅" value={stats.active || 0}     label="Active Members"   accent="green"  change="this month" changeType="up" />
        <StatCard icon="🆕" value={stats.new_this_month || 0} label="New This Month" accent="blue" />
        <StatCard icon="😴" value={stats.inactive || 0}   label="Inactive Members" accent="amber"  />
      </StatsGrid>

      <Card>
        <div className="p-5 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="🔍 Search members..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:border-purple-400"
          />
          <select
            value={tierFilter}
            onChange={e => { setTierFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
          >
            <option value="">All Tiers</option>
            {TIERS.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="ml-auto text-xs text-gray-400">
            {pagination.total || 0} total members
          </span>
        </div>

        {loading ? <Spinner /> : (
          <Table headers={['Member','Branch','Department','Tier','Status','Joined','Actions']}>
            {members.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No members found</td></tr>
            ) : members.map(m => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {memberPhotoSrc(m.photo_url) ? (
                      <img
                        src={memberPhotoSrc(m.photo_url)}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover border border-gray-100 flex-shrink-0 bg-gray-50"
                      />
                    ) : (
                      <Avatar name={`${m.first_name} ${m.last_name}`} />
                    )}
                    <div>
                      <div className="font-medium text-gray-800">{m.first_name} {m.last_name}</div>
                      <div className="text-xs text-gray-400">{m.member_code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{m.branch_name}</td>
                <td className="px-4 py-3 text-gray-600">{m.department || '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={tierColor(m.tier)}>{m.tier?.replace(/_/g,' ')}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={m.status === 'active' ? 'success' : 'default'}>{m.status}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {m.membership_date ? new Date(m.membership_date).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  {canEditMembers ? (
                    <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                      Edit
                    </Button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              Page {pagination.page} of {pagination.pages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}>
                ← Prev
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p+1)} disabled={page >= pagination.pages}>
                Next →
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Member Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Member"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving...' : 'Save Member'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="First Name" value={form.first_name || ''} onChange={e => setForm(f => ({...f, first_name: e.target.value}))} placeholder="First name" />
          <Input label="Last Name" value={form.last_name || ''} onChange={e => setForm(f => ({...f, last_name: e.target.value}))} placeholder="Last name" />
        </div>
        <div className="mt-4 space-y-4">
          <Input label="Email" type="email" value={form.email || ''} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="email@example.com" />
          <Input label="Phone" value={form.phone || ''} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+234 800 000 0000" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Gender" value={form.gender || ''} onChange={e => setForm(f => ({...f, gender: e.target.value}))}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
            <Select label="Tier" value={form.tier || ''} onChange={e => setForm(f => ({...f, tier: e.target.value}))}>
              <option value="">Select tier</option>
              {TIERS.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
            </Select>
          </div>
          <Select label="Department" value={form.department || ''} onChange={e => setForm(f => ({...f, department: e.target.value}))}>
            <option value="">Select department</option>
            {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>
          <div className="pt-2 border-t border-gray-100 mt-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Profile photo (optional)</p>
            <input
              ref={addPhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-purple-800 hover:file:bg-purple-100"
              onChange={(e) => setNewPhotoFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-gray-400 mt-1">JPEG, PNG, GIF or WebP · max 8 MB · saved after member is created</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={showEdit}
        onClose={() => {
          setShowEdit(false);
          setEditMember(null);
          setEditForm({});
        }}
        title={editMember ? `${editMember.first_name} ${editMember.last_name}` : 'Member'}
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowEdit(false); setEditMember(null); }}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      >
        {editMember && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="relative flex-shrink-0">
                {memberPhotoSrc(editMember.photo_url) ? (
                  <img
                    src={memberPhotoSrc(editMember.photo_url)}
                    alt=""
                    className="h-24 w-24 rounded-2xl object-cover border border-gray-200"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-800 flex items-center justify-center text-white text-xl font-bold">
                    {(editMember.first_name?.[0] || '') + (editMember.last_name?.[0] || '')}
                  </div>
                )}
                {editPhotoUploading && (
                  <div className="absolute inset-0 rounded-2xl bg-white/70 flex items-center justify-center">
                    <div className="w-7 h-7 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={editPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleEditPhotoChange}
                />
                <Button type="button" variant="outline" size="sm" disabled={editPhotoUploading} onClick={() => editPhotoInputRef.current?.click()}>
                  {editPhotoUploading ? 'Uploading…' : 'Change photo'}
                </Button>
                <p className="text-xs text-gray-400">Upload replaces the current picture immediately.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="First name" value={editForm.first_name || ''} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} />
              <Input label="Last name" value={editForm.last_name || ''} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
            <Input label="Email" type="email" value={editForm.email || ''} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            <Input label="Phone" value={editForm.phone || ''} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Gender" value={editForm.gender || ''} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
              <Select label="Tier" value={editForm.tier || ''} onChange={(e) => setEditForm((f) => ({ ...f, tier: e.target.value }))}>
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </Select>
            </div>
            <Select label="Department" value={editForm.department || ''} onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))}>
              <option value="">—</option>
              {DEPTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
            <Select label="Status" value={editForm.status || 'active'} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        )}
      </Modal>
    </div>
  );
}
