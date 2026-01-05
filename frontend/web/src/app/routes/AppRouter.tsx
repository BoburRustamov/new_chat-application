import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthPage } from '@/pages/auth/AuthPage';
import { ChatPage } from '@/pages/chat/ChatPage';
import { ProfileSettingsPage } from '@/pages/settings/ProfileSettingsPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { AdminLoginPage } from '@/pages/admin/AdminLoginPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { ChannelDiscoveryPage, JoinChannelPage } from '@/pages/channels';
import { ProtectedRoute } from './ProtectedRoute';
import { AdminProtectedRoute } from './AdminProtectedRoute';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat/:chatId"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <ProfileSettingsPage />
            </ProtectedRoute>
          }
        />
        {/* Channel Routes */}
        <Route
          path="/channels/discover"
          element={
            <ProtectedRoute>
              <ChannelDiscoveryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/join/:inviteCode"
          element={
            <ProtectedRoute>
              <JoinChannelPage />
            </ProtectedRoute>
          }
        />
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLoginPage />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboardPage />
            </AdminProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
