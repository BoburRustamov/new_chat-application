import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Loader2, Save, User, Mail, AtSign, Bell, Moon, Globe, Lock, LogOut } from 'lucide-react';
import { useAuthStore } from '@/entities/user/model/authStore';
import { Button } from '@/shared/ui';
import { apiClient } from '@/shared/api/client';
import type { FileInfo } from '@/shared/types';

interface ProfileFormData {
  displayName: string;
  bio: string;
  email: string;
}

interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
}

interface PrivacySettings {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  showReadReceipts: boolean;
}

export function ProfileSettingsPage() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'privacy' | 'appearance'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form state
  const [profileData, setProfileData] = useState<ProfileFormData>({
    displayName: user?.displayName || '',
    bio: '',
    email: user?.email || '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [pendingAvatar, setPendingAvatar] = useState<FileInfo | null>(null);

  // Notification settings
  const [notifications, setNotifications] = useState<NotificationSettings>({
    pushEnabled: true,
    emailEnabled: false,
    soundEnabled: true,
  });

  // Privacy settings
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    showOnlineStatus: true,
    showLastSeen: true,
    showReadReceipts: true,
  });

  // Theme settings
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    // Upload
    setIsLoading(true);
    try {
      const response = await apiClient.uploadFile<FileInfo>('/files/upload', file);
      setPendingAvatar(response.data);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      setError('Failed to upload avatar');
      setAvatarPreview(user?.avatarUrl || null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.put('/users/profile', {
        displayName: profileData.displayName,
        bio: profileData.bio,
        avatarFileId: pendingAvatar?.id,
      });

      // Update local state
      if (updateProfile) {
        updateProfile({
          displayName: profileData.displayName,
          avatarUrl: pendingAvatar?.downloadUrl || user?.avatarUrl,
        });
      }

      setSuccess('Profile updated successfully');
      setPendingAvatar(null);
    } catch (err) {
      console.error('Failed to update profile:', err);
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.put('/users/settings/notifications', notifications);
      setSuccess('Notification settings saved');
    } catch (err) {
      console.error('Failed to save notification settings:', err);
      setError('Failed to save notification settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.put('/users/settings/privacy', privacy);
      setSuccess('Privacy settings saved');
    } catch (err) {
      console.error('Failed to save privacy settings:', err);
      setError('Failed to save privacy settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Lock },
    { id: 'appearance', label: 'Appearance', icon: Moon },
  ] as const;

  return (
    <div className="flex h-screen bg-[hsl(var(--background))]">
      {/* Sidebar */}
      <div className="w-64 border-r border-[hsl(var(--border))] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[hsl(var(--border))]">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-[hsl(var(--primary))] text-white'
                  : 'hover:bg-[hsl(var(--muted))]'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-[hsl(var(--border))]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">
          {/* Status messages */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 text-green-500 text-sm">
              {success}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Profile</h2>

              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center overflow-hidden">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl font-medium text-white">
                        {profileData.displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
                <div>
                  <p className="font-medium">{user?.displayName}</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">@{user?.username}</p>
                </div>
              </div>

              {/* Form fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Display Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="text"
                      value={profileData.displayName}
                      onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-transparent focus:border-[hsl(var(--ring))] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Username</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="text"
                      value={user?.username || ''}
                      disabled
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Username cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-transparent focus:border-[hsl(var(--ring))] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Bio</label>
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    rows={3}
                    placeholder="Tell something about yourself..."
                    className="w-full px-4 py-2 rounded-lg bg-[hsl(var(--secondary))] border border-transparent focus:border-[hsl(var(--ring))] outline-none resize-none"
                  />
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Notifications</h2>

              <div className="space-y-4">
                <SettingToggle
                  label="Push Notifications"
                  description="Receive push notifications for new messages"
                  checked={notifications.pushEnabled}
                  onChange={(checked) => setNotifications({ ...notifications, pushEnabled: checked })}
                />

                <SettingToggle
                  label="Email Notifications"
                  description="Receive email notifications for important updates"
                  checked={notifications.emailEnabled}
                  onChange={(checked) => setNotifications({ ...notifications, emailEnabled: checked })}
                />

                <SettingToggle
                  label="Sound"
                  description="Play sound for new messages"
                  checked={notifications.soundEnabled}
                  onChange={(checked) => setNotifications({ ...notifications, soundEnabled: checked })}
                />
              </div>

              <Button onClick={handleSaveNotifications} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Privacy</h2>

              <div className="space-y-4">
                <SettingToggle
                  label="Show Online Status"
                  description="Let others see when you're online"
                  checked={privacy.showOnlineStatus}
                  onChange={(checked) => setPrivacy({ ...privacy, showOnlineStatus: checked })}
                />

                <SettingToggle
                  label="Show Last Seen"
                  description="Let others see when you were last active"
                  checked={privacy.showLastSeen}
                  onChange={(checked) => setPrivacy({ ...privacy, showLastSeen: checked })}
                />

                <SettingToggle
                  label="Read Receipts"
                  description="Let others see when you've read their messages"
                  checked={privacy.showReadReceipts}
                  onChange={(checked) => setPrivacy({ ...privacy, showReadReceipts: checked })}
                />
              </div>

              <Button onClick={handleSavePrivacy} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-semibold">Appearance</h2>

              <div>
                <label className="block text-sm font-medium mb-3">Theme</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['light', 'dark', 'system'] as const).map((themeOption) => (
                    <button
                      key={themeOption}
                      onClick={() => setTheme(themeOption)}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        theme === themeOption
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10'
                          : 'border-[hsl(var(--border))] hover:border-[hsl(var(--muted-foreground))]'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {themeOption === 'light' && <Moon className="h-6 w-6 rotate-180" />}
                        {themeOption === 'dark' && <Moon className="h-6 w-6" />}
                        {themeOption === 'system' && <Globe className="h-6 w-6" />}
                        <span className="text-sm font-medium capitalize">{themeOption}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Toggle component for settings
function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))]">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'left-7' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}
