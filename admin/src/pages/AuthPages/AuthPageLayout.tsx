import React from "react";
import GridShape from "../../components/common/GridShape";
import { Link } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-1 bg-white p-6 dark:bg-gray-900 sm:p-0">
      <div className="relative flex min-h-screen w-full flex-col justify-center dark:bg-gray-900 sm:p-0 lg:h-screen lg:flex-row lg:overflow-hidden">
        <div className="flex w-full flex-col bg-white dark:bg-gray-900 lg:w-1/2 lg:min-h-0 lg:overflow-y-auto">
          {children}
        </div>
        <div className="relative hidden h-full w-full items-center bg-emerald-800 bg-gradient-to-br from-emerald-700 to-emerald-900 dark:from-emerald-950 dark:to-emerald-950 lg:grid lg:w-1/2">
          <div className="relative z-1 flex items-center justify-center">
            {/* <!-- ===== Common Grid Shape Start ===== --> */}
            <GridShape />
            <div className="flex max-w-xs flex-col items-center">
              <Link to="/" className="mb-4 block">
                <img
                  className="mx-auto object-contain"
                  width={160}
                  height={160}
                  src="/images/logo/app-logo.png"
                  alt="Remote sensing system"
                />
              </Link>
              <p className="text-center text-sm text-emerald-100/90 dark:text-emerald-200/85">
                Remote sensing monitoring — admin access
              </p>
            </div>
          </div>
        </div>
        <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
