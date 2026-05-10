import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../context/AuthContext";

export default function GuestOnly() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#141414]">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
