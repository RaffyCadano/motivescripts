import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { AuthRedirectHandler } from "@/auth/AuthRedirectHandler";
import { GuestOnly, RequireAuth } from "@/auth/guards";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Layout } from "@/components/Layout";
import { routerBasename } from "@/lib/appUrl";
import { AboutPage } from "@/pages/About";
import { AdminOverview } from "@/pages/admin/AdminOverview";
import { AdminPlaceholder } from "@/pages/admin/AdminPlaceholder";
import { AuthCallbackPage } from "@/pages/AuthCallback";
import { CaseStudyPage } from "@/pages/CaseStudy";
import { ContactPage } from "@/pages/Contact";
import { ForgotPasswordPage } from "@/pages/ForgotPassword";
import { HomePage } from "@/pages/Home";
import { LoginPage } from "@/pages/Login";
import { NotFoundPage } from "@/pages/NotFound";
import { ProcessPage } from "@/pages/Process";
import { ServicesPage } from "@/pages/Services";
import { WorkPage } from "@/pages/Work";

const adminPlaceholderPaths = [
  "leads",
  "clients",
  "projects",
  "tasks",
  "files",
  "proposals",
  "contracts",
  "invoices",
  "payments",
  "messages",
  "notifications",
  "team",
  "activity",
  "settings",
] as const;

export default function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <AuthProvider>
        <AuthRedirectHandler />
        <Routes>
          <Route path="auth/callback" element={<AuthCallbackPage />} />
          <Route
            path="admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminOverview />} />
            {adminPlaceholderPaths.map((path) => (
              <Route key={path} path={path} element={<AdminPlaceholder />} />
            ))}
          </Route>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="work" element={<WorkPage />} />
            <Route path="work/:slug" element={<CaseStudyPage />} />
            <Route path="process" element={<ProcessPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="start-a-project" element={<ContactPage />} />
            <Route
              path="login"
              element={
                <GuestOnly>
                  <LoginPage />
                </GuestOnly>
              }
            />
            <Route
              path="forgot-password"
              element={
                <GuestOnly>
                  <ForgotPasswordPage />
                </GuestOnly>
              }
            />
            <Route path="contact" element={<Navigate to="/start-a-project" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
