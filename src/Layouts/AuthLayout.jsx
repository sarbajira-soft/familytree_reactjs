import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';

const AuthLayout = () => {
  const location = useLocation();
  
  // Determine which page we're on for the alt text
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('register')) return 'Register';
    if (path.includes('forgot-password')) return 'Forgot password';
    if (path.includes('reset-password')) return 'Reset password';
    if (path.includes('verify-otp')) return 'Verify OTP';
    if (path.includes('account-recovery')) return 'Account recovery';
    return 'Login';
  };

  return (
    <div className="w-full h-screen overflow-hidden flex ">
      {/* Left Side - Fixed Image (Desktop only) */}
      <div className="hidden lg:flex lg:w-[55%] lg:h-full lg:fixed lg:left-0 lg:top-0 bg-white dark:bg-slate-900 flex-col justify-center">
        {/* Light mode image */}
        <img
          src="/assets/LoginPageImageLight.png"
          alt={getPageTitle()}
          className="w-full h-full object-contain dark:hidden"
        />
        {/* Dark mode image */}
        <img
          src="/assets/LoginPageImageDark.png"
          alt={getPageTitle()}
          className="w-full h-full object-contain hidden dark:block"
        />
      </div>

      {/* Right Side - Scrollable Form Content */}
      <div className="w-full h-full overflow-y-auto lg:w-[45%] lg:ml-[55%] bg-white dark:bg-slate-950 flex items-start justify-center px-4 py-8 no-scrollbar ">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
