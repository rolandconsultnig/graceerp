import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analyticsAPI } from '../services/api';
import { PageHeader, Card, CardHeader, Badge, Spinner, Table } from '../components/UI';
import useAuthStore from '../context/authStore';
import useBranchScopeStore from '../context/branchScopeStore';

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '₦0';
  return Number(n).toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
}

const num = (n) => (n != null ? parseInt(n, 10).toLocaleString() : '0');

export default function AnalyticsPage() {
  const { user } = useAuthStore();
  const selectedBranchId = useBranchScopeStore((s) => s.selectedBranchId);

  const [trendYear, setTrendYear] = useState(() => new Date().getFullYear());
  const [trend, setTrend] = useState([]);
  const [memberGrowth, setMemberGrowth] = useState([]);
  const [growthMonths, setGrowthMonths] = useState(12);
  const [attWeeks, setAttWeeks] = useState(8);
  const [attendance, setAttendance] = useState([]);
  const [branches, setBranches] = useState([]);
  const [content, setContent] = useState({ topSermons: [], topResources: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [givingTrend, mg, att, bc, ct] = await Promise.all([
          analyticsAPI.givingTrend({ year: trendYear }),
          analyticsAPI.memberGrowth({ months: growthMonths }),
          analyticsAPI.attendanceTrend({ weeks: attWeeks }),
          analyticsAPI.branchComparison(),
          analyticsAPI.content(),
        ]);
        if (cancelled) return;
        setTrend(givingTrend.data?.data ?? []);
        setMemberGrowth(mg.data?.data ?? []);
        setAttendance(att.data?.data ?? []);
        setBranches(bc.data?.data ?? []);
        setContent(ct.data?.data ?? { topSermons: [], topResources: [] });
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBranchId, trendYear, growthMonths, attWeeks]);

  const scopeLabel = useMemo(() => {
    if (!user) return '';
    if (user.role === 'super_admin') {
      if (!selectedBranchId) return 'All congregations · aggregated';
      const hit = branches.find((b) => b.id === selectedBranchId);
      return hit ? `${hit.name}${hit.is_headquarters ? ' · HQ' : ''}` : 'Selected congregation';
    }
    return user.branch_name || 'Your congregation';
  }, [user, selectedBranchId, branches]);

  const attChartData = useMemo(() => {
    const map = {};
    for (const r of attendance) {
      const d = typeof r.service_date === 'string' ? r.service_date.slice(0, 10) : r.service_date;
      map[d] = (map[d] || 0) + Number(r.count || 0);
    }
    return Object.entries(map)
      .map(([date, count]) => ({
        date,
        label: date.slice(5),
        count,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [attendance]);

  const yearChoices = useMemo(() => {
    const cy = new Date().getFullYear();
    const list = [];
    for (let y = cy - 5; y <= cy + 1; y += 1) list.push(y);
    return list;
  }, []);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle={`Trends and comparisons · ${scopeLabel}`}
        action={
          <Link
            to="/"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-700"
          >
            ← Dashboard
          </Link>
        }
      />

      {loading && !trend.length && !branches.length ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <Card>
              <CardHeader
                title={`Monthly giving (${trendYear})`}
                action={
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Year</label>
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
                  </div>
                }
              />
              <div className="p-5">
                {trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={trend}>
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(v) => `₦${(v / 1000000).toFixed(1)}M`} />
                      <Tooltip formatter={(v) => [fmt(v), 'Total']} />
                      <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
                    No giving data for this year and scope.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Member growth by congregation"
                action={
                  <select
                    value={growthMonths}
                    onChange={(e) => setGrowthMonths(Number(e.target.value))}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700"
                  >
                    {[3, 6, 12, 24].map((m) => (
                      <option key={m} value={m}>
                        Last {m} mo
                      </option>
                    ))}
                  </select>
                }
              />
              <div className="p-5">
                {memberGrowth.length > 0 ? (
                  <Table headers={['Congregation', 'Members', 'New (period)']}>
                    {memberGrowth.map((row, idx) => (
                      <tr key={`${row.branch}-${idx}`}>
                        <td className="px-4 py-3 font-medium text-gray-800">{row.branch}</td>
                        <td className="px-4 py-3 text-gray-600">{num(row.start_count)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="success">+{num(row.new_members)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No growth data for this scope.</p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <Card>
              <CardHeader
                title="Attendance trend"
                action={
                  <select
                    value={attWeeks}
                    onChange={(e) => setAttWeeks(Number(e.target.value))}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700"
                  >
                    {[4, 8, 12, 16].map((w) => (
                      <option key={w} value={w}>
                        {w} weeks
                      </option>
                    ))}
                  </select>
                }
              />
              <div className="p-5">
                {attChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={attChartData}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" name="Attendance" stroke="#6366f1" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
                    No attendance rows in this window — scoped data may be empty.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Congregation comparison" />
              <div className="p-5 overflow-x-auto">
                {branches.length > 0 ? (
                  <Table headers={['', 'Members', 'Active', 'Giving YTD', 'Staff']}>
                    {branches.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-800">{b.name}</span>
                          {b.is_headquarters ? <span className="ml-2 inline-block"><Badge variant="purple">HQ</Badge></span> : null}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{num(b.member_count)}</td>
                        <td className="px-4 py-3 text-gray-600">{num(b.active_members)}</td>
                        <td className="px-4 py-3 text-xs">{fmt(b.total_giving_ytd)}</td>
                        <td className="px-4 py-3 text-gray-600">{num(b.staff_count)}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">No branch comparison data.</p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader title="Top sermons by plays" />
              <div className="p-5">
                {(content.topSermons || []).length ? (
                  <Table headers={['Title', 'Preacher', 'Plays']}>
                    {content.topSermons.map((s, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-sm text-gray-800 max-w-[200px] truncate">{s.title}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{s.preacher_name || '—'}</td>
                        <td className="px-4 py-2 text-xs">{num(s.play_count)}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">No sermon analytics yet.</p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Top library resources by views" />
              <div className="p-5">
                {(content.topResources || []).length ? (
                  <Table headers={['Title', 'Category', 'Views']}>
                    {content.topResources.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-sm text-gray-800 max-w-[200px] truncate">{r.title}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{r.category || '—'}</td>
                        <td className="px-4 py-2 text-xs">{num(r.view_count)}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">No library analytics yet.</p>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
