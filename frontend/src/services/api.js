import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

function authRefreshUrl() {
  const base = (api.defaults.baseURL || '/api').replace(/\/$/, '');
  return `${base}/auth/refresh`;
}

function isPublicAuthRequest(config) {
  const u = config.url || '';
  return u.includes('/auth/login') || u.includes('/auth/refresh');
}

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('graceerp_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-refresh access token on 401 (rotation: persist new refresh token from API)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (!original || isPublicAuthRequest(original)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('graceerp_refresh');

      if (refreshToken) {
        try {
          const res = await axios.post(
            authRefreshUrl(),
            { refreshToken },
            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
          );
          const { token, refreshToken: nextRefresh } = res.data.data;
          localStorage.setItem('graceerp_token', token);
          if (nextRefresh) localStorage.setItem('graceerp_refresh', nextRefresh);
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        } catch {
          localStorage.removeItem('graceerp_token');
          localStorage.removeItem('graceerp_refresh');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// ── API service methods ───────────────────────────────────────────────────────
export const authAPI = {
  login:          (data) => api.post('/auth/login', data),
  logout:         ()     => api.post('/auth/logout'),
  refresh:        (data) => api.post('/auth/refresh', data),
  me:             ()     => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

export const membersAPI = {
  getAll:  (params) => api.get('/members', { params }),
  getOne:  (id)     => api.get(`/members/${id}`),
  create:  (data)   => api.post('/members', data),
  update:  (id, data) => api.put(`/members/${id}`, data),
  remove:  (id)     => api.delete(`/members/${id}`),
  stats:   (params) => api.get('/members/stats', { params }),
  uploadPhoto: (id, formData) =>
    api.post(`/members/${id}/photo`, formData, {
      transformRequest: [
        (data, headers) => {
          if (typeof FormData !== 'undefined' && data instanceof FormData) {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    }),
};

export const financeAPI = {
  getAllGiving:  (params) => api.get('/finance/giving', { params }),
  getGiving:    (id)     => api.get(`/finance/giving/${id}`),
  recordGiving: (data)   => api.post('/finance/giving', data),
  summary:      (params) => api.get('/finance/summary', { params }),
  getLedger:    (params) => api.get('/finance/ledger', { params }),
};

export const projectAPI = {
  listProjects: (params) => api.get('/projects', { params }),
  getProject: (id) => api.get(`/projects/${id}`),
  createProject: (data) => api.post('/projects', data),
  updateProject: (id, data) => api.put(`/projects/${id}`, data),
  removeProject: (id) => api.delete(`/projects/${id}`),
  listDeptBudgets: (params) => api.get('/projects/department-budgets', { params }),
  getDeptBudget: (bid) => api.get(`/projects/department-budgets/${bid}`),
  createDeptBudget: (data) => api.post('/projects/department-budgets', data),
  updateDeptBudget: (bid, data) => api.put(`/projects/department-budgets/${bid}`, data),
  submitDeptBudget: (bid) => api.post(`/projects/department-budgets/${bid}/submit`),
  approveDeptBudget: (bid) => api.post(`/projects/department-budgets/${bid}/approve`),
  rejectDeptBudget: (bid, data) => api.post(`/projects/department-budgets/${bid}/reject`, data),
  deleteDeptBudget: (bid) => api.delete(`/projects/department-budgets/${bid}`),
};

export const budgetAPI = {
  getAll: (params) => api.get('/budget', { params }),
  getOne: (id) => api.get(`/budget/${id}`),
  create: (data) => api.post('/budget', data),
  update: (id, d) => api.put(`/budget/${id}`, d),
  remove: (id) => api.delete(`/budget/${id}`),
  listExpenditure: (params) => api.get('/budget/expenditure-requests', { params }),
  getExpenditure: (eid) => api.get(`/budget/expenditure-requests/${eid}`),
  createExpenditure: (data) => api.post('/budget/expenditure-requests', data),
  updateExpenditure: (eid, data) => api.put(`/budget/expenditure-requests/${eid}`, data),
  approveExpenditure: (eid) => api.post(`/budget/expenditure-requests/${eid}/approve`),
  rejectExpenditure: (eid, data) => api.post(`/budget/expenditure-requests/${eid}/reject`, data),
  deleteExpenditure: (eid) => api.delete(`/budget/expenditure-requests/${eid}`),
};

export const assetsAPI = {
  getAll: (params) => api.get('/assets', { params }),
  getOne: (id) => api.get(`/assets/${id}`),
  create: (data) => api.post('/assets', data),
  update: (id, data) => api.put(`/assets/${id}`, data),
  remove: (id) => api.delete(`/assets/${id}`),
  listMaintenance: (assetId) => api.get(`/assets/${assetId}/maintenance`),
  addMaintenance: (assetId, data) => api.post(`/assets/${assetId}/maintenance`, data),
  updateMaintenance: (assetId, mid, data) => api.put(`/assets/${assetId}/maintenance/${mid}`, data),
  deleteMaintenance: (assetId, mid) => api.delete(`/assets/${assetId}/maintenance/${mid}`),
  listMaintenanceUpcoming: (params) => api.get('/assets/maintenance/upcoming', { params }),
  listMaintenanceHistory: (params) => api.get('/assets/maintenance/history', { params }),
};

export const sermonsAPI = {
  getAll:  (params)   => api.get('/sermons', { params }),
  getOne:  (id)       => api.get(`/sermons/${id}`),
  create:  (data)     => api.post('/sermons', data),
  update:  (id, data) => api.put(`/sermons/${id}`, data),
  remove:  (id)       => api.delete(`/sermons/${id}`),
};

export const libraryAPI = {
  getAll:  (params)   => api.get('/library', { params }),
  getOne:  (id)       => api.get(`/library/${id}`),
  create:  (data)     => api.post('/library', data),
  update:  (id, data) => api.put(`/library/${id}`, data),
  remove:  (id)       => api.delete(`/library/${id}`),
};

export const meetingsAPI = {
  getAll:  (params)   => api.get('/meetings', { params }),
  getOne:  (id)       => api.get(`/meetings/${id}`),
  create:  (data)     => api.post('/meetings', data),
  update:  (id, data) => api.put(`/meetings/${id}`, data),
  remove:  (id)       => api.delete(`/meetings/${id}`),
  getAttendance: (id) => api.get(`/meetings/${id}/attendance`),
  recordAttendance: (id, data) => api.post(`/meetings/${id}/attendance`, data),
  start:   (id)       => api.put(`/meetings/${id}`, { status: 'live' }),
  end:     (id)       => api.put(`/meetings/${id}`, { status: 'ended' }),
};

export const eventsAPI = {
  getAll:  (params)   => api.get('/events', { params }),
  getOne:  (id)       => api.get(`/events/${id}`),
  create:  (data)     => api.post('/events', data),
  update:  (id, data) => api.put(`/events/${id}`, data),
  remove:  (id)       => api.delete(`/events/${id}`),
  listRsvps: (id)     => api.get(`/events/${id}/rsvps`),
  rsvp:    (id, data) => api.post(`/events/${id}/rsvp`, data),
};

export const churchesAPI = {
  list: () => api.get('/churches'),
  getOne: (id) => api.get(`/churches/${id}`),
  update: (id, data) => api.put(`/churches/${id}`, data),
};

export const pastoralAPI = {
  summary: () => api.get('/pastoral/summary'),
  listPrayers: (params) => api.get('/pastoral/prayers', { params }),
  getPrayer: (id) => api.get(`/pastoral/prayers/${id}`),
  createPrayer: (data) => api.post('/pastoral/prayers', data),
  updatePrayer: (id, data) => api.put(`/pastoral/prayers/${id}`, data),
  deletePrayer: (id) => api.delete(`/pastoral/prayers/${id}`),
  listVisits: (params) => api.get('/pastoral/visits', { params }),
  getVisit: (id) => api.get(`/pastoral/visits/${id}`),
  createVisit: (data) => api.post('/pastoral/visits', data),
  deleteVisit: (id) => api.delete(`/pastoral/visits/${id}`),
  listWelfare: (params) => api.get('/pastoral/welfare', { params }),
  getWelfare: (id) => api.get(`/pastoral/welfare/${id}`),
  createWelfare: (data) => api.post('/pastoral/welfare', data),
  updateWelfare: (id, data) => api.put(`/pastoral/welfare/${id}`, data),
  deleteWelfare: (id) => api.delete(`/pastoral/welfare/${id}`),
};

export const commsAPI = {
  getAll: (params) => api.get('/communications', { params }),
  getOne: (id) => api.get(`/communications/${id}`),
  create: (data) => api.post('/communications', data),
  update: (id, data) => api.put(`/communications/${id}`, data),
  remove: (id) => api.delete(`/communications/${id}`),
  send: (id) => api.post(`/communications/${id}/send`),
};

export const hrAPI = {
  getAll: (params) => api.get('/hr', { params }),
  getOne: (id) => api.get(`/hr/${id}`),
  create: (data) => api.post('/hr', data),
  update: (id, data) => api.put(`/hr/${id}`, data),
  remove: (id) => api.delete(`/hr/${id}`),
  listLeaveRequests: (params) => api.get('/hr/leave-requests', { params }),
  createLeaveRequest: (data) => api.post('/hr/leave-requests', data),
  updateLeaveRequest: (id, data) => api.put(`/hr/leave-requests/${id}`, data),
};

export const facilitiesAPI = {
  getAll: (params) => api.get('/facilities', { params }),
  getOne: (id) => api.get(`/facilities/${id}`),
  create: (data) => api.post('/facilities', data),
  update: (id, data) => api.put(`/facilities/${id}`, data),
  remove: (id) => api.delete(`/facilities/${id}`),
  getBookings: (params) => api.get('/facilities/bookings', { params }),
  createBooking: (data) => api.post('/facilities/bookings', data),
  updateBooking: (bookingId, data) => api.put(`/facilities/bookings/${bookingId}`, data),
  deleteBooking: (bookingId) => api.delete(`/facilities/bookings/${bookingId}`),
};

export const documentsAPI = {
  getAll: (params) => api.get('/documents', { params }),
  getOne: (id) => api.get(`/documents/${id}`),
  createJson: (data) => api.post('/documents', data),
  update: (id, data) => api.put(`/documents/${id}`, data),
  remove: (id) => api.delete(`/documents/${id}`),
  uploadFile: (formData) =>
    api.post('/documents/upload', formData, {
      transformRequest: [
        (data, headers) => {
          if (typeof FormData !== 'undefined' && data instanceof FormData) {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    }),
};

export const analyticsAPI = {
  dashboard:        (p) => api.get('/analytics/dashboard', { params: p }),
  givingTrend:      (p) => api.get('/analytics/giving-trend', { params: p }),
  memberGrowth:     (p) => api.get('/analytics/member-growth', { params: p }),
  attendanceTrend:  (p) => api.get('/analytics/attendance-trend', { params: p }),
  branchComparison: (p) => api.get('/analytics/branch-comparison', { params: p }),
  content:          (p) => api.get('/analytics/content', { params: p }),
};

export const auditAPI = {
  getLogs: (params) => api.get('/audit', { params }),
  getOne: (id) => api.get(`/audit/${id}`),
};

export const memberPortalAPI = {
  getProfile: () => api.get('/member-portal/profile'),
  updateProfile: (data) => api.put('/member-portal/profile', data),
  uploadPhoto: (formData) =>
    api.post('/member-portal/profile/photo', formData, {
      transformRequest: [
        (data, headers) => {
          if (typeof FormData !== 'undefined' && data instanceof FormData) {
            delete headers['Content-Type'];
          }
          return data;
        },
      ],
    }),
  webrtcConfig: () => api.get('/member-portal/chat/webrtc-config'),
  listChat: () => api.get('/member-portal/chat/messages'),
  postChat: (body) => api.post('/member-portal/chat/messages', { body }),
  staffInbox: () => api.get('/member-portal/staff/inbox'),
  staffThread: (memberId) => api.get(`/member-portal/staff/members/${memberId}/messages`),
  staffReply: (memberId, body) => api.post(`/member-portal/staff/members/${memberId}/messages`, { body }),
};

export const branchesAPI = {
  getAll:  (params)   => api.get('/branches', { params }),
  getOne:  (id)       => api.get(`/branches/${id}`),
  create:  (data)     => api.post('/branches', data),
  update:  (id, data) => api.put(`/branches/${id}`, data),
  remove:  (id)       => api.delete(`/branches/${id}`),
};

export const usersAPI = {
  getAll:     (params)   => api.get('/users', { params }),
  getOne:     (id)       => api.get(`/users/${id}`),
  create:     (data)     => api.post('/users', data),
  update:     (id, data) => api.put(`/users/${id}`, data),
  deactivate: (id)       => api.delete(`/users/${id}`),
};

export default api;
