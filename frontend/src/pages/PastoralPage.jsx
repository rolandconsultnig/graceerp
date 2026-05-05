import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { pastoralAPI, branchesAPI, membersAPI } from '../services/api';
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

const textAreaCls =
  'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 min-h-[88px]';

const canPastoral = (role) => ['super_admin', 'branch_admin', 'pastor'].includes(role || '');
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRAYER_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const FLAG_TYPES = ['financial', 'medical', 'emotional', 'bereavement', 'other'];
const WELFARE_STATUSES = ['open', 'in_progress', 'resolved'];

export default function PastoralPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = canPastoral(user?.role);

  const [tab, setTab] = useState('prayers');

  const [branches, setBranches] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  const [prayModal, setPrayerModal] = useState(false);
  const [prayForm, setPrayForm] = useState({});
  const [editPrayer, setEditPrayer] = useState(null);

  const [visitModal, setVisitModal] = useState(false);
  const [visitForm, setVisitForm] = useState({});

  const [welfareModal, setWelfareModal] = useState(false);
  const [welfareForm, setWelfareForm] = useState({});
  const [editWelfare, setEditWelfare] = useState(null);
  const [notice, setNotice] = useState(null);
  const notify = (type, text) => setNotice({ type, text });

  useEffect(() => {
    branchesAPI
      .getAll({ limit: 300 })
      .then((r) => setBranches(r.data?.data ?? []))
      .catch(() => setBranches([]));
    membersAPI
      .getAll({ limit: 300 })
      .then((r) => setMembers(r.data?.data ?? []))
      .catch(() => setMembers([]));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      let res;
      if (tab === 'prayers') res = await pastoralAPI.listPrayers({ page, limit: 15 });
      else if (tab === 'visits') res = await pastoralAPI.listVisits({ page, limit: 15 });
      else res = await pastoralAPI.listWelfare({ page, limit: 15 });
      setRows(res.data?.data ?? []);
      setPagination(res.data?.pagination ?? {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [tab]);

  useEffect(() => {
    load();
  }, [tab, page]);

  const openPrayerModal = () => {
    setPrayForm({
      branch_id: user?.branch_id || '',
      member_id: '',
      title: '',
      description: '',
      priority: 'medium',
      status: 'open',
      is_confidential: false,
    });
    setPrayerModal(true);
  };

  const savePrayer = async () => {
    if (!prayForm.title?.trim()) {
      notify('error', 'Title required.');
      return;
    }
    if (!prayForm.branch_id) {
      notify('error', 'Branch required.');
      return;
    }
    setSaving(true);
    try {
      await pastoralAPI.createPrayer({
        branch_id: prayForm.branch_id,
        member_id: prayForm.member_id || undefined,
        title: prayForm.title.trim(),
        description: prayForm.description || undefined,
        priority: prayForm.priority,
        status: prayForm.status,
        is_confidential: !!prayForm.is_confidential,
      });
      setPrayerModal(false);
      notify('success', 'Prayer request added.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const savePrayerEdit = async () => {
    if (!editPrayer) return;
    setSaving(true);
    try {
      await pastoralAPI.updatePrayer(editPrayer.id, {
        status: editPrayer.status,
        priority: editPrayer.priority,
        resolution_note: editPrayer.resolution_note || undefined,
      });
      setEditPrayer(null);
      notify('success', 'Prayer request updated.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const deletePrayer = async (p) => {
    if (!confirm('Delete this prayer request?')) return;
    try {
      await pastoralAPI.deletePrayer(p.id);
      notify('success', 'Prayer request removed.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Failed.');
    }
  };

  const openVisitModal = () => {
    setVisitForm({
      branch_id: user?.branch_id || '',
      member_id: '',
      visit_date: new Date().toISOString().slice(0, 10),
      purpose: '',
      notes: '',
    });
    setVisitModal(true);
  };

  const saveVisit = async () => {
    if (!visitForm.member_id || !visitForm.visit_date) {
      notify('error', 'Member and visit date required.');
      return;
    }
    if (!visitForm.branch_id) {
      notify('error', 'Branch required.');
      return;
    }
    setSaving(true);
    try {
      await pastoralAPI.createVisit({
        branch_id: visitForm.branch_id,
        member_id: visitForm.member_id,
        visit_date: visitForm.visit_date,
        purpose: visitForm.purpose || undefined,
        notes: visitForm.notes || undefined,
      });
      setVisitModal(false);
      notify('success', 'Visit recorded.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const deleteVisit = async (v) => {
    if (!confirm('Delete this visit record?')) return;
    try {
      await pastoralAPI.deleteVisit(v.id);
      notify('success', 'Visit deleted.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Failed.');
    }
  };

  const openWelfareModal = () => {
    setWelfareForm({
      branch_id: user?.branch_id || '',
      member_id: '',
      flag_type: 'other',
      description: '',
      status: 'open',
    });
    setWelfareModal(true);
  };

  const saveWelfare = async () => {
    if (!welfareForm.member_id) {
      notify('error', 'Member required.');
      return;
    }
    if (!welfareForm.branch_id) {
      notify('error', 'Branch required.');
      return;
    }
    setSaving(true);
    try {
      await pastoralAPI.createWelfare({
        branch_id: welfareForm.branch_id,
        member_id: welfareForm.member_id,
        flag_type: welfareForm.flag_type,
        description: welfareForm.description || undefined,
        status: welfareForm.status,
      });
      setWelfareModal(false);
      notify('success', 'Welfare flag added.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveWelfareEdit = async () => {
    if (!editWelfare) return;
    setSaving(true);
    try {
      await pastoralAPI.updateWelfare(editWelfare.id, {
        status: editWelfare.status,
        description: editWelfare.description || undefined,
        flag_type: editWelfare.flag_type,
      });
      setEditWelfare(null);
      notify('success', 'Welfare record updated.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const deleteWelfare = async (w) => {
    if (!confirm('Remove welfare flag?')) return;
    try {
      await pastoralAPI.deleteWelfare(w.id);
      notify('success', 'Welfare flag removed.');
      load();
    } catch (e) {
      notify('error', e.response?.data?.message || 'Failed.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Pastoral care"
        subtitle="Prayer requests, visits, and welfare flags"
        action={
          canManage ? (
            <Button
              onClick={() => {
                if (tab === 'prayers') openPrayerModal();
                else if (tab === 'visits') openVisitModal();
                else openWelfareModal();
              }}
            >
              + New record
            </Button>
          ) : null
        }
      />

      {notice && <NoticeBanner type={notice.type}>{notice.text}</NoticeBanner>}

      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'prayers'} onClick={() => setTab('prayers')}>
          Prayers
        </TabButton>
        <TabButton active={tab === 'visits'} onClick={() => setTab('visits')}>
          Visits
        </TabButton>
        <TabButton active={tab === 'welfare'} onClick={() => setTab('welfare')}>
          Welfare
        </TabButton>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : tab === 'prayers' ? (
          <Table headers={['Title', 'Branch', 'Priority', 'Status', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">
                  No prayer requests
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-gray-600">{p.branch_name}</td>
                  <td className="px-4 py-3 text-xs">{p.priority}</td>
                  <td className="px-4 py-3">
                    <Badge variant="purple">{p.status}</Badge>
                  </td>
                  <td className="px-4 py-3 flex gap-2 flex-wrap">
                    {canManage ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditPrayer({ ...p })}>
                          Update
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => deletePrayer(p)}>
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
        ) : tab === 'visits' ? (
          <Table headers={['Date', 'Branch', 'Member', 'Purpose', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">
                  No visits
                </td>
              </tr>
            ) : (
              rows.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs">{v.visit_date}</td>
                  <td className="px-4 py-3">{v.branch_name}</td>
                  <td className="px-4 py-3">
                    {v.mf} {v.ml}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[200px]">{v.purpose || '—'}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <Button variant="danger" size="sm" onClick={() => deleteVisit(v)}>
                        Delete
                      </Button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </Table>
        ) : (
          <Table headers={['Member', 'Branch', 'Type', 'Status', 'Actions']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">
                  No welfare flags
                </td>
              </tr>
            ) : (
              rows.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {w.mf} {w.ml}
                  </td>
                  <td className="px-4 py-3">{w.branch_name}</td>
                  <td className="px-4 py-3 text-xs">{w.flag_type}</td>
                  <td className="px-4 py-3">
                    <Badge variant="warning">{w.status}</Badge>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {canManage ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setEditWelfare({ ...w })}>
                          Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => deleteWelfare(w)}>
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
        open={prayModal}
        onClose={() => !saving && setPrayerModal(false)}
        title="Prayer request"
        footer={
          <>
            <Button variant="outline" onClick={() => setPrayerModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={savePrayer} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch" value={prayForm.branch_id || ''} onChange={(e) => setPrayForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select label="Member (optional)" value={prayForm.member_id || ''} onChange={(e) => setPrayForm((f) => ({ ...f, member_id: e.target.value }))}>
            <option value="">None</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </Select>
          <Input label="Title" value={prayForm.title || ''} onChange={(e) => setPrayForm((f) => ({ ...f, title: e.target.value }))} />
          <textarea
            className={textAreaCls}
            placeholder="Description"
            value={prayForm.description || ''}
            onChange={(e) => setPrayForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Priority" value={prayForm.priority || 'medium'} onChange={(e) => setPrayForm((f) => ({ ...f, priority: e.target.value }))}>
              {PRIORITIES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
            <Select label="Status" value={prayForm.status || 'open'} onChange={(e) => setPrayForm((f) => ({ ...f, status: e.target.value }))}>
              {PRAYER_STATUSES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={!!prayForm.is_confidential} onChange={(e) => setPrayForm((f) => ({ ...f, is_confidential: e.target.checked }))} />
            Confidential
          </label>
        </div>
      </Modal>

      <Modal
        open={!!editPrayer}
        onClose={() => !saving && setEditPrayer(null)}
        title="Update prayer"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditPrayer(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={savePrayerEdit} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        {editPrayer && (
          <div className="space-y-4">
            <Select label="Priority" value={editPrayer.priority} onChange={(e) => setEditPrayer((p) => ({ ...p, priority: e.target.value }))}>
              {PRIORITIES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
            <Select label="Status" value={editPrayer.status} onChange={(e) => setEditPrayer((p) => ({ ...p, status: e.target.value }))}>
              {PRAYER_STATUSES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
            <textarea
              className={textAreaCls}
              placeholder="Resolution note"
              value={editPrayer.resolution_note || ''}
              onChange={(e) => setEditPrayer((p) => ({ ...p, resolution_note: e.target.value }))}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={visitModal}
        onClose={() => !saving && setVisitModal(false)}
        title="Pastoral visit"
        footer={
          <>
            <Button variant="outline" onClick={() => setVisitModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveVisit} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch" value={visitForm.branch_id || ''} onChange={(e) => setVisitForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select label="Member" value={visitForm.member_id || ''} onChange={(e) => setVisitForm((f) => ({ ...f, member_id: e.target.value }))}>
            <option value="">Select member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </Select>
          <Input type="date" label="Visit date" value={visitForm.visit_date || ''} onChange={(e) => setVisitForm((f) => ({ ...f, visit_date: e.target.value }))} />
          <Input label="Purpose" value={visitForm.purpose || ''} onChange={(e) => setVisitForm((f) => ({ ...f, purpose: e.target.value }))} />
          <textarea
            className={textAreaCls}
            placeholder="Notes"
            value={visitForm.notes || ''}
            onChange={(e) => setVisitForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </Modal>

      <Modal
        open={welfareModal}
        onClose={() => !saving && setWelfareModal(false)}
        title="Welfare flag"
        footer={
          <>
            <Button variant="outline" onClick={() => setWelfareModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveWelfare} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Branch" value={welfareForm.branch_id || ''} onChange={(e) => setWelfareForm((f) => ({ ...f, branch_id: e.target.value }))}>
            <option value="">Select…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select label="Member" value={welfareForm.member_id || ''} onChange={(e) => setWelfareForm((f) => ({ ...f, member_id: e.target.value }))}>
            <option value="">Select member…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </Select>
          <Select label="Flag type" value={welfareForm.flag_type || 'other'} onChange={(e) => setWelfareForm((f) => ({ ...f, flag_type: e.target.value }))}>
            {FLAG_TYPES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
          <textarea
            className={textAreaCls}
            placeholder="Description"
            value={welfareForm.description || ''}
            onChange={(e) => setWelfareForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Select label="Status" value={welfareForm.status || 'open'} onChange={(e) => setWelfareForm((f) => ({ ...f, status: e.target.value }))}>
            {WELFARE_STATUSES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
        </div>
      </Modal>

      <Modal
        open={!!editWelfare}
        onClose={() => !saving && setEditWelfare(null)}
        title="Edit welfare flag"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditWelfare(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveWelfareEdit} disabled={saving}>
              Save
            </Button>
          </>
        }
      >
        {editWelfare && (
          <div className="space-y-4">
            <Select label="Type" value={editWelfare.flag_type} onChange={(e) => setEditWelfare((w) => ({ ...w, flag_type: e.target.value }))}>
              {FLAG_TYPES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
            <Select label="Status" value={editWelfare.status} onChange={(e) => setEditWelfare((w) => ({ ...w, status: e.target.value }))}>
              {WELFARE_STATUSES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
            <textarea
              className={textAreaCls}
              value={editWelfare.description || ''}
              onChange={(e) => setEditWelfare((w) => ({ ...w, description: e.target.value }))}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
