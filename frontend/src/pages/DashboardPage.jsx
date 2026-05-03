import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsAPI } from '../services/api';
import { StatCard, StatsGrid, Card, CardHeader, PageHeader, Badge, Spinner } from '../components/UI';
import useAuthStore from '../context/authStore';
import useBranchScopeStore from '../context/branchScopeStore';

function downloadCsv(filename, rows) {
  const esc = (cell) => {
    const s = cell == null ? '' : String(cell);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const selectedBranchId = useBranchScopeStore((s) => s.selectedBranchId);

  const [data, setData] = useState(null);
  const [trend, setTrend] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trendYear, setTrendYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [dash, givingTrend, branchComp] = await Promise.all([
          analyticsAPI.dashboard(),
          analyticsAPI.givingTrend({ year: trendYear }),
          analyticsAPI.branchComparison(),
        ]);
        if (!cancelled) {
          setData(dash.data.data);
          setTrend(givingTrend.data.data);
          setBranches(branchComp.data.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedBranchId, trendYear]);

  const fmt = (n) =>
    n ? Number(n).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }) : '₦0';
  const num = (n) => (n ? parseInt(n, 10).toLocaleString() : '0');

  const scopeLabel = useMemo(() => {
    if (!user) return '';
    if (user.role === 'super_admin') {
      if (!selectedBranchId) return 'All congregations · aggregated';
      const hit = branches.find((b) => b.id === selectedBranchId);
      return hit ? `${hit.name}${hit.is_headquarters ? ' · HQ' : ''}` : 'Selected congregation';
    }
    return user.branch_name || 'Your congregation';
  }, [user, selectedBranchId, branches]);

  const yearChoices = useMemo(() => {
    const cy = new Date().getFullYear();
    const list = [];
    for (let y = cy - 5; y <= cy + 1; y += 1) list.push(y);
    return list;
  }, []);

  const memberStatLabel =
    user?.role === 'super_admin' && !selectedBranchId ? 'Total Members (all congregations)' : 'Total Members';

  const branchStatLabel =
    user?.role === 'super_admin' && !selectedBranchId
      ? 'Active Congregations'
      : user?.role === 'super_admin' && selectedBranchId
        ? 'Congregation context'
        : 'Congregations';

  const dateSubtitle = new Date().toLocaleDateString('en-NG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleExportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const rows = [
      ['GraceERP dashboard export', stamp],
      ['Scope', scopeLabel],
      [],
      ['Metric', 'Value'],
      ['Total members', data?.members?.total ?? ''],
      ['Active members', data?.members?.active ?? ''],
      ['New this month', data?.members?.new_this_month ?? ''],
      ['Giving this month', data?.giving?.total_this_month ?? ''],
      ['Tithes', data?.giving?.tithes ?? ''],
      ['Offerings', data?.giving?.offerings ?? ''],
      ['Special seeds', data?.giving?.seeds ?? ''],
      ['Giving transactions', data?.giving?.transactions ?? ''],
      ['Total assets', data?.assets?.total_assets ?? ''],
      ['Asset value', data?.assets?.total_value ?? ''],
      ['Maintenance assets', data?.assets?.under_maintenance ?? ''],
      ['Attendance today', data?.attendance?.today ?? ''],
      ['Sermon plays', data?.sermons?.total_plays ?? ''],
      ['Sermons catalogued', data?.sermons?.total_sermons ?? ''],
      [],
      ['Giving trend year', trendYear],
      ['Month', 'Total', 'Count'],
      ...trend.map((t) => [t.month, t.total, t.count]),
      [],
      ['Congregation summary'],
      ['Name', 'HQ', 'Members', 'Active', 'Giving YTD', 'Staff'],
      ...branches.map((b) => [
        b.name,
        b.is_headquarters ? 'yes' : '',
        b.member_count,
        b.active_members,
        b.total_giving_ytd,
        b.staff_count,
      ]),
    ];
    downloadCsv(`graceerp-dashboard-${stamp}.csv`, rows);
  };

  if (loading && !data) return <Spinner />;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(' ')[0] ?? ''}`}
        subtitle={`${dateSubtitle} · ${scopeLabel}`}
        action={
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            ⬇ Export Report (CSV)
          </button>
        }
      />

      <StatsGrid>
        <StatCard
          icon="👥"
          value={num(data?.members?.total)}
          label={memberStatLabel}
          change={`${num(data?.members?.new_this_month)} new this month`}
          changeType="up"
          accent="purple"
        />
        <StatCard icon="💰" value={fmt(data?.giving?.total_this_month)} label="Giving This Month" changeType="up" accent="green" />
        <StatCard icon="🏛" value={branches.length || '—'} label={branchStatLabel} accent="blue" />
        <StatCard icon="🎙" value={num(data?.sermons?.total_plays)} label="Total Sermon Plays" accent="amber" />
      </StatsGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <Card>
          <CardHeader
            title={`Monthly Giving Trend (${trendYear})`}
            action={
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 whitespace-nowrap">Year</label>
                <select
                  value={trendYear}
                  onChange={(e) => setTrendYear(Number(e.target.value))}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700"
                >
                  {yearChoices.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <Badge variant="purple">Annual</Badge>
              </div>
            }
          />
          <div className="p-5">
            {loading ? (
              <div className="h-44 flex items-center justify-center text-gray-400 text-sm">Updating chart…</div>
            ) : trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={trend}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    tickFormatter={(v) => `₦${(v / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip formatter={(v) => [fmt(v), 'Total']} />
                  <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
                No giving data for {trendYear} in this scope — add records or pick another year.
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={selectedBranchId ? 'Members · this congregation' : 'Members by congregation'}
            action={
              <Link to="/analytics" className="text-xs text-purple-600 hover:text-purple-800">
                Analytics →
              </Link>
            }
          />
          <div className="p-5 space-y-4">
            {branches.length > 0 ? (
              branches.map((b) => (
                <div key={b.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-700 flex items-center gap-1.5">
                      {b.is_headquarters && <Badge variant="purple">HQ</Badge>}
                      {b.name}
                    </span>
                    <span className="text-xs text-gray-400">{num(b.member_count)} members</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-purple-300 rounded-full"
                      style={{
                        width: `${Math.min(100, (b.member_count / (branches[0]?.member_count || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No congregation data for this scope</p>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Giving Breakdown" />
          <div className="p-5 space-y-3">
            {[
              { label: 'Tithes', value: data?.giving?.tithes, color: 'bg-purple-500' },
              { label: 'Offerings', value: data?.giving?.offerings, color: 'bg-blue-500' },
              { label: 'Special Seeds', value: data?.giving?.seeds, color: 'bg-amber-500' },
            ].map(({ label, value, color }) => {
              const total = data?.giving?.total_this_month || 1;
              const pct = value ? Math.round((value / total) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-600">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{fmt(value)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Assets Overview" />
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold font-display text-gray-800">{num(data?.assets?.total_assets)}</div>
                <div className="text-xs text-gray-400 mt-0.5">Total Assets</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-display text-gray-800">{fmt(data?.assets?.total_value)}</div>
                <div className="text-xs text-gray-400 mt-0.5">Total Value</div>
              </div>
              <div>
                <div className="text-2xl font-bold font-display text-amber-600">{num(data?.assets?.under_maintenance)}</div>
                <div className="text-xs text-gray-400 mt-0.5">Maintenance</div>
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-purple-700">{num(data?.members?.active)}</div>
                <div className="text-xs text-purple-500 mt-0.5">Active Members</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-emerald-700">{num(data?.sermons?.total_sermons)}</div>
                <div className="text-xs text-emerald-500 mt-0.5">Total Sermons</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
