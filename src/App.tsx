import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/layout/DashboardLayout";
import { StudioProvider } from "./store/StudioStore";
import { PortalProvider } from "./store/PortalStore";
import { AuthProvider } from "./auth/AuthProvider";
import RequireAdmin from "./auth/RequireAdmin";

// Eager: the routes most sessions hit first.
import Dashboard from "./pages/Dashboard";
import ProjectTracker from "./pages/ProjectTracker";
import PortalLayout from "./pages/portal/PortalLayout";
import PortalOverview from "./pages/portal/PortalOverview";
import PortalProgress from "./pages/portal/PortalProgress";
import {
  PortalContracts,
  PortalFiles,
  PortalInvoices,
  PortalQuotes,
} from "./pages/portal/PortalBilling";

// Lazy: heavier or less-frequent admin routes. Overview in particular pulls in
// recharts, so keeping it out of the initial bundle is a real win.
const Projects = lazy(() => import("./pages/Projects"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Clients = lazy(() => import("./pages/Clients"));
const Contracts = lazy(() => import("./pages/Contracts"));
const TimeTracking = lazy(() => import("./pages/TimeTracking"));
const Settings = lazy(() => import("./pages/Settings"));
const Leads = lazy(() => import("./pages/Leads"));
const Quotations = lazy(() => import("./pages/Quotations"));
const Blueprints = lazy(() => import("./pages/Blueprints"));
const Overview = lazy(() => import("./pages/Overview"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Teams = lazy(() => import("./pages/Teams"));
const Files = lazy(() => import("./pages/Files"));
const Emails = lazy(() => import("./pages/Emails"));
const Campaigns = lazy(() => import("./pages/marketing/Campaigns"));
const Newsletters = lazy(() => import("./pages/marketing/Newsletters"));
const Integrations = lazy(() => import("./pages/marketing/Integrations"));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Toaster position="bottom-right" richColors />
          <Routes>
            {/* Client-facing portal — a dashboard in its own right, with the
                phase tracker as one section of it. `/portal/:token` is the
                shareable link, fed by the read-only `portal_snapshot` RPC. */}
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route
              path="/portal"
              element={
                <PortalProvider>
                  <PortalLayout />
                </PortalProvider>
              }
            >
              <Route index element={<PortalOverview />} />
            </Route>
            <Route
              path="/portal/:token"
              element={
                <PortalProvider>
                  <PortalLayout />
                </PortalProvider>
              }
            >
              <Route index element={<PortalOverview />} />
              <Route path="progress" element={<PortalProgress />} />
              <Route path="invoices" element={<PortalInvoices />} />
              <Route path="quotes" element={<PortalQuotes />} />
              <Route path="files" element={<PortalFiles />} />
              <Route path="contracts" element={<PortalContracts />} />
              {/* Unknown portal sub-path → back to the client's overview. */}
              <Route path="*" element={<PortalOverview />} />
            </Route>

            {/* Studio workspace — gated to allow-listed admins, then the
                Supabase-backed store is mounted for the signed-in session. */}
            <Route
              path="/admin/*"
              element={
                <RequireAdmin>
                  <StudioProvider>
                    <DashboardLayout>
                      <Suspense fallback={<RouteFallback />}>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/tracker" element={<ProjectTracker />} />
                          <Route path="/tracker/:projectId" element={<ProjectTracker />} />
                          <Route path="/projects" element={<Projects />} />
                          <Route path="/teams" element={<Teams />} />
                          <Route path="/invoices" element={<Invoices />} />
                          <Route path="/clients" element={<Clients />} />
                          <Route path="/leads" element={<Leads />} />
                          <Route path="/quotations" element={<Quotations />} />
                          <Route path="/contracts" element={<Contracts />} />
                          <Route path="/blueprints" element={<Blueprints />} />
                          <Route path="/timelines" element={<Navigate to="/admin/blueprints" replace />} />
                          <Route path="/time" element={<TimeTracking />} />
                          <Route path="/overview" element={<Overview />} />
                          <Route path="/expenses" element={<Expenses />} />
                          <Route path="/settings" element={<Settings />} />
                          <Route path="/files" element={<Files />} />
                          <Route path="/emails" element={<Emails />} />
                          <Route path="/marketing/campaigns" element={<Campaigns />} />
                          <Route path="/marketing/newsletters" element={<Newsletters />} />
                          <Route path="/marketing/integrations" element={<Integrations />} />
                          <Route path="*" element={<Dashboard />} />
                        </Routes>
                      </Suspense>
                    </DashboardLayout>
                  </StudioProvider>
                </RequireAdmin>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
