import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './context/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MembersPage from './pages/MembersPage';
import FinancePage from './pages/FinancePage';
import BudgetPage from './pages/BudgetPage';
import AssetsPage from './pages/AssetsPage';
import SermonsPage from './pages/SermonsPage';
import LibraryPage from './pages/LibraryPage';
import MeetingsPage from './pages/MeetingsPage';
import EventsPage from './pages/EventsPage';
import PastoralPage from './pages/PastoralPage';
import CommunicationsPage from './pages/CommunicationsPage';
import HRPage from './pages/HRPage';
import FacilitiesPage from './pages/FacilitiesPage';
import ProjectsPage from './pages/ProjectsPage';
import BranchesPage from './pages/BranchesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditPage from './pages/AuditPage';
import DocumentsPage from './pages/DocumentsPage';
import AccessPage from './pages/AccessPage';
import PortalLayout from './components/PortalLayout';
import MemberPortalPage from './pages/MemberPortalPage';
import MemberInboxPage from './pages/MemberInboxPage';
import CACLandingPage from './pages/CACLandingPage';
import OtherPastorsPage from './pages/OtherPastorsPage';
import RoleGuard from './components/RoleGuard';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { isAuthenticated, fetchMe } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) fetchMe();
  }, []);

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<CACLandingPage />} />
        <Route path="/other-pastors" element={<OtherPastorsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/portal"
          element={
            <ProtectedRoute>
              <PortalLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MemberPortalPage />} />
        </Route>
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard"      element={<RoleGuard segment="dashboard"><DashboardPage /></RoleGuard>} />
          <Route path="members"        element={<RoleGuard segment="members"><MembersPage /></RoleGuard>} />
          <Route path="branches"       element={<RoleGuard segment="branches"><BranchesPage /></RoleGuard>} />
          <Route path="access"         element={<RoleGuard segment="access"><AccessPage /></RoleGuard>} />
          <Route path="finance"        element={<RoleGuard segment="finance"><FinancePage /></RoleGuard>} />
          <Route path="budget"         element={<RoleGuard segment="budget"><BudgetPage /></RoleGuard>} />
          <Route path="audit"          element={<RoleGuard segment="audit"><AuditPage /></RoleGuard>} />
          <Route path="sermons"        element={<RoleGuard segment="sermons"><SermonsPage /></RoleGuard>} />
          <Route path="library"        element={<RoleGuard segment="library"><LibraryPage /></RoleGuard>} />
          <Route path="meetings"       element={<RoleGuard segment="meetings"><MeetingsPage /></RoleGuard>} />
          <Route path="assets"         element={<RoleGuard segment="assets"><AssetsPage /></RoleGuard>} />
          <Route path="facilities"     element={<RoleGuard segment="facilities"><FacilitiesPage /></RoleGuard>} />
          <Route path="projects"       element={<RoleGuard segment="projects"><ProjectsPage /></RoleGuard>} />
          <Route path="hr"             element={<RoleGuard segment="hr"><HRPage /></RoleGuard>} />
          <Route path="communications" element={<RoleGuard segment="communications"><CommunicationsPage /></RoleGuard>} />
          <Route path="pastoral"       element={<RoleGuard segment="pastoral"><PastoralPage /></RoleGuard>} />
          <Route path="member-inbox"   element={<RoleGuard segment="member-inbox"><MemberInboxPage /></RoleGuard>} />
          <Route path="events"         element={<RoleGuard segment="events"><EventsPage /></RoleGuard>} />
          <Route path="documents"      element={<RoleGuard segment="documents"><DocumentsPage /></RoleGuard>} />
          <Route path="analytics"      element={<RoleGuard segment="analytics"><AnalyticsPage /></RoleGuard>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
