import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { queryClient } from "./utils/queryClient";

import { UserProvider } from "./Contexts/UserContext";
import { LanguageProvider } from "./Contexts/LanguageContext";
import { FamilyTreeProvider } from "./Contexts/FamilyTreeContext";
import { ThemeProvider } from "./Contexts/ThemeContext";
import { NetworkProvider, useNetwork } from "./Contexts/NetworkContext";
import OfflineUI from "./Components/OfflineUI";

import PrivateRoute from "./Routes/PrivateRoute";
import GuestRoute from "./Routes/GuestRoute";
import Layout from "./Components/Layout";
import AppUrlListener from "./Components/AppUrlListener";
import AuthLayout from "./Layouts/AuthLayout";

// ✅ Lazy load all pages for code splitting
const Login = lazy(() => import("./Pages/Login"));
const Register = lazy(() => import("./Pages/Register"));
const ForgotPassword = lazy(() => import("./Pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./Pages/ResetPassword"));
const VerifyOtp = lazy(() => import("./Pages/VerifyOtp"));
const AccountRecoveryPage = lazy(() => import("./Pages/AccountRecoveryPage"));
const TermsAndConditions = lazy(() => import("./Pages/TermsAndConditions"));
const PrivacyPolicy = lazy(() => import("./Pages/PrivacyPolicy"));
const LegalUpdate = lazy(() => import("./Pages/LegalUpdate"));
const PublicLegalPage = lazy(() => import("./Pages/PublicLegalPage"));
const OnBoarding = lazy(() => import("./Pages/OnBoarding"));
const Dashboard = lazy(() => import("./Pages/Dashboard"));
const MyProfile = lazy(() => import("./Pages/MyProfile"));
const MyFamilyMember = lazy(() => import("./Pages/MyFamilyMember"));
const MyFamily = lazy(() => import("./Pages/MyFamily"));
const FamilyTreePage = lazy(() => import("./Pages/FamilyTreePage"));
const CreateAndRequestPage = lazy(() => import("./Pages/createAndRequest/CreateAndRequestPage"));
const FamilyTreeHierarchical = lazy(() =>
  import("./Pages/FamilyTreeHierarchical")
);
const PendingFamilyRequests = lazy(() =>
  import("./Pages/PendingFamilyRequests")
);

const FamilyGalleryPage = lazy(() => import("./Pages/FamilyGalleryPage"));
const EventsPage = lazy(() => import("./Pages/EventsPage"));
const SuggestionApproving = lazy(() => import("./Pages/SuggestionApproving"));
const FamilyManagementMobile = lazy(() => import("./Pages/FamilyManagementMobile"));
const AssociatedFamilyTreePage = lazy(() =>
  import("./Pages/AssociatedFamilyTreePage")
);
const LinkedFamilyTreesPage = lazy(() =>
  import("./Pages/LinkedFamilyTreesPage")
);
const ProfileModule = lazy(() => import("./Pages/ProfileFormPage"));
const UserProfile = lazy(() => import("./Pages/UserProfile"));
const EditProfilePage = lazy(() => import("./Pages/EditProfilePage"));
const BlockedMembersPage = lazy(() => import("./Pages/BlockedMembersPage"));
const ChatPage = lazy(() => import("./Pages/ChatPage"));
const ChatWindowPage = lazy(() => import("./Pages/ChatWindowPage"));
const PublicSharedPostPage = lazy(() => import("./Pages/PublicSharedPostPage"));
const SharedPostScreen = lazy(() => import("./Pages/SharedPostScreen"));
const PublicSharedGalleryPage = lazy(() => import("./Pages/PublicSharedGalleryPage"));
const SharedGalleryScreen = lazy(() => import("./Pages/SharedGalleryScreen"));
const TutorialsPage = lazy(() => import("./Pages/TutorialsPage"));
const TutorialDetailPage = lazy(() => import("./Pages/TutorialDetailPage"));
const AIAssistantPage = lazy(() => import("./Pages/AIAssistantPage"));

// ---------------- Loading Fallback ----------------
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
      <p className="text-gray-600 dark:text-gray-300 text-lg">Loading...</p>
    </div>
  </div>
);

