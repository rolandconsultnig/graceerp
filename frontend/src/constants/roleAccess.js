/**
 * Which staff roles may open each app section (matches backend authorize() intent).
 * super_admin may access everything.
 */
export const STAFF_ROLES = [
  'super_admin',
  'branch_admin',
  'finance_officer',
  'pastor',
  'content_manager',
  'hr_officer',
  'dept_head',
  'coordinating_elder',
  'coordinating_pastor',
];

const ALL_STAFF = STAFF_ROLES;

export const ROUTE_ACCESS = {
  dashboard: ALL_STAFF,
  members: [
    'super_admin',
    'branch_admin',
    'pastor',
    'finance_officer',
    'hr_officer',
    'content_manager',
    'dept_head',
    'coordinating_elder',
    'coordinating_pastor',
  ],
  branches: ['super_admin', 'branch_admin'],
  access: ['super_admin', 'branch_admin'],
  finance: ['super_admin', 'branch_admin', 'finance_officer'],
  budget: ['super_admin', 'branch_admin', 'finance_officer'],
  audit: ['super_admin', 'branch_admin', 'finance_officer'],
  sermons: ['super_admin', 'branch_admin', 'pastor', 'content_manager'],
  library: ['super_admin', 'branch_admin', 'pastor', 'content_manager'],
  meetings: ['super_admin', 'branch_admin', 'pastor', 'content_manager'],
  assets: ['super_admin', 'branch_admin', 'finance_officer'],
  facilities: ['super_admin', 'branch_admin'],
  projects: [
    'super_admin',
    'branch_admin',
    'finance_officer',
    'dept_head',
    'pastor',
    'coordinating_elder',
    'coordinating_pastor',
  ],
  /** HR module: hr_officer + admins manage; finance_officer may view lists only (see canManageHrModule). */
  hr: ['super_admin', 'branch_admin', 'hr_officer', 'finance_officer'],
  communications: ['super_admin', 'branch_admin', 'pastor', 'content_manager'],
  pastoral: ['super_admin', 'branch_admin', 'pastor'],
  'member-inbox': ['super_admin', 'branch_admin', 'pastor'],
  events: ['super_admin', 'branch_admin', 'pastor', 'content_manager'],
  documents: [
    'super_admin',
    'branch_admin',
    'pastor',
    'content_manager',
    'finance_officer',
    'hr_officer',
  ],
  /** Matches backend analytics read roles (dashboard KPIs use the same APIs). */
  analytics: ALL_STAFF,
};

/** Nav order used to pick a sensible home when redirecting from a forbidden route. */
export const NAV_ROUTE_ORDER = [
  'dashboard',
  'members',
  'branches',
  'access',
  'finance',
  'budget',
  'audit',
  'sermons',
  'library',
  'meetings',
  'assets',
  'facilities',
  'projects',
  'hr',
  'communications',
  'pastoral',
  'member-inbox',
  'events',
  'documents',
  'analytics',
];

/** Staff who may create/update/delete HR records (leave, staff directory). */
export function canManageHrModule(role) {
  return ['super_admin', 'branch_admin', 'hr_officer'].includes(role || '');
}

/** Includes finance_officer (directory + leave visibility only; see canManageHrModule). */
export function canViewHrModule(role) {
  return canManageHrModule(role) || role === 'finance_officer';
}

export function pathToSegment(pathname) {
  const s = String(pathname || '').replace(/^\//, '').split('/')[0];
  return s || 'dashboard';
}

export function canAccessRoute(role, segment) {
  if (!role) return false;
  if (role === 'member') return false;
  if (role === 'super_admin') return true;
  const allowed = ROUTE_ACCESS[segment];
  if (!allowed) return STAFF_ROLES.includes(role);
  return allowed.includes(role);
}

/** First allowed path for role (always includes leading slash). */
export function getHomePathForRole(role) {
  if (role === 'member') return '/portal';
  for (const seg of NAV_ROUTE_ORDER) {
    if (canAccessRoute(role, seg)) return `/${seg}`;
  }
  return '/dashboard';
}
