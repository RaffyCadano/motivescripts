import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { AuthRedirectHandler } from "@/auth/AuthRedirectHandler";
import { GuestOnly, RequireAdmin, RequireClient } from "@/auth/guards";
import { RequireFullPortal } from "@/components/client/RequireFullPortal";
import { Layout } from "@/components/Layout";
import { RouteFallback } from "@/components/RouteFallback";
import { RouteRobots } from "@/components/RouteRobots";
import { routerBasename } from "@/lib/appUrl";
import { AboutPage } from "@/pages/About";
import { AuthCallbackPage } from "@/pages/AuthCallback";
import { ContactPage } from "@/pages/Contact";
import { HomePage } from "@/pages/Home";
import { LoginPage } from "@/pages/Login";
import { NotFoundPage } from "@/pages/NotFound";
import { PricingPage } from "@/pages/Pricing";
import { PrivacyPage } from "@/pages/Privacy";
import { ProcessPage } from "@/pages/Process";
import { ServicesPage } from "@/pages/Services";
import { TermsPage } from "@/pages/Terms";

// The signed-in areas (admin, team, client), their layouts, and the heavy data providers load only when someone
// opens them, so a visitor to the public site does not download any of that code.
const StaffInviteAcceptPage = lazy(() => import("@/pages/StaffInviteAccept").then((m) => ({ default: m.StaffInviteAcceptPage })));
const InviteAcceptPage = lazy(() => import("@/pages/InviteAccept").then((m) => ({ default: m.InviteAcceptPage })));
const PortalProviders = lazy(() => import("@/components/PortalProviders").then((m) => ({ default: m.PortalProviders })));
const AdminLayout = lazy(() => import("@/components/admin/AdminLayout").then((m) => ({ default: m.AdminLayout })));
const RequireAdminPermission = lazy(() => import("@/components/admin/RequireAdminPermission").then((m) => ({ default: m.RequireAdminPermission })));
const TeamLayout = lazy(() => import("@/components/team/TeamLayout").then((m) => ({ default: m.TeamLayout })));
const RequireDeveloperRoute = lazy(() => import("@/components/team/RequireDeveloperRoute").then((m) => ({ default: m.RequireDeveloperRoute })));
const LeadsOutlet = lazy(() => import("@/components/admin/leads/LeadsOutlet").then((m) => ({ default: m.LeadsOutlet })));
const ClientLayout = lazy(() => import("@/components/client/ClientLayout").then((m) => ({ default: m.ClientLayout })));
const AdminActivity = lazy(() => import("@/pages/admin/AdminActivity").then((m) => ({ default: m.AdminActivity })));
const AdminCapacity = lazy(() => import("@/pages/admin/AdminCapacity").then((m) => ({ default: m.AdminCapacity })));
const AdminCareRequests = lazy(() => import("@/pages/admin/AdminCareRequests").then((m) => ({ default: m.AdminCareRequests })));
const AdminWebsiteMonitoring = lazy(() =>
  import("@/pages/admin/AdminWebsiteMonitoring").then((m) => ({ default: m.AdminWebsiteMonitoring })),
);
const AdminMaintenancePlanTemplates = lazy(() =>
  import("@/pages/admin/AdminMaintenancePlanTemplates").then((m) => ({ default: m.AdminMaintenancePlanTemplates })),
);
const AdminRecurringRevenue = lazy(() =>
  import("@/pages/admin/AdminRecurringRevenue").then((m) => ({ default: m.AdminRecurringRevenue })),
);
const AdminPayroll = lazy(() => import("@/pages/admin/AdminPayroll").then((m) => ({ default: m.AdminPayroll })));
const AdminClientDetails = lazy(() => import("@/pages/admin/AdminClientDetails").then((m) => ({ default: m.AdminClientDetails })));
const AdminClientNew = lazy(() => import("@/pages/admin/AdminClientNew").then((m) => ({ default: m.AdminClientNew })));
const AdminClients = lazy(() => import("@/pages/admin/AdminClients").then((m) => ({ default: m.AdminClients })));
const AdminContractDetails = lazy(() => import("@/pages/admin/AdminContractDetails").then((m) => ({ default: m.AdminContractDetails })));
const AdminContractNew = lazy(() => import("@/pages/admin/AdminContractNew").then((m) => ({ default: m.AdminContractNew })));
const AdminContracts = lazy(() => import("@/pages/admin/AdminContracts").then((m) => ({ default: m.AdminContracts })));
const AdminFiles = lazy(() => import("@/pages/admin/AdminFiles").then((m) => ({ default: m.AdminFiles })));
const AdminLeadDetails = lazy(() => import("@/pages/admin/AdminLeadDetails").then((m) => ({ default: m.AdminLeadDetails })));
const AdminLeadNew = lazy(() => import("@/pages/admin/AdminLeadNew").then((m) => ({ default: m.AdminLeadNew })));
const AdminLeads = lazy(() => import("@/pages/admin/AdminLeads").then((m) => ({ default: m.AdminLeads })));
const AdminMessages = lazy(() => import("@/pages/admin/AdminMessages").then((m) => ({ default: m.AdminMessages })));
const AdminMyTasks = lazy(() => import("@/pages/admin/AdminMyTasks").then((m) => ({ default: m.AdminMyTasks })));
const AdminHome = lazy(() => import("@/pages/admin/AdminHome").then((m) => ({ default: m.AdminHome })));
const AdminProfile = lazy(() => import("@/pages/admin/AdminProfile").then((m) => ({ default: m.AdminProfile })));
const AdminPlaceholder = lazy(() => import("@/pages/admin/AdminPlaceholder").then((m) => ({ default: m.AdminPlaceholder })));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings").then((m) => ({ default: m.AdminSettings })));
const AdminProjectDetails = lazy(() => import("@/pages/admin/AdminProjectDetails").then((m) => ({ default: m.AdminProjectDetails })));
const AdminProjectEdit = lazy(() => import("@/pages/admin/AdminProjectEdit").then((m) => ({ default: m.AdminProjectEdit })));
const AdminProjectNew = lazy(() => import("@/pages/admin/AdminProjectNew").then((m) => ({ default: m.AdminProjectNew })));
const AdminProjects = lazy(() => import("@/pages/admin/AdminProjects").then((m) => ({ default: m.AdminProjects })));
const AdminProposalDetails = lazy(() => import("@/pages/admin/AdminProposalDetails").then((m) => ({ default: m.AdminProposalDetails })));
const AdminProposalNew = lazy(() => import("@/pages/admin/AdminProposalNew").then((m) => ({ default: m.AdminProposalNew })));
const AdminProposals = lazy(() => import("@/pages/admin/AdminProposals").then((m) => ({ default: m.AdminProposals })));
const AdminInvoiceDetails = lazy(() => import("@/pages/admin/AdminInvoiceDetails").then((m) => ({ default: m.AdminInvoiceDetails })));
const AdminInvoiceNew = lazy(() => import("@/pages/admin/AdminInvoiceNew").then((m) => ({ default: m.AdminInvoiceNew })));
const AdminInvoices = lazy(() => import("@/pages/admin/AdminInvoices").then((m) => ({ default: m.AdminInvoices })));
const AdminReports = lazy(() => import("@/pages/admin/AdminReports").then((m) => ({ default: m.AdminReports })));
const AdminTestimonials = lazy(() => import("@/pages/admin/AdminTestimonials").then((m) => ({ default: m.AdminTestimonials })));
const AdminTestimonialForm = lazy(() => import("@/pages/admin/AdminTestimonialForm").then((m) => ({ default: m.AdminTestimonialForm })));
const AdminTeam = lazy(() => import("@/pages/admin/AdminTeam").then((m) => ({ default: m.AdminTeam })));
const AdminTeamDetails = lazy(() => import("@/pages/admin/AdminTeamDetails").then((m) => ({ default: m.AdminTeamDetails })));
const AdminTeamInviteDetails = lazy(() => import("@/pages/admin/AdminTeamInviteDetails").then((m) => ({ default: m.AdminTeamInviteDetails })));
const AdminTeamInviteNew = lazy(() => import("@/pages/admin/AdminTeamInviteNew").then((m) => ({ default: m.AdminTeamInviteNew })));
const ClientApprovals = lazy(() => import("@/pages/client/ClientApprovals").then((m) => ({ default: m.ClientApprovals })));
const ClientContractDetails = lazy(() => import("@/pages/client/ClientContractDetails").then((m) => ({ default: m.ClientContractDetails })));
const ClientContracts = lazy(() => import("@/pages/client/ClientContracts").then((m) => ({ default: m.ClientContracts })));
const ClientFeedback = lazy(() => import("@/pages/client/ClientFeedback").then((m) => ({ default: m.ClientFeedback })));
const ClientFilesPage = lazy(() => import("@/pages/client/ClientFilesPage").then((m) => ({ default: m.ClientFilesPage })));
const ClientMessages = lazy(() => import("@/pages/client/ClientMessages").then((m) => ({ default: m.ClientMessages })));
const ClientOverview = lazy(() => import("@/pages/client/ClientOverview").then((m) => ({ default: m.ClientOverview })));
const ClientProject = lazy(() => import("@/pages/client/ClientProject").then((m) => ({ default: m.ClientProject })));
const ClientDiscovery = lazy(() => import("@/pages/client/ClientDiscovery").then((m) => ({ default: m.ClientDiscovery })));
const ClientTaskRequests = lazy(() => import("@/pages/client/ClientTaskRequests").then((m) => ({ default: m.ClientTaskRequests })));
const ClientScope = lazy(() => import("@/pages/client/ClientScope").then((m) => ({ default: m.ClientScope })));
const ClientProposalDetails = lazy(() => import("@/pages/client/ClientProposalDetails").then((m) => ({ default: m.ClientProposalDetails })));
const ClientProposals = lazy(() => import("@/pages/client/ClientProposals").then((m) => ({ default: m.ClientProposals })));
const ClientInvoiceDetails = lazy(() => import("@/pages/client/ClientInvoiceDetails").then((m) => ({ default: m.ClientInvoiceDetails })));
const ClientInvoices = lazy(() => import("@/pages/client/ClientInvoices").then((m) => ({ default: m.ClientInvoices })));
const ClientPaymentCancelled = lazy(() => import("@/pages/client/ClientPaymentCancelled").then((m) => ({ default: m.ClientPaymentCancelled })));
const ClientPaymentSuccess = lazy(() => import("@/pages/client/ClientPaymentSuccess").then((m) => ({ default: m.ClientPaymentSuccess })));
const ClientReview = lazy(() => import("@/pages/client/ClientReview").then((m) => ({ default: m.ClientReview })));
const ClientSettings = lazy(() => import("@/pages/client/ClientSettings").then((m) => ({ default: m.ClientSettings })));
const ClientPlans = lazy(() => import("@/pages/client/ClientPlans").then((m) => ({ default: m.ClientPlans })));
const TeamBlocked = lazy(() => import("@/pages/team/TeamBlocked").then((m) => ({ default: m.TeamBlocked })));
const TeamDashboardHome = lazy(() => import("@/pages/team/TeamDashboardHome").then((m) => ({ default: m.TeamDashboardHome })));
const TeamDeploymentDetail = lazy(() => import("@/pages/team/TeamDeploymentDetail").then((m) => ({ default: m.TeamDeploymentDetail })));
const TeamDeployments = lazy(() => import("@/pages/team/TeamDeployments").then((m) => ({ default: m.TeamDeployments })));
const TeamFiles = lazy(() => import("@/pages/team/TeamFiles").then((m) => ({ default: m.TeamFiles })));
const TeamMessages = lazy(() => import("@/pages/team/TeamMessages").then((m) => ({ default: m.TeamMessages })));
const TeamNeedsChanges = lazy(() => import("@/pages/team/TeamNeedsChanges").then((m) => ({ default: m.TeamNeedsChanges })));
const TeamProfile = lazy(() => import("@/pages/team/TeamProfile").then((m) => ({ default: m.TeamProfile })));
const TeamProjects = lazy(() => import("@/pages/team/TeamProjects").then((m) => ({ default: m.TeamProjects })));
const TeamProjectDetails = lazy(() => import("@/pages/team/TeamProjectDetails").then((m) => ({ default: m.TeamProjectDetails })));
const TeamQaReview = lazy(() => import("@/pages/team/TeamQaReview").then((m) => ({ default: m.TeamQaReview })));
const TeamTasks = lazy(() => import("@/pages/team/TeamTasks").then((m) => ({ default: m.TeamTasks })));
const TeamTime = lazy(() => import("@/pages/team/TeamTime").then((m) => ({ default: m.TeamTime })));

