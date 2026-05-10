import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import ResetPassword from "./pages/AuthPages/ResetPassword";
import NotFound from "./pages/OtherPage/NotFound";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import LocationAnalytics from "./pages/app/LocationAnalytics";
import DataVerification from "./pages/app/DataVerification";
import KpiDashboard from "./pages/app/KpiDashboard";
import UserManagement from "./pages/app/UserManagement";
import AppSettings from "./pages/app/AppSettings";
import RequireAuth from "./components/auth/RequireAuth";
import GuestOnly from "./components/auth/GuestOnly";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index path="/" element={<LocationAnalytics />} />
              <Route path="/verification" element={<DataVerification />} />
              <Route path="/kpi" element={<KpiDashboard />} />
              <Route path="/users" element={<UserManagement />} />
              <Route path="/settings" element={<AppSettings />} />
            </Route>
          </Route>

          <Route element={<GuestOnly />}>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
          </Route>

          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
