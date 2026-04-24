// Mock Data for Real Estate CRM

export const mockLeads = [
  { id: 1, name: 'Rajesh Sharma', phone: '+91 98765 43210', email: 'rajesh.sharma@email.com', source: 'Website', status: 'New', budget: '₹1.5 Cr - ₹2 Cr', property_type: 'Apartment', location: 'Palm Jumeirah', assigned_to: 'Amit Patel', priority: 'Hot', lead_type: 'fresh', created_at: '2026-02-10', last_followup: '2026-02-10', next_followup: '2026-02-12', notes: 'Looking for 3BHK sea-facing apartment', project: 'Azure Residences' },
  { id: 2, name: 'Sarah Johnson', phone: '+971 50 123 4567', email: 'sarah.j@email.com', source: '99acres', status: 'Contacted', budget: '₹3 Cr - ₹5 Cr', property_type: 'Villa', location: 'Dubai Marina', assigned_to: 'Priya Singh', priority: 'Hot', lead_type: 'imported', created_at: '2026-02-09', last_followup: '2026-02-10', next_followup: '2026-02-11', notes: 'Wants villa with private pool', project: 'Marina Heights' },
  { id: 3, name: 'Mohammed Al Rashid', phone: '+971 55 987 6543', email: 'mo.rashid@email.com', source: 'Referral', status: 'Site Visit', budget: '₹5 Cr+', property_type: 'Penthouse', location: 'Downtown Dubai', assigned_to: 'Amit Patel', priority: 'Warm', lead_type: 'fresh', created_at: '2026-02-08', last_followup: '2026-02-09', next_followup: '2026-02-13', notes: 'Looking for investment property', project: 'Burj Crown' },
  { id: 4, name: 'Priya Mehta', phone: '+91 87654 32109', email: 'priya.m@email.com', source: 'Housing.com', status: 'Negotiation', budget: '₹80 L - ₹1 Cr', property_type: 'Apartment', location: 'JVC', assigned_to: 'Ravi Kumar', priority: 'Hot', lead_type: 'imported', created_at: '2026-02-07', last_followup: '2026-02-10', next_followup: '2026-02-11', notes: 'Ready to close, needs financing help', project: 'JVC Gardens' },
  { id: 5, name: 'Ahmad Khan', phone: '+971 52 345 6789', email: 'ahmad.k@email.com', source: 'Walk-in', status: 'New', budget: '₹2 Cr - ₹3 Cr', property_type: 'Townhouse', location: 'Arabian Ranches', assigned_to: null, priority: 'Cold', lead_type: 'fresh', created_at: '2026-02-10', last_followup: null, next_followup: '2026-02-12', notes: 'Family of 5, needs 4BHK+', project: 'Ranches Villas' },
  { id: 6, name: 'Lisa Williams', phone: '+1 555 234 5678', email: 'lisa.w@email.com', source: 'Facebook', status: 'Contacted', budget: '₹1 Cr - ₹1.5 Cr', property_type: 'Apartment', location: 'Business Bay', assigned_to: 'Priya Singh', priority: 'Warm', lead_type: 'reset', created_at: '2026-02-06', last_followup: '2026-02-08', next_followup: '2026-02-12', notes: 'NRI investor, first-time buyer in Dubai', project: 'Bay Central' },
  { id: 7, name: 'Vikram Reddy', phone: '+91 76543 21098', email: 'vikram.r@email.com', source: 'Instagram', status: 'Follow Up', budget: '₹50 L - ₹80 L', property_type: 'Studio', location: 'JLT', assigned_to: 'Ravi Kumar', priority: 'Warm', lead_type: 'fresh', created_at: '2026-02-05', last_followup: '2026-02-09', next_followup: '2026-02-11', notes: 'Young professional, wants furnished', project: 'JLT Cluster O' },
  { id: 8, name: 'Fatima Hassan', phone: '+971 56 789 0123', email: 'fatima.h@email.com', source: 'Google Ads', status: 'Won', budget: '₹2 Cr - ₹3 Cr', property_type: 'Villa', location: 'DAMAC Hills', assigned_to: 'Amit Patel', priority: 'Hot', lead_type: 'fresh', created_at: '2026-01-20', last_followup: '2026-02-08', next_followup: null, notes: 'Deal closed! 4BHK villa at DAMAC Hills', project: 'DAMAC Hills 2' },
  { id: 9, name: 'David Chen', phone: '+852 9876 5432', email: 'david.c@email.com', source: 'LinkedIn', status: 'Lost', budget: '₹10 Cr+', property_type: 'Penthouse', location: 'Palm Jumeirah', assigned_to: 'Priya Singh', priority: 'Cold', lead_type: 'imported', created_at: '2026-01-15', last_followup: '2026-02-05', next_followup: null, notes: 'Lost to competitor, wanted immediate possession', project: 'One Palm' },
  { id: 10, name: 'Anita Desai', phone: '+91 65432 10987', email: 'anita.d@email.com', source: 'Website', status: 'Site Visit', budget: '₹1 Cr - ₹1.5 Cr', property_type: 'Apartment', location: 'Creek Harbour', assigned_to: 'Ravi Kumar', priority: 'Warm', lead_type: 'reset', created_at: '2026-02-04', last_followup: '2026-02-10', next_followup: '2026-02-14', notes: 'Scheduled visit for Creek Harbour project', project: 'Creek Rise' },
  { id: 11, name: 'Omar Siddiqui', phone: '+971 58 456 7890', email: 'omar.s@email.com', source: 'Referral', status: 'New', budget: '₹3 Cr - ₹5 Cr', property_type: 'Villa', location: 'Emirates Hills', assigned_to: null, priority: 'Hot', lead_type: 'fresh', created_at: '2026-02-11', last_followup: null, next_followup: '2026-02-12', notes: 'Referred by Fatima Hassan, high budget client', project: 'Emirates Hills' },
  { id: 12, name: 'Neha Kapoor', phone: '+91 54321 09876', email: 'neha.k@email.com', source: '99acres', status: 'Follow Up', budget: '₹70 L - ₹1 Cr', property_type: 'Apartment', location: 'Sports City', assigned_to: 'Amit Patel', priority: 'Cold', lead_type: 'imported', created_at: '2026-02-03', last_followup: '2026-02-07', next_followup: '2026-02-13', notes: 'Budget constraint, exploring options', project: 'Sports City Tower' },
  { id: 13, name: 'Riya Patel', phone: '+91 99887 76655', email: 'riya.p@email.com', source: 'MagicBricks', status: 'New', budget: '₹1 Cr - ₹1.5 Cr', property_type: 'Apartment', location: 'JVC', assigned_to: null, priority: 'Warm', lead_type: 'imported', created_at: '2026-02-11', last_followup: null, next_followup: '2026-02-13', notes: 'Looking for ready-to-move apartment', project: 'JVC Gardens' },
  { id: 14, name: 'Ali Bin Saeed', phone: '+971 54 222 3333', email: 'ali.bs@email.com', source: 'Google Ads', status: 'New', budget: '₹2 Cr - ₹3 Cr', property_type: 'Townhouse', location: 'DAMAC Hills', assigned_to: null, priority: 'Hot', lead_type: 'fresh', created_at: '2026-02-11', last_followup: null, next_followup: '2026-02-12', notes: 'Wants DAMAC Hills 2 townhouse', project: 'DAMAC Hills 2' },
  { id: 15, name: 'Sanjay Gupta', phone: '+91 88776 55443', email: 'sanjay.g@email.com', source: 'Website', status: 'Contacted', budget: '₹50 L - ₹80 L', property_type: 'Studio', location: 'Business Bay', assigned_to: 'Ravi Kumar', priority: 'Cold', lead_type: 'reset', created_at: '2026-01-28', last_followup: '2026-02-05', next_followup: '2026-02-15', notes: 'Not responding to calls, try WhatsApp', project: 'Bay Central' },
  { id: 16, name: 'Marina Petrova', phone: '+7 916 123 4567', email: 'marina.p@email.com', source: 'Instagram', status: 'Follow Up', budget: '₹5 Cr+', property_type: 'Penthouse', location: 'Palm Jumeirah', assigned_to: 'Sara Ali', priority: 'Hot', lead_type: 'fresh', created_at: '2026-02-09', last_followup: '2026-02-10', next_followup: '2026-02-12', notes: 'Russian investor, high net worth', project: 'One Palm' },
];

