import { twMerge } from 'tailwind-merge';

// Stat Card
export function StatCard({ icon, value, label, change, changeType, accent = 'purple' }) {
  const accents = {
    purple: 'from-purple-500 to-purple-700',
    green:  'from-emerald-500 to-emerald-700',
    blue:   'from-blue-500 to-blue-700',
    amber:  'from-amber-500 to-amber-600',
    red:    'from-red-500 to-red-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accents[accent]}`} />
      <div className="text-2xl mb-3">{icon}</div>
      <div className="text-2xl font-bold font-display text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {change && (
        <div className={`text-xs mt-2 font-medium ${changeType === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
          {changeType === 'up' ? '↑' : '↓'} {change}
        </div>
      )}
    </div>
  );
}

// Page Header
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-gray-800">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Inline success / error banner (shared across staff pages). */
export function NoticeBanner({ type = 'success', children, detail, className }) {
  const variant =
    type === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return (
    <div className={twMerge('mb-4 rounded-lg border px-4 py-3 text-sm', variant, className)}>
      {children != null && children !== '' ? <div>{children}</div> : null}
      {detail ? (
        <code className="mt-2 block break-all rounded border border-black/10 bg-white/80 px-2 py-1.5 font-mono text-xs text-gray-900">
          {detail}
        </code>
      ) : null}
    </div>
  );
}

// Card
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// Card Header
export function CardHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between p-5 border-b border-gray-100">
      <h3 className="font-semibold font-display text-gray-800">{title}</h3>
      {action}
    </div>
  );
}

// Badge
export function Badge({ children, variant = 'default' }) {
  const variants = {
    default:  'bg-gray-100 text-gray-600 border-gray-200',
    success:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger:   'bg-red-50 text-red-700 border-red-200',
    warning:  'bg-amber-50 text-amber-700 border-amber-200',
    info:     'bg-blue-50 text-blue-700 border-blue-200',
    purple:   'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${variants[variant]}`}>
      {children}
    </span>
  );
}

// Button
export function Button({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button' }) {
  const variants = {
    primary:  'bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-500 hover:to-purple-700 shadow-sm',
    outline:  'bg-white border border-gray-200 text-gray-600 hover:border-purple-400 hover:text-purple-700',
    danger:   'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100',
    ghost:    'text-gray-500 hover:text-purple-700 hover:bg-purple-50',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </button>
  );
}

// Input
export function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>}
      <input
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-colors"
        {...props}
      />
    </div>
  );
}

// Select
export function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>}
      <select
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-colors"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

// Modal
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-purple-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold font-display text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}

// Loading spinner
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  );
}

// Progress Bar
export function ProgressBar({ value, max, variant = 'purple' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colors = { purple: 'bg-purple-500', green: 'bg-emerald-500', red: 'bg-red-500', amber: 'bg-amber-500' };
  const color = pct > 85 ? colors.red : pct > 60 ? colors.amber : colors[variant];
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

// Avatar
export function Avatar({ name, size = 'sm' }) {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-purple-400 to-purple-700 flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// Stats grid wrapper
export function StatsGrid({ children }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {children}
    </div>
  );
}

// Table wrapper
export function Table({ headers, children, empty = 'No records found' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {children}
        </tbody>
      </table>
    </div>
  );
}