// Lazy: CaseStudy/Work pull in SitePreview.tsx, a ~2000-line module with
// per-project mockup markup and ~30 images for all 10 case studies. Every
// other route (Services, Pricing, About, all of /admin, /team, /client)
// never renders any of it, so it doesn't belong in the eagerly-loaded main
// bundle. WorkSection (rendered inline on the homepage) is lazy for the same
// reason -- see sections/WorkSection.tsx's own usage.
const CaseStudyPage = lazy(() => import("@/pages/CaseStudy").then((m) => ({ default: m.CaseStudyPage })));
const WorkPage = lazy(() => import("@/pages/Work").then((m) => ({ default: m.WorkPage })));

const adminUnavailablePaths = ["notifications"] as const;

export default function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <RouteRobots />
      <AuthProvider>
        <AuthRedirectHandler />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route element={<PortalProviders />}>
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route element={<RequireAdminPermission />}>
              <Route element={<LeadsOutlet />}>
                <Route index element={<AdminHome />} />
                <Route path="my-tasks" element={<AdminMyTasks />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="leads/new" element={<AdminLeadNew />} />
                <Route path="leads/:id" element={<AdminLeadDetails />} />
                <Route path="clients" element={<AdminClients />} />
                <Route path="clients/new" element={<AdminClientNew />} />
                <Route path="clients/:id" element={<AdminClientDetails />} />
                <Route path="projects" element={<AdminProjects />} />
                <Route path="projects/new" element={<AdminProjectNew />} />
                <Route path="projects/:id/edit" element={<AdminProjectEdit />} />
                <Route path="projects/:id" element={<AdminProjectDetails />} />
                <Route path="capacity" element={<AdminCapacity />} />
                <Route path="care-requests" element={<AdminCareRequests />} />
                <Route path="website-monitoring" element={<AdminWebsiteMonitoring />} />
                <Route path="files" element={<AdminFiles />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="messages/:conversationId" element={<AdminMessages />} />
                <Route path="proposals" element={<AdminProposals />} />
                <Route path="proposals/new" element={<AdminProposalNew />} />
                <Route path="proposals/:id" element={<AdminProposalDetails />} />
                <Route path="contracts" element={<AdminContracts />} />
                <Route path="contracts/new" element={<AdminContractNew />} />
                <Route path="contracts/:id" element={<AdminContractDetails />} />
                <Route path="invoices" element={<AdminInvoices />} />
                <Route path="invoices/new" element={<AdminInvoiceNew />} />
                <Route path="invoices/:id" element={<AdminInvoiceDetails />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="recurring-revenue" element={<AdminRecurringRevenue />} />
                <Route path="maintenance-plans" element={<AdminMaintenancePlanTemplates />} />
                <Route path="testimonials" element={<AdminTestimonials />} />
                <Route path="testimonials/new" element={<AdminTestimonialForm />} />
                <Route path="testimonials/:id" element={<AdminTestimonialForm />} />
                <Route path="payroll" element={<AdminPayroll />} />
                <Route path="team" element={<AdminTeam />} />
                <Route path="team/new" element={<AdminTeamInviteNew />} />
                <Route path="team/invite/:invitationId" element={<AdminTeamInviteDetails />} />
                <Route path="team/:id" element={<AdminTeamDetails />} />
                <Route path="activity" element={<AdminActivity />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="profile" element={<AdminProfile />} />
                <Route path="payments" element={<Navigate to="/admin/invoices" replace />} />
                {adminUnavailablePaths.map((path) => (
                  <Route key={path} path={path} element={<AdminPlaceholder />} />
                ))}
              </Route>
            </Route>
          </Route>
          <Route
            path="team"
            element={
              <RequireAdmin>
                <TeamLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<Navigate to="/team/dashboard" replace />} />
            <Route path="dashboard" element={<TeamDashboardHome />} />
            <Route path="tasks" element={<TeamTasks />} />
            <Route path="projects" element={<TeamProjects />} />
            <Route path="projects/:id" element={<TeamProjectDetails />} />
            <Route element={<RequireDeveloperRoute />}>
              <Route path="qa-review" element={<TeamQaReview />} />
              <Route path="needs-changes" element={<TeamNeedsChanges />} />
              <Route path="blocked" element={<TeamBlocked />} />
              <Route path="deployments" element={<TeamDeployments />} />
              <Route path="deployments/:id" element={<TeamDeploymentDetail />} />
            </Route>
            <Route path="messages" element={<TeamMessages />} />
            <Route path="messages/:conversationId" element={<TeamMessages />} />
            <Route path="files" element={<TeamFiles />} />
            <Route path="time" element={<TeamTime />} />
            <Route path="profile" element={<TeamProfile />} />
          </Route>
          <Route
            path="client"
            element={
              <RequireClient>
                <ClientLayout />
              </RequireClient>
            }
          >
            <Route index element={<ClientOverview />} />
            <Route path="scope" element={<ClientScope />} />
            <Route path="project" element={<ClientProject />} />
            <Route path="project/:projectId" element={<ClientProject />} />
            <Route path="project/:projectId/discovery" element={<ClientDiscovery />} />
            <Route path="project/:projectId/requests" element={<ClientTaskRequests />} />
            <Route path="files" element={<RequireFullPortal><ClientFilesPage /></RequireFullPortal>} />
            <Route path="files/:deliverableId" element={<ClientReview />} />
            <Route path="feedback" element={<ClientFeedback />} />
            <Route path="approvals" element={<ClientApprovals />} />
            <Route path="support" element={<Navigate to="/client/messages" replace />} />
            <Route path="messages" element={<ClientMessages />} />
            <Route path="messages/:conversationId" element={<ClientMessages />} />
            <Route path="proposals" element={<ClientProposals />} />
            <Route path="proposals/:id" element={<ClientProposalDetails />} />
            <Route path="contracts" element={<ClientContracts />} />
            <Route path="contracts/:id" element={<ClientContractDetails />} />
            <Route path="invoices" element={<ClientInvoices />} />
            <Route path="invoices/:id/payment-success" element={<ClientPaymentSuccess />} />
            <Route path="invoices/:id/payment-cancelled" element={<ClientPaymentCancelled />} />
            <Route path="invoices/:id" element={<ClientInvoiceDetails />} />
            <Route path="billing" element={<Navigate to="/client/invoices" replace />} />
            <Route path="settings" element={<ClientSettings />} />
            <Route path="plans" element={<ClientPlans />} />
          </Route>
          </Route>
          <Route element={<Layout />}>
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route index element={<HomePage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="work" element={<WorkPage />} />
            <Route path="work/:slug" element={<CaseStudyPage />} />
            <Route path="process" element={<ProcessPage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="start-a-project" element={<ContactPage />} />
            <Route path="invite/:token" element={<InviteAcceptPage />} />
            <Route path="staff-invite/:token" element={<StaffInviteAcceptPage />} />
            <Route
              path="login"
              element={
                <GuestOnly>
                  <LoginPage />
                </GuestOnly>
              }
            />
            <Route path="contact" element={<Navigate to="/start-a-project" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