export const mockBrokers = [
  { id: 1, name: 'Amit Patel', phone: '+971 50 111 2222', email: 'amit@fortunedxb.com', rera_no: 'BRN-12345', photo: null, status: 'Active', total_deals: 28, active_leads: 4, commission_earned: '₹24.5 L', rating: 4.8, specialization: 'Luxury Apartments', area: 'Palm Jumeirah, Downtown', joined: '2024-06-15' },
  { id: 2, name: 'Priya Singh', phone: '+971 50 333 4444', email: 'priya@fortunedxb.com', rera_no: 'BRN-12346', photo: null, status: 'Active', total_deals: 22, active_leads: 3, commission_earned: '₹18.2 L', rating: 4.6, specialization: 'Villas & Townhouses', area: 'Dubai Marina, JBR', joined: '2024-08-20' },
  { id: 3, name: 'Ravi Kumar', phone: '+971 50 555 6666', email: 'ravi@fortunedxb.com', rera_no: 'BRN-12347', photo: null, status: 'Active', total_deals: 15, active_leads: 3, commission_earned: '₹12.8 L', rating: 4.4, specialization: 'Budget Apartments', area: 'JVC, Sports City, JLT', joined: '2025-01-10' },
  { id: 4, name: 'Sara Ali', phone: '+971 50 777 8888', email: 'sara@fortunedxb.com', rera_no: 'BRN-12348', photo: null, status: 'Active', total_deals: 35, active_leads: 0, commission_earned: '₹32.1 L', rating: 4.9, specialization: 'Off-Plan Properties', area: 'All Dubai', joined: '2023-11-05' },
  { id: 5, name: 'Vikash Sharma', phone: '+971 50 999 0000', email: 'vikash@fortunedxb.com', rera_no: 'BRN-12349', photo: null, status: 'Inactive', total_deals: 8, active_leads: 0, commission_earned: '₹5.4 L', rating: 3.8, specialization: 'Commercial', area: 'Business Bay', joined: '2025-03-15' },
];

