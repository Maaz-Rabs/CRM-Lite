import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useCRM } from '../../context/CRMContext';
import {
  LayoutDashboard, Users, Briefcase, UserCheck, CalendarClock,
  ChevronLeft, ChevronRight, ChevronDown, Building2, Crown,
  List, Sparkles, Upload, UserPlus, UserX, PlusCircle, BarChart3, RotateCcw,
  PhoneCall, CreditCard, Home, UserCog, FileText, FolderKanban,
  Receipt, Link2, KeyRound, Settings2
} from 'lucide-react';
import './Sidebar.css';

const leadsSubItems = [
  { path: '/leads', icon: List, label: 'Total Leads' },
  { path: '/leads/fresh', icon: Sparkles, label: 'Fresh Leads' },
  { path: '/leads/imported', icon: Upload, label: 'Import Leads' },
  { path: '/leads/assigned', icon: UserPlus, label: 'Assign Leads' },
  { path: '/leads/non-assigned', icon: UserX, label: 'Non-Assign Leads' },
  { path: '/leads/add', icon: PlusCircle, label: 'Add Lead' },
  { path: '/leads/status-wise', icon: BarChart3, label: 'Status Wise' },
  { path: '/leads/reset', icon: RotateCcw, label: 'Reset Leads' },
];

const followUpSubItems = [
  { path: '/followup/pending', icon: PhoneCall, label: 'Pending Follow ups' },
  { path: '/followup/completed', icon: UserCheck, label: 'Completed' },
];

const loanSubItems = [
  { path: '/loan/all', icon: List, label: 'All Loans' },
  { path: '/loan/apply', icon: PlusCircle, label: 'Apply Loan' },
  { path: '/loan/status', icon: BarChart3, label: 'Loan Status' },
];

const propertiesSubItems = [
  { path: '/properties/all', icon: List, label: 'All Properties' },
  { path: '/properties/add', icon: PlusCircle, label: 'Add Property' },
];

const brokerSubItems = [
  { path: '/brokers/list', icon: List, label: 'Broker List' },
  { path: '/brokers/add', icon: PlusCircle, label: 'Add Broker' },
];

const hrSubItems = [
  { path: '/hr/employees', icon: Users, label: 'Employees' },
  { path: '/hr/departments', icon: Building2, label: 'Departments' },
  { path: '/hr/leave', icon: CalendarClock, label: 'Leave Management' },
];

const attendanceSubItems = [
  { path: '/attendance/daily', icon: FileText, label: 'Daily Report' },
  { path: '/attendance/monthly', icon: BarChart3, label: 'Monthly Report' },
];

const usersSubItems = [
  { path: '/users/all', icon: List, label: 'All Users' },
  { path: '/users/add', icon: UserPlus, label: 'Add User' },
  { path: '/users/roles', icon: UserCog, label: 'Roles & Permissions' },
];

const dynamicFieldsSubItems = [
  { path: '/dynamic-fields/manager', icon: Settings2, label: 'Field Manager' },
  { path: '/dynamic-fields/add', icon: PlusCircle, label: 'Add Field' },
];

