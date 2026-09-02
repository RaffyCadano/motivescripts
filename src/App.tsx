import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { AuthRedirectHandler } from "@/auth/AuthRedirectHandler";
import { GuestOnly, RequireAdmin, RequireClient } from "@/auth/guards";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TeamLayout } from "@/components/team/TeamLayout";
import { LeadsOutlet } from "@/components/admin/leads/LeadsOutlet";
import { LeadsProvider } from "@/components/admin/leads/LeadsProvider";
import { ClientLayout } from "@/components/client/ClientLayout";
import { Layout } from "@/components/Layout";
import { routerBasename } from "@/lib/appUrl";
import { AboutPage } from "@/pages/About";
import { AdminClientDetails } from "@/pages/admin/AdminClientDetails";
import { AdminClientNew } from "@/pages/admin/AdminClientNew";
import { AdminClients } from "@/pages/admin/AdminClients";
import { AdminContractDetails } from "@/pages/admin/AdminContractDetails";
import { AdminContractNew } from "@/pages/admin/AdminContractNew";
import { AdminContracts } from "@/pages/admin/AdminContracts";
import { AdminFiles } from "@/pages/admin/AdminFiles";
import { AdminLeadDetails } from "@/pages/admin/AdminLeadDetails";
import { AdminLeadNew } from "@/pages/admin/AdminLeadNew";
import { AdminLeads } from "@/pages/admin/AdminLeads";
import { AdminMessages } from "@/pages/admin/AdminMessages";
import { AdminMyTasks } from "@/pages/admin/AdminMyTasks";
import { AdminHome } from "@/pages/admin/AdminHome";
import { AdminProfile } from "@/pages/admin/AdminProfile";
import { AdminPlaceholder } from "@/pages/admin/AdminPlaceholder";
import { AdminSettings } from "@/pages/admin/AdminSettings";
import { AdminProjectDetails } from "@/pages/admin/AdminProjectDetails";
import { AdminProjectEdit } from "@/pages/admin/AdminProjectEdit";
import { AdminProjectNew } from "@/pages/admin/AdminProjectNew";
import { AdminProjects } from "@/pages/admin/AdminProjects";
import { AdminProposalDetails } from "@/pages/admin/AdminProposalDetails";
import { AdminProposalNew } from "@/pages/admin/AdminProposalNew";
import { AdminProposals } from "@/pages/admin/AdminProposals";
import { AdminInvoiceDetails } from "@/pages/admin/AdminInvoiceDetails";
import { AdminInvoiceNew } from "@/pages/admin/AdminInvoiceNew";
import { AdminInvoices } from "@/pages/admin/AdminInvoices";
import { AdminTeam } from "@/pages/admin/AdminTeam";
import { AdminTeamDetails } from "@/pages/admin/AdminTeamDetails";
import { AdminTeamInviteDetails } from "@/pages/admin/AdminTeamInviteDetails";
import { AdminTeamInviteNew } from "@/pages/admin/AdminTeamInviteNew";
import { AuthCallbackPage } from "@/pages/AuthCallback";
import { ClientApprovals } from "@/pages/client/ClientApprovals";
import { ClientContractDetails } from "@/pages/client/ClientContractDetails";
import { ClientContracts } from "@/pages/client/ClientContracts";
import { ClientFeedback } from "@/pages/client/ClientFeedback";
import { ClientFilesPage } from "@/pages/client/ClientFilesPage";
import { ClientMessages } from "@/pages/client/ClientMessages";
import { ClientOverview } from "@/pages/client/ClientOverview";
import { ClientProject } from "@/pages/client/ClientProject";
import { ClientDiscovery } from "@/pages/client/ClientDiscovery";
import { ClientScope } from "@/pages/client/ClientScope";
import { ClientProposalDetails } from "@/pages/client/ClientProposalDetails";
import { ClientProposals } from "@/pages/client/ClientProposals";
import { ClientInvoiceDetails } from "@/pages/client/ClientInvoiceDetails";
import { ClientInvoices } from "@/pages/client/ClientInvoices";
import { ClientPaymentCancelled } from "@/pages/client/ClientPaymentCancelled";
import { ClientPaymentSuccess } from "@/pages/client/ClientPaymentSuccess";
import { ClientReview } from "@/pages/client/ClientReview";
import { ClientSettings } from "@/pages/client/ClientSettings";
import { CaseStudyPage } from "@/pages/CaseStudy";
import { ContactPage } from "@/pages/Contact";
import { HomePage } from "@/pages/Home";
import { StaffInviteAcceptPage } from "@/pages/StaffInviteAccept";
import { InviteAcceptPage } from "@/pages/InviteAccept";
import { LoginPage } from "@/pages/Login";
import { NotFoundPage } from "@/pages/NotFound";
import { ProcessPage } from "@/pages/Process";
import { ServicesPage } from "@/pages/Services";
import { WorkPage } from "@/pages/Work";
import { TeamDashboard } from "@/pages/team/TeamDashboard";
import { TeamFiles } from "@/pages/team/TeamFiles";
import { TeamMessages } from "@/pages/team/TeamMessages";
import { TeamProfile } from "@/pages/team/TeamProfile";
import { TeamProjects } from "@/pages/team/TeamProjects";
import { TeamProjectDetails } from "@/pages/team/TeamProjectDetails";
import { TeamTasks } from "@/pages/team/TeamTasks";
import { MessagingProvider } from "@/providers/MessagingProvider";

const adminUnavailablePaths = ["notifications", "activity"] as const;

export default function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <AuthProvider>
        <LeadsProvider>
          <MessagingProvider>
          <AuthRedirectHandler />
          <Routes>
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
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
              <Route path="team" element={<AdminTeam />} />
              <Route path="team/new" element={<AdminTeamInviteNew />} />
              <Route path="team/invite/:invitationId" element={<AdminTeamInviteDetails />} />
              <Route path="team/:id" element={<AdminTeamDetails />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route path="payments" element={<Navigate to="/admin/invoices" replace />} />
              {adminUnavailablePaths.map((path) => (
                <Route key={path} path={path} element={<AdminPlaceholder />} />
              ))}
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
            <Route path="dashboard" element={<TeamDashboard />} />
            <Route path="tasks" element={<TeamTasks />} />
            <Route path="projects" element={<TeamProjects />} />
            <Route path="projects/:id" element={<TeamProjectDetails />} />
            <Route path="messages" element={<TeamMessages />} />
            <Route path="messages/:conversationId" element={<TeamMessages />} />
            <Route path="files" element={<TeamFiles />} />
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
            <Route path="files" element={<ClientFilesPage />} />
            <Route path="files/:deliverableId" element={<ClientReview />} />
            <Route path="feedback" element={<ClientFeedback />} />
            <Route path="approvals" element={<ClientApprovals />} />
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
          </Route>
          <Route element={<Layout />}>
            <Route path="auth/callback" element={<AuthCallbackPage />} />
            <Route index element={<HomePage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="work" element={<WorkPage />} />
            <Route path="work/:slug" element={<CaseStudyPage />} />
            <Route path="process" element={<ProcessPage />} />
            <Route path="about" element={<AboutPage />} />
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
          </MessagingProvider>
        </LeadsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