export const mockTeamMembers = [
  { id: 1, name: 'Amit Patel', role: 'Senior Agent', team: 'Sales Team A', email: 'amit@fortunedxb.com', phone: '+971 50 111 2222', status: 'Active', performance: 92, target: '₹50 L', achieved: '₹46 L', leads_handled: 45, deals_closed: 28, joined: '2024-06-15' },
  { id: 2, name: 'Priya Singh', role: 'Agent', team: 'Sales Team A', email: 'priya@fortunedxb.com', phone: '+971 50 333 4444', status: 'Active', performance: 85, target: '₹40 L', achieved: '₹34 L', leads_handled: 38, deals_closed: 22, joined: '2024-08-20' },
  { id: 3, name: 'Ravi Kumar', role: 'Junior Agent', team: 'Sales Team B', email: 'ravi@fortunedxb.com', phone: '+971 50 555 6666', status: 'Active', performance: 72, target: '₹25 L', achieved: '₹18 L', leads_handled: 22, deals_closed: 15, joined: '2025-01-10' },
  { id: 4, name: 'Sara Ali', role: 'Team Lead', team: 'Sales Team A', email: 'sara@fortunedxb.com', phone: '+971 50 777 8888', status: 'Active', performance: 96, target: '₹60 L', achieved: '₹57.6 L', leads_handled: 55, deals_closed: 35, joined: '2023-11-05' },
  { id: 5, name: 'Vikash Sharma', role: 'Agent', team: 'Sales Team B', email: 'vikash@fortunedxb.com', phone: '+971 50 999 0000', status: 'On Leave', performance: 58, target: '₹30 L', achieved: '₹17.4 L', leads_handled: 15, deals_closed: 8, joined: '2025-03-15' },
  { id: 6, name: 'Nisha Verma', role: 'Team Lead', team: 'Sales Team B', email: 'nisha@fortunedxb.com', phone: '+971 50 222 3333', status: 'Active', performance: 88, target: '₹55 L', achieved: '₹48.4 L', leads_handled: 48, deals_closed: 30, joined: '2024-02-10' },
];