// ─── Reusable collapsible group ───────────────────────────────────────────────
const SidebarGroup = ({ icon: Icon, label, basePath, subItems, sidebarOpen }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(basePath);
  const [open, setOpen] = useState(isActive);

  return (
    <div className="sidebar__group">
      <button
        className={`sidebar__link sidebar__link--parent ${isActive ? 'sidebar__link--active' : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        title={label}
      >
        <Icon size={20} />
        {sidebarOpen && (
          <>
            <span>{label}</span>
            <ChevronDown
              size={16}
              className={`sidebar__chevron ${open ? 'sidebar__chevron--open' : ''}`}
            />
          </>
        )}
      </button>

      {sidebarOpen && open && (
        <div className="sidebar__submenu">
          {subItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) =>
                `sidebar__sublink ${isActive ? 'sidebar__sublink--active' : ''}`
              }
            >
              <item.icon size={15} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
const Sidebar = () => {
  const { sidebarOpen, toggleSidebar } = useCRM();

  return (
    <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : 'sidebar--collapsed'}`}>

      {/* Header / Logo */}
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon">
            <Crown size={22} />
          </div>
          {sidebarOpen && (
            <div className="sidebar__logo-text">
              <h1>Fortune</h1>
              <span>Real Estate CRM</span>
            </div>
          )}
        </div>
        <button className="sidebar__toggle" onClick={toggleSidebar}>
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">

        {/* Dashboard */}
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
          title="Dashboard"
        >
          <LayoutDashboard size={20} />
          {sidebarOpen && <span>Dashboard</span>}
        </NavLink>

        {/* Leads */}
        <SidebarGroup
          icon={Users}
          label="Leads"
          basePath="/leads"
          subItems={leadsSubItems}
          sidebarOpen={sidebarOpen}
        />

        {/* Follow up */}
        <SidebarGroup
          icon={PhoneCall}
          label="Follow up"
          basePath="/followup"
          subItems={followUpSubItems}
          sidebarOpen={sidebarOpen}
        />

        {/* Loan */}
        <SidebarGroup
          icon={CreditCard}
          label="Loan"
          basePath="/loan"
          subItems={loanSubItems}
          sidebarOpen={sidebarOpen}
        />

        {/* Properties */}
        <SidebarGroup
          icon={Home}
          label="Properties"
          basePath="/properties"
          subItems={propertiesSubItems}
          sidebarOpen={sidebarOpen}
        />

        {/* All Broker */}
        <SidebarGroup
          icon={Briefcase}
          label="All Broker"
          basePath="/brokers"
          subItems={brokerSubItems}
          sidebarOpen={sidebarOpen}
        />

        {/* Human Resources */}
        <SidebarGroup
          icon={UserCog}
          label="Human Resources"
          basePath="/hr"
          subItems={hrSubItems}
          sidebarOpen={sidebarOpen}
        />

        {/* Attendance Report */}
        <SidebarGroup
          icon={CalendarClock}
          label="Attendance Report"
          basePath="/attendance"
          subItems={attendanceSubItems}
          sidebarOpen={sidebarOpen}
        />

        {/* Users */}
        <SidebarGroup
          icon={Users}
          label="Users"
          basePath="/users"
          subItems={usersSubItems}
          sidebarOpen={sidebarOpen}
        />

        {/* Dynamic Fields */}
        <SidebarGroup
          icon={Settings2}
          label="Dynamic Fields"
          basePath="/dynamic-fields"
          subItems={dynamicFieldsSubItems}
          sidebarOpen={sidebarOpen}
        />

        {/* All Projects */}
        <NavLink
          to="/projects"
          className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
          title="All Projects"
        >
          <FolderKanban size={20} />
          {sidebarOpen && <span>All Projects</span>}
        </NavLink>

        {/* PaySlip */}
        <NavLink
          to="/payslip"
          className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
          title="PaySlip"
        >
          <Receipt size={20} />
          {sidebarOpen && <span>PaySlip</span>}
        </NavLink>

        {/* API Integration */}
        <NavLink
          to="/api-integration"
          className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
          title="API Integration"
        >
          <Link2 size={20} />
          {sidebarOpen && <span>API Integration</span>}
        </NavLink>

        {/* Change Password */}
        <NavLink
          to="/change-password"
          className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
          title="Change Password"
        >
          <KeyRound size={20} />
          {sidebarOpen && <span>Change Password</span>}
        </NavLink>

      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        <div className="sidebar__user">
          <div className="sidebar__user-avatar">
            <Building2 size={16} />
          </div>
          {sidebarOpen && (
            <div className="sidebar__user-info">
              <p className="sidebar__user-name">Fortune DXB</p>
              <p className="sidebar__user-role">Admin</p>
            </div>
          )}
        </div>
      </div>

    </aside>
  );
};

export default Sidebar;
