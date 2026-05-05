import { useCallback, useEffect, useState } from 'react';
import { financeAPI, branchesAPI, membersAPI } from '../services/api';
import useAuthStore from '../context/authStore';
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Modal,
  Input,
  Select,
  Spinner,
  Table,
  Badge,
  StatsGrid,
  StatCard,
  NoticeBanner,
} from '../components/UI';

const GIVING_TYPES = [
  { value: 'tithe', label: 'Tithe' },
  { value: 'offering', label: 'Offering' },
  { value: 'special_seed', label: 'Special seed' },
  { value: 'project_fund', label: 'Project fund' },
  { value: 'welfare', label: 'Welfare' },
  { value: 'missions', label: 'Missions' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'online_paystack', label: 'Paystack' },
  { value: 'online_flutterwave', label: 'Flutterwave' },
  { value: 'cheque', label: 'Cheque' },
];

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatMoney(n, currency = 'NGN') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return Number(n).toLocaleString('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-purple-600 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

export default function FinancePage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('giving');

  /* —— Giving tab —— */
  const [givingRows, setGivingRows] = useState([]);
  const [givingPagination, setGivingPagination] = useState({});
  const [givingLoading, setGivingLoading] = useState(true);
  const [givingPage, setGivingPage] = useState(1);
  const [filterType, setFilterType] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  /* —— Summary tab —— */
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryByType, setSummaryByType] = useState([]);
  const [summaryMonthly, setSummaryMonthly] = useState([]);

  /* —— Ledger tab —— */
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerPagination, setLedgerPagination] = useState({});
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerDateFrom, setLedgerDateFrom] = useState('');
  const [ledgerDateTo, setLedgerDateTo] = useState('');

  /* —— Record modal —— */
  const [showRecord, setShowRecord] = useState(false);
  const [recordSaving, setRecordSaving] = useState(false);
  const [branches, setBranches] = useState([]);
  const [members, setMembers] = useState([]);
  const [recordForm, setRecordForm] = useState({
    branch_id: '',
    member_id: '',
    giving_type: 'tithe',
    amount: '',
    currency: 'NGN',
    payment_method: 'cash',
    transaction_ref: '',
    giving_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const [banner, setBanner] = useState(null);

  const loadBranches = useCallback(async () => {
    try {
      const res = await branchesAPI.getAll({ limit: 200 });
      setBranches(res.data.data || []);
    } catch (e) {
      console.error(e);
      setBranches([]);
    }
  }, []);

  const loadMembersPicklist = useCallback(async () => {
    try {
      const res = await membersAPI.getAll({ page: 1, limit: 200, status: 'active' });
      setMembers(res.data.data || []);
    } catch (e) {
      console.error(e);
      setMembers([]);
    }
  }, []);

  const loadGiving = useCallback(async () => {
    setGivingLoading(true);
    setBanner(null);
    try {
      const params = {
        page: givingPage,
        limit: 15,
        ...(filterType && { giving_type: filterType }),
        ...(filterMethod && { payment_method: filterMethod }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      };
      const res = await financeAPI.getAllGiving(params);
      setGivingRows(res.data.data || []);
      setGivingPagination(res.data.pagination || {});
    } catch (e) {
      setBanner({
        type: 'error',
        text: e.response?.data?.message || e.message || 'Failed to load giving records.',
      });
      setGivingRows([]);
      setGivingPagination({});
    } finally {
      setGivingLoading(false);
    }
  }, [givingPage, filterType, filterMethod, dateFrom, dateTo]);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setBanner(null);
    try {
      const res = await financeAPI.summary({ year: summaryYear });
      setSummaryByType(res.data.data?.byType || []);
      setSummaryMonthly(res.data.data?.monthly || []);
    } catch (e) {
      setBanner({
        type: 'error',
        text: e.response?.data?.message || e.message || 'Failed to load summary.',
      });
      setSummaryByType([]);
      setSummaryMonthly([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [summaryYear]);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    setBanner(null);
    try {
      const params = {
        page: ledgerPage,
        limit: 20,
        ...(ledgerDateFrom && { date_from: ledgerDateFrom }),
        ...(ledgerDateTo && { date_to: ledgerDateTo }),
      };
      const res = await financeAPI.getLedger(params);
      setLedgerRows(res.data.data || []);
      setLedgerPagination(res.data.pagination || {});
    } catch (e) {
      setBanner({
        type: 'error',
        text: e.response?.data?.message || e.message || 'Failed to load ledger.',
      });
      setLedgerRows([]);
      setLedgerPagination({});
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerPage, ledgerDateFrom, ledgerDateTo]);

  useEffect(() => {
    loadGiving();
  }, [loadGiving]);

  useEffect(() => {
    if (tab === 'summary') loadSummary();
  }, [tab, loadSummary]);

  useEffect(() => {
    if (tab === 'ledger') loadLedger();
  }, [tab, loadLedger]);

  useEffect(() => {
    if (showRecord) {
      loadBranches();
      loadMembersPicklist();
      setRecordForm((f) => ({
        ...f,
        branch_id: f.branch_id || user?.branch_id || '',
      }));
    }
  }, [showRecord, loadBranches, loadMembersPicklist, user?.branch_id]);

  const summaryTotals = summaryByType.reduce((acc, row) => acc + Number(row.total || 0), 0);

  const handleRecordGiving = async () => {
    const amountNum = parseFloat(recordForm.amount, 10);
    if (!recordForm.giving_type || Number.isNaN(amountNum) || amountNum <= 0) {
      setBanner({ type: 'error', text: 'Choose a giving type and enter a valid amount greater than zero.' });
      return;
    }
    if (!recordForm.branch_id) {
      setBanner({ type: 'error', text: 'Select the branch receiving this offering.' });
      return;
    }

    setRecordSaving(true);
    setBanner(null);
    try {
      await financeAPI.recordGiving({
        branch_id: recordForm.branch_id,
        member_id: recordForm.member_id || undefined,
        giving_type: recordForm.giving_type,
        amount: amountNum,
        currency: recordForm.currency || 'NGN',
        payment_method: recordForm.payment_method || 'cash',
        transaction_ref: recordForm.transaction_ref || undefined,
        giving_date: recordForm.giving_date || undefined,
        notes: recordForm.notes || undefined,
      });
      setShowRecord(false);
      setRecordForm((f) => ({
        ...f,
        member_id: '',
        amount: '',
        transaction_ref: '',
        notes: '',
        giving_date: new Date().toISOString().slice(0, 10),
      }));
      setBanner({ type: 'success', text: 'Giving recorded successfully.' });
      loadGiving();
      if (tab === 'summary') loadSummary();
      if (tab === 'ledger') loadLedger();
    } catch (e) {
      setBanner({
        type: 'error',
        text: e.response?.data?.message || e.message || 'Could not record giving.',
      });
    } finally {
      setRecordSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Finance & Giving"
        subtitle="Giving records, church-wide summary, and ledger postings"
        action={
          <Button onClick={() => setShowRecord(true)}>+ Record giving</Button>
        }
      />

      {banner && <NoticeBanner type={banner.type}>{banner.text}</NoticeBanner>}

      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton active={tab === 'giving'} onClick={() => setTab('giving')}>
          Giving records
        </TabButton>
        <TabButton active={tab === 'summary'} onClick={() => setTab('summary')}>
          Summary
        </TabButton>
        <TabButton active={tab === 'ledger'} onClick={() => setTab('ledger')}>
          Ledger
        </TabButton>
      </div>

      {/* —— Giving tab —— */}
      {tab === 'giving' && (
        <Card>
          <div className="p-5 border-b border-gray-100 flex flex-wrap gap-3 items-end">
            <Select
              label="Type"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setGivingPage(1);
              }}
            >
              <option value="">All types</option>
              {GIVING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Select
              label="Payment"
              value={filterMethod}
              onChange={(e) => {
                setFilterMethod(e.target.value);
                setGivingPage(1);
              }}
            >
              <option value="">All methods</option>
              {PAYMENT_METHODS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setGivingPage(1);
              }}
            />
            <Input
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setGivingPage(1);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterType('');
                setFilterMethod('');
                setDateFrom('');
                setDateTo('');
                setGivingPage(1);
              }}
            >
              Clear filters
            </Button>
            <span className="text-xs text-gray-400 ml-auto">
              {givingPagination.total ?? 0} records
            </span>
          </div>

          {givingLoading ? (
            <Spinner />
          ) : (
            <Table headers={['Date', 'Type', 'Amount', 'Method', 'Member', 'Branch', 'Receipt', 'Recorded by']}>
              {givingRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    No giving records match these filters.
                  </td>
                </tr>
              ) : (
                givingRows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">
                      {r.giving_date
                        ? new Date(r.giving_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="purple">{r.giving_type?.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {formatMoney(r.amount, r.currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.payment_method?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.member_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.branch_name || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.receipt_number}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{r.recorded_by_name || '—'}</td>
                  </tr>
                ))
              )}
            </Table>
          )}

          {givingPagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Page {givingPagination.page} of {givingPagination.pages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGivingPage((p) => Math.max(1, p - 1))}
                  disabled={givingPage <= 1}
                >
                  ← Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGivingPage((p) => p + 1)}
                  disabled={givingPage >= givingPagination.pages}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* —— Summary tab —— */}
      {tab === 'summary' && (
        <div className="space-y-6">
          <Card>
            <div className="p-5 border-b border-gray-100 flex flex-wrap items-end gap-4">
              <Input
                label="Year"
                type="number"
                min={2000}
                max={2100}
                value={summaryYear}
                onChange={(e) => setSummaryYear(parseInt(e.target.value, 10) || summaryYear)}
                className="w-32"
              />
              <Button variant="outline" size="sm" onClick={loadSummary}>
                Refresh
              </Button>
            </div>
            {summaryLoading ? (
              <Spinner />
            ) : (
              <>
                <StatsGrid>
                  <StatCard
                    icon="💰"
                    value={formatMoney(summaryTotals)}
                    label={`Total giving (${summaryYear})`}
                    accent="green"
                  />
                  <StatCard
                    icon="📑"
                    value={summaryByType.length}
                    label="Giving categories with activity"
                    accent="purple"
                  />
                </StatsGrid>
                <div className="grid md:grid-cols-2 gap-5 p-5">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">By type</h4>
                    <div className="space-y-2">
                      {summaryByType.length === 0 ? (
                        <p className="text-sm text-gray-400">No giving for this year.</p>
                      ) : (
                        summaryByType.map((row) => (
                          <div
                            key={row.giving_type}
                            className="flex justify-between text-sm py-2 border-b border-gray-50"
                          >
                            <span className="text-gray-600 capitalize">
                              {row.giving_type?.replace(/_/g, ' ')}
                            </span>
                            <span className="font-medium">{formatMoney(row.total)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Monthly totals</h4>
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-2">
                      {summaryMonthly.length === 0 ? (
                        <p className="text-sm text-gray-400">No monthly breakdown.</p>
                      ) : (
                        summaryMonthly.map((row) => (
                          <div
                            key={row.month}
                            className="flex justify-between text-sm py-1.5 px-2 rounded hover:bg-gray-50"
                          >
                            <span className="text-gray-600">
                              {MONTH_NAMES[Math.round(Number(row.month))] || `M${row.month}`}
                            </span>
                            <span className="font-medium">{formatMoney(row.total)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* —— Ledger tab —— */}
      {tab === 'ledger' && (
        <Card>
          <CardHeader
            title="Ledger entries"
            action={
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  type="date"
                  value={ledgerDateFrom}
                  onChange={(e) => {
                    setLedgerDateFrom(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-auto"
                />
                <span className="text-gray-400 text-sm">to</span>
                <Input
                  type="date"
                  value={ledgerDateTo}
                  onChange={(e) => {
                    setLedgerDateTo(e.target.value);
                    setLedgerPage(1);
                  }}
                  className="w-auto"
                />
                <Button variant="outline" size="sm" onClick={loadLedger}>
                  Apply
                </Button>
              </div>
            }
          />
          {ledgerLoading ? (
            <Spinner />
          ) : (
            <Table headers={['Date', 'Description', 'Debit', 'Credit', 'Amount', 'Reference', 'Posted by']}>
              {ledgerRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    No ledger entries in this range.
                  </td>
                </tr>
              ) : (
                ledgerRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {row.entry_date ? new Date(row.entry_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{row.description}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{row.debit_account}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{row.credit_account}</td>
                    <td className="px-4 py-3 font-medium">{formatMoney(row.amount, row.currency)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">{row.reference_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.created_by_name || '—'}</td>
                  </tr>
                ))
              )}
            </Table>
          )}
          {ledgerPagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Page {ledgerPagination.page} of {ledgerPagination.pages} · {ledgerPagination.total} rows
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  disabled={ledgerPage <= 1}
                >
                  ← Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLedgerPage((p) => p + 1)}
                  disabled={ledgerPage >= ledgerPagination.pages}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal
        open={showRecord}
        onClose={() => !recordSaving && setShowRecord(false)}
        title="Record giving"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowRecord(false)} disabled={recordSaving}>
              Cancel
            </Button>
            <Button onClick={handleRecordGiving} disabled={recordSaving}>
              {recordSaving ? 'Saving…' : 'Save record'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-gray-500 mb-4">
          Super admins must choose the branch. Branch roles default to their assigned branch.
        </p>
        <div className="space-y-4">
          <Select
            label="Branch"
            required
            value={recordForm.branch_id}
            onChange={(e) => setRecordForm((f) => ({ ...f, branch_id: e.target.value }))}
          >
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.is_headquarters ? ' (HQ)' : ''}
              </option>
            ))}
          </Select>
          <Select
            label="Member (optional)"
            value={recordForm.member_id}
            onChange={(e) => setRecordForm((f) => ({ ...f, member_id: e.target.value }))}
          >
            <option value="">Anonymous / not linked</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name} · {m.member_code}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Giving type"
              value={recordForm.giving_type}
              onChange={(e) => setRecordForm((f) => ({ ...f, giving_type: e.target.value }))}
            >
              {GIVING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input
              label="Amount"
              type="number"
              min="0"
              step="0.01"
              value={recordForm.amount}
              onChange={(e) => setRecordForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Payment method"
              value={recordForm.payment_method}
              onChange={(e) => setRecordForm((f) => ({ ...f, payment_method: e.target.value }))}
            >
              {PAYMENT_METHODS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input
              label="Giving date"
              type="date"
              value={recordForm.giving_date}
              onChange={(e) => setRecordForm((f) => ({ ...f, giving_date: e.target.value }))}
            />
          </div>
          <Input
            label="Transaction reference"
            value={recordForm.transaction_ref}
            onChange={(e) => setRecordForm((f) => ({ ...f, transaction_ref: e.target.value }))}
            placeholder="Bank ref, POS slip, etc."
          />
          <Input
            label="Notes"
            value={recordForm.notes}
            onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional note"
          />
        </div>
      </Modal>
    </div>
  );
}