// Network-aware app content component
const AppContent = () => {
  const { isOffline, isReady } = useNetwork();

  // Show loading fallback while network status initializes
  if (!isReady) {
    return <LoadingFallback />;
  }

  // Show offline UI when there's no internet connection
  if (isOffline) {
    return <OfflineUI />;
  }

  return null; // Return null to render the normal app routes
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* BLOCK OVERRIDE: Global toast container for block/unblock success and error feedback. */}
      <ToastContainer
        position="top-center"
        autoClose={2500}
        newestOnTop
        className="w-full px-4 sm:px-0 sm:w-auto"
        toastClassName="rounded-xl shadow-xl font-medium text-sm"
        bodyClassName="px-4 py-3"
      />
      <ThemeProvider>
        <NetworkProvider>
          <UserProvider>
            <Router>
              <AppContent />
              <AppUrlListener />
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
              <Route path="/p/:shareId" element={<PublicSharedPostPage />} />
              <Route path="/g/:shareId" element={<PublicSharedGalleryPage />} />
              <Route path="/shared-post/:shareId" element={<SharedPostScreen />} />
              <Route path="/shared-gallery/:shareId" element={<SharedGalleryScreen />} />
              <Route path="/terms-and-privacy" element={<PublicLegalPage />} />
              {/* ---------------- Guest-only Auth Routes (Persistent Layout) ---------------- */}
              <Route
                element={
                  <GuestRoute>
                    <AuthLayout />
                  </GuestRoute>
                }
              >
                <Route path="/" element={<Login />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-otp" element={<VerifyOtp />} />
                <Route path="/account-recovery" element={<AccountRecoveryPage />} />
              </Route>

              {/* ---------------- Guest-only Routes without Auth Layout ---------------- */}
              <Route
                path="/edit-profile"
                element={
                  <GuestRoute>
                    <ProfileModule />
                  </GuestRoute>
                }
              />
               {/* ---------------- Onboarding (Authenticated) ---------------- */}
              <Route
                path="/onboarding"
                element={
                  <PrivateRoute>
                    <OnBoarding />
                  </PrivateRoute>
                }
              />
              <Route
                path="/on-boarding"
                element={<Navigate to="/onboarding" replace />}
              />

              <Route
                path="/terms"
                element={
                  <PrivateRoute>
                    <TermsAndConditions />
                  </PrivateRoute>
                }
              />

              <Route
                path="/privacy-policy"
                element={
                  <PrivateRoute>
                    <PrivacyPolicy />
                  </PrivateRoute>
                }
              />

              <Route
                path="/legal-update"
                element={
                  <PrivateRoute>
                    <LegalUpdate />
                  </PrivateRoute>
                }
              />

              {/* ---------------- Authenticated Routes (Persistent Layout) ---------------- */}
              <Route
                element={
                  <PrivateRoute>
                    <LanguageProvider>
                      <Layout />
                    </LanguageProvider>
                  </PrivateRoute>
                }
              >
                {/* Dashboard & Profile */}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/app/shared-post/:shareId" element={<SharedPostScreen />} />
                <Route path="/app/shared-gallery/:shareId" element={<SharedGalleryScreen />} />
                <Route path="/myprofile" element={<MyProfile />} />
                <Route path="/profile/edit" element={<EditProfilePage />} />
                <Route path="/user/:userId" element={<UserProfile />} />

                {/* Family & Members */}
                <Route path="/my-family" element={<MyFamily />} />
                <Route path="/my-family-member" element={<MyFamilyMember />} />
                {/* BLOCK OVERRIDE: Dedicated route for active blocked users list. */}
                <Route path="/blocked-members" element={<BlockedMembersPage />} />
                <Route path="/family-management" element={<FamilyManagementMobile />} />

                {/* Family Trees */}
                <Route path="/family-tree" element={<FamilyTreePage />} />
                <Route path="/family-tree/:code" element={<FamilyTreePage />} />
                <Route path="/family-tree/create-and-request" element={<CreateAndRequestPage />} />
                <Route
                  path="/family-tree-hierarchical"
                  element={<FamilyTreeHierarchical />}
                />
                <Route
                  path="/family-tree-hierarchical/:code"
                  element={<FamilyTreeHierarchical />}
                />
                <Route
                  path="/associated-family-tree/:code"
                  element={
                    <FamilyTreeProvider>
                      <AssociatedFamilyTreePage />
                    </FamilyTreeProvider>
                  }
                />
                <Route
                  path="/associated-family-tree-user/:userId"
                  element={
                    <FamilyTreeProvider>
                      <AssociatedFamilyTreePage />
                    </FamilyTreeProvider>
                  }
                />
                <Route
                  path="/linked-family-trees"
                  element={<LinkedFamilyTreesPage />}
                />

                {/* Requests, Posts, Events, Gifts */}
                <Route
                  path="/pending-request"
                  element={<PendingFamilyRequests />}
                />
                <Route
                  path="/pending-approvals"
                  element={<PendingFamilyRequests />}
                />
                {/* <Route
                  path="/posts-and-feeds"
                  element={<PostsAndFeedsPage />}
                /> */}
                <Route path="/family-gallery" element={<FamilyGalleryPage />} />
                <Route path="/events" element={<EventsPage />} />
                {/* Chat Feature Routes */}
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/chat/:conversationId" element={<ChatWindowPage />} />
                <Route path="/ai-assistant" element={<AIAssistantPage />} />
                <Route path="/upcoming-events" element={<EventsPage />} />
                <Route
                  path="/suggestion-approving"
                  element={<SuggestionApproving />}
                />
                <Route path="/tutorials" element={<TutorialsPage />} />
                <Route path="/tutorials/:id" element={<TutorialDetailPage />} />

              </Route>

              {/* ---------------- Catch-all Redirect ---------------- */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              </Suspense>
            </Router>
          </UserProvider>
        </NetworkProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