export const mockAttendance = [
  { id: 1, member_id: 1, name: 'Amit Patel', date: '2026-02-11', check_in: '09:05', check_out: '18:30', status: 'Present', hours: '9h 25m', location: 'Office' },
  { id: 2, member_id: 2, name: 'Priya Singh', date: '2026-02-11', check_in: '08:55', check_out: null, status: 'Present', hours: 'Active', location: 'Field Visit' },
  { id: 3, member_id: 3, name: 'Ravi Kumar', date: '2026-02-11', check_in: '09:30', check_out: null, status: 'Late', hours: 'Active', location: 'Office' },
  { id: 4, member_id: 4, name: 'Sara Ali', date: '2026-02-11', check_in: '08:45', check_out: '18:00', status: 'Present', hours: '9h 15m', location: 'Office' },
  { id: 5, member_id: 5, name: 'Vikash Sharma', date: '2026-02-11', check_in: null, check_out: null, status: 'On Leave', hours: '-', location: '-' },
  { id: 6, member_id: 6, name: 'Nisha Verma', date: '2026-02-11', check_in: '09:00', check_out: null, status: 'Present', hours: 'Active', location: 'Office' },
];

export const mockLeadSources = ['Website', '99acres', 'Housing.com', 'Referral', 'Walk-in', 'Facebook', 'Instagram', 'Google Ads', 'LinkedIn', 'MagicBricks', 'Other'];
export const mockLeadStatuses = ['New', 'Contacted', 'Follow Up', 'Site Visit', 'Negotiation', 'Won', 'Lost'];
export const mockPropertyTypes = ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Studio', 'Plot', 'Commercial', 'Office'];
export const mockLocations = ['Palm Jumeirah', 'Dubai Marina', 'Downtown Dubai', 'JVC', 'Arabian Ranches', 'Business Bay', 'JLT', 'DAMAC Hills', 'Creek Harbour', 'Emirates Hills', 'Sports City', 'MBR City', 'Al Barsha'];
export const mockProjects = ['Azure Residences', 'Marina Heights', 'Burj Crown', 'JVC Gardens', 'Ranches Villas', 'Bay Central', 'JLT Cluster O', 'DAMAC Hills 2', 'One Palm', 'Creek Rise', 'Emirates Hills', 'Sports City Tower'];

export const dashboardStats = {
  total_leads: 156, new_leads_today: 8, active_leads: 89, site_visits_scheduled: 12,
  deals_this_month: 6, revenue_this_month: '₹4.2 Cr', conversion_rate: '18.5%', avg_deal_size: '₹70 L',
};

export const leadPipelineData = [
  { stage: 'New', count: 32, value: '₹48 Cr' }, { stage: 'Contacted', count: 24, value: '₹36 Cr' },
  { stage: 'Follow Up', count: 18, value: '₹27 Cr' }, { stage: 'Site Visit', count: 15, value: '₹22.5 Cr' },
  { stage: 'Negotiation', count: 8, value: '₹12 Cr' }, { stage: 'Won', count: 6, value: '₹4.2 Cr' },
];

export const monthlyLeadsData = [
  { month: 'Sep', leads: 85, deals: 4 }, { month: 'Oct', leads: 102, deals: 5 },
  { month: 'Nov', leads: 95, deals: 3 }, { month: 'Dec', leads: 78, deals: 7 },
  { month: 'Jan', leads: 120, deals: 8 }, { month: 'Feb', leads: 156, deals: 6 },
];

export const sourceDistribution = [
  { source: 'Website', count: 38, percentage: 24 }, { source: '99acres', count: 28, percentage: 18 },
  { source: 'Referral', count: 24, percentage: 15 }, { source: 'Google Ads', count: 22, percentage: 14 },
  { source: 'Facebook', count: 18, percentage: 12 }, { source: 'Walk-in', count: 14, percentage: 9 },
  { source: 'Others', count: 12, percentage: 8 },
];
