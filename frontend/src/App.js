import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { CRMProvider, useCRM } from "./context/CRMContext";
import Sidebar from "./components/layout/Sidebar";
import ImpersonationBanner from "./components/layout/ImpersonationBanner";
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import TotalLeads from "./pages/Leads/subpages/TotalLeads";
import FreshLeads from "./pages/Leads/subpages/FreshLeads";
import ImportLeads from "./pages/Leads/subpages/ImportLeads";
import AssignLeads from "./pages/Leads/subpages/AssignLeads";
import NonAssignLeads from "./pages/Leads/subpages/NonAssignLeads";
import AddLead from "./pages/Leads/subpages/AddLead";
import StatusWiseLeads from "./pages/Leads/subpages/StatusWiseLeads";
import Brokers from "./pages/Brokers/Brokers";
import AddBroker from "./pages/Brokers/AddBroker";
import DynamicFields from "./pages/DynamicFields/DynamicFields";
import AllUsers from "./pages/Users/AllUsers";
import AddUser from "./pages/Users/AddUser";
import FollowupPage from "./pages/Followup/FollowupPage";
import Team from "./pages/Team/Team";
import Attendance from "./pages/Attendance/Attendance";
import Loans from "./pages/Loans/Loans";
import AddLoan from "./pages/Loans/AddLoan";
import AllProjects from "./pages/Projects/AllProjects";
import AddProject from "./pages/Projects/AddProject";
import ViewProject from "./pages/Projects/ViewProject";
import AddProperty from "./pages/Properties/AddProperty";
import Properties from "./pages/Properties/Properties";
import ViewProperty from './pages/Properties/ViewProperty';
import "./theme.css";
import "./components/common/Common.css";
import AllCandidates from "./pages/HR/AllCandidates";
import AddCandidate from "./pages/HR/AddCandidate";
import SharedView from "./pages/SharedView/SharedView";
import Integration from "./pages/Integration/Integration";
import TrackUser from "./pages/TrackUser/TrackUser";
import PaySlip from "./pages/PaySlip/PaySlip";
import ChangePassword from "./pages/ChangePassword/ChangePassword";
import Profile from "./pages/Profile/Profile";
import Settings from "./pages/Settings/Settings";
import HelpCenter from "./pages/HelpCenter/HelpCenter";
import LeadsReport from "./pages/LeadsReport/LeadsReport";
import UserLeadsReport from "./pages/LeadsReport/UserLeadsReport";
import { ThemeProvider } from "./context/ThemeContext";
import "./App.css";

function AppContent() {
  const { sidebarOpen } = useCRM();
  return (
    <div className="app">
      <Sidebar />
      <main
        className="app__main"
        style={{ marginLeft: sidebarOpen ? 260 : 72 }}
      >
        <ImpersonationBanner />

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<TotalLeads />} />
          <Route path="/leads/fresh" element={<FreshLeads />} />
          <Route path="/leads/imported" element={<ImportLeads />} />
          <Route path="/leads/assigned" element={<AssignLeads />} />
          <Route path="/leads/non-assigned" element={<NonAssignLeads />} />
          <Route path="/leads/add" element={<AddLead />} />
          <Route path="/leads/edit/:id" element={<AddLead />} />
          <Route path="/leads/status-wise" element={<StatusWiseLeads />} />
          <Route path="/projects" element={<AllProjects />} />
          <Route path="/projects/add" element={<AddProject />} />
          <Route path="/projects/edit/:id" element={<AddProject />} />
          <Route path="/projects/view/:id" element={<ViewProject />} />
          <Route path="/properties/all" element={<Properties />} />
          <Route path="/properties/add" element={<AddProperty />} />
          <Route path="/properties/edit/:id" element={<AddProperty />} />
          <Route path="/properties/view/:id" element={<ViewProperty />} />
          <Route path="/brokers" element={<Brokers />} />
          <Route path="/brokers/list" element={<Brokers />} />
          <Route path="/brokers/add" element={<AddBroker />} />
          <Route path="/brokers/edit/:id" element={<AddBroker />} />
          <Route path="/dynamic-fields" element={<DynamicFields />} />
          <Route path="/dynamic-fields/manager" element={<DynamicFields />} />
          <Route path="/followup" element={<Navigate to="/followup/today" replace />} />
          <Route path="/followup/today" element={<FollowupPage />} />
          <Route path="/followup/missed" element={<FollowupPage />} />
          <Route path="/followup/upcoming" element={<FollowupPage />} />
          <Route path="/users/all" element={<AllUsers />} />
          <Route path="/users/add" element={<AddUser />} />
          <Route path="/users/edit/:id" element={<AddUser />} />
          <Route path="/hr/candidates" element={<AllCandidates />} />
          <Route path="/hr/candidates/add" element={<AddCandidate />} />
          <Route path="/hr/candidates/edit/:id" element={<AddCandidate />} />
          <Route path="/team" element={<Team />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/attendance/:tab" element={<Attendance />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/loans/add" element={<AddLoan />} />
          <Route path="/loans/edit/:id" element={<AddLoan />} />
          <Route path="/api-integration" element={<Integration />} />
          <Route path="/track-team" element={<TrackUser />} />
          <Route path="/payslip" element={<PaySlip />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/help-center" element={<HelpCenter />} />
          <Route path="/leads-report" element={<LeadsReport />} />
          <Route path="/leads-report/:userId" element={<UserLeadsReport />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1628', color: '#fff' }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <CRMProvider>
      <AppContent />
    </CRMProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Routes>
              <Route path="/shared/:token" element={<SharedView />} />
              <Route path="/*" element={<AuthGate />} />
            </Routes>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
