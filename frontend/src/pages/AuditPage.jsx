import { useEffect, useState } from 'react';
import useAuthStore from '../context/authStore';
import { auditAPI } from '../services/api';
import { PageHeader, Card, Button, Modal, Input, Spinner, Table } from '../components/UI';

const canReadAudit = (role) => ['super_admin', 'branch_admin', 'finance_officer'].includes(role || '');

const EMPTY_FILTERS = {
  action: '',
  resource_type: '',
  user_id: '',
  from_date: '',
  to_date: '',
};

export default function AuditPage() {
  const user = useAuthStore((s) => s.user);
  const allowed = canReadAudit(user?.role);

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await auditAPI.getLogs({
          page,
          limit: 25,
          action: appliedFilters.action.trim() || undefined,
          resource_type: appliedFilters.resource_type.trim() || undefined,
          user_id: appliedFilters.user_id.trim() || undefined,
          from_date: appliedFilters.from_date || undefined,
          to_date: appliedFilters.to_date || undefined,
        });
        if (!cancelled) {
          setRows(res.data?.data ?? []);
          setPagination(res.data?.pagination ?? {});
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, allowed, appliedFilters]);

  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const openDetail = async (row) => {
    try {
      const res = await auditAPI.getOne(row.id);
      setDetail(res.data?.data ?? row);
    } catch {
      setDetail(row);
    }
  };

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Audit log" subtitle="Restricted to administrators and finance roles" />
        <Card>
          <div className="p-10 text-center text-gray-500 text-sm">You do not have permission to view audit logs.</div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Read-only activity trail with filters" />

      <Card>
        <div className="p-5 border-b grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <Input label="Action" value={filters.action} onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))} placeholder="e.g. create" />
          <Input
            label="Resource type"
            value={filters.resource_type}
            onChange={(e) => setFilters((f) => ({ ...f, resource_type: e.target.value }))}
            placeholder="partial match"
          />
          <Input label="User ID" value={filters.user_id} onChange={(e) => setFilters((f) => ({ ...f, user_id: e.target.value }))} placeholder="UUID" />
          <Input type="date" label="From" value={filters.from_date} onChange={(e) => setFilters((f) => ({ ...f, from_date: e.target.value }))} />
          <Input type="date" label="To" value={filters.to_date} onChange={(e) => setFilters((f) => ({ ...f, to_date: e.target.value }))} />
          <Button onClick={applyFilters}>Apply filters</Button>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <Table headers={['When', 'User', 'Action', 'Resource', 'Detail']}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">
                  No audit entries
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-xs">{a.user_name || a.user_email || a.user_id || '—'}</td>
                  <td className="px-4 py-3 text-xs font-medium">{a.action}</td>
                  <td className="px-4 py-3 text-xs">{a.resource_type || '—'}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" onClick={() => openDetail(a)}>
                      View
                    </Button>
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
            <span className="text-xs text-gray-400 pt-2">
              Page {pagination.page} of {pagination.pages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.pages}>
              Next →
            </Button>
          </div>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Audit entry">
        {detail && (
          <pre className="text-xs bg-gray-50 p-4 rounded-lg overflow-x-auto max-h-[60vh]">
            {JSON.stringify(detail, null, 2)}
          </pre>
        )}
      </Modal>
    </div>
  );
}
