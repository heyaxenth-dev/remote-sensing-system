import { BrowserRouter as Router, Routes, Route } from "react-router";
import GuestOnly from "./components/auth/GuestOnly";
import NotFound from "./pages/OtherPage/NotFound";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import LocationAnalytics from "./pages/app/LocationAnalytics";
import DataVerification from "./pages/app/DataVerification";
import KpiDashboard from "./pages/app/KpiDashboard";
import UserManagement from "./pages/app/UserManagement";
import AppSettings from "./pages/app/AppSettings";
import SignIn from "./pages/AuthPages/SignIn";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route element={<AppLayout />}>
            <Route index path="/" element={<LocationAnalytics />} />
            <Route path="/verification" element={<DataVerification />} />
            <Route path="/kpi" element={<KpiDashboard />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/settings" element={<AppSettings />} />
          </Route>

          <Route element={<GuestOnly />}>
            <Route path="/signin" element={<SignIn />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
