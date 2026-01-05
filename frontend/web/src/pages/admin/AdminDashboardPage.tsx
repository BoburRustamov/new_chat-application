import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, MessageSquare, LogOut, RefreshCw, Trash2, Search, AlertTriangle } from 'lucide-react';
import { useAdminStore } from '@/entities/admin/model/adminStore';
import { Button, Input } from '@/shared/ui';
import type { User, PagedResponse } from '@/shared/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface AdminStats {
  totalUsers: number;
  onlineUsers: number;
  totalChats: number;
  totalMessages: number;
}

export function AdminDashboardPage() {
  const { adminUsername, logout } = useAdminStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchUsers = async (page: number = 1, search: string = '') => {
    setIsLoadingUsers(true);
    try {
      const token = localStorage.getItem('adminToken');
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '10',
      });
      if (search) {
        params.append('search', search);
      }
      const response = await fetch(`${API_BASE_URL}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data: PagedResponse<User> = await response.json();
        setUsers(data.items);
        setTotalUsers(data.totalCount);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    setDeletingUserId(userId);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        setUsers(users.filter((u) => u.id !== userId));
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleDeleteAllUsers = async () => {
    if (deleteConfirmText !== 'DELETE ALL') {
      return;
    }

    setIsDeletingAll(true);
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Successfully deleted ${data.deletedCount} users.`);
        setUsers([]);
        setTotalUsers(0);
        fetchStats();
      }
    } catch (error) {
      console.error('Failed to delete all users:', error);
      alert('Failed to delete all users. Please try again.');
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllModal(false);
      setDeleteConfirmText('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setUsersPage(1);
    fetchUsers(1, searchQuery);
  };

  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchUsers(usersPage, searchQuery);
  }, [usersPage]);

  const totalPages = Math.ceil(totalUsers / 10);

  return (
    <div className="min-h-screen bg-[hsl(var(--secondary))]">
      {/* Header */}
      <header className="bg-[hsl(var(--background))] shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Welcome, {adminUsername}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Users"
            value={stats?.totalUsers ?? '-'}
            icon={<Users className="h-6 w-6" />}
            color="bg-blue-500"
            isLoading={isLoadingStats}
          />
          <StatCard
            title="Online Users"
            value={stats?.onlineUsers ?? '-'}
            icon={<Users className="h-6 w-6" />}
            color="bg-green-500"
            isLoading={isLoadingStats}
          />
          <StatCard
            title="Total Chats"
            value={stats?.totalChats ?? '-'}
            icon={<MessageSquare className="h-6 w-6" />}
            color="bg-purple-500"
            isLoading={isLoadingStats}
          />
          <StatCard
            title="Total Messages"
            value={stats?.totalMessages ?? '-'}
            icon={<MessageSquare className="h-6 w-6" />}
            color="bg-amber-500"
            isLoading={isLoadingStats}
          />
        </div>

        {/* Refresh Button */}
        <div className="mb-4 flex justify-end">
          <Button
            variant="outline"
            onClick={() => {
              fetchStats();
              fetchUsers(usersPage, searchQuery);
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Users Table */}
        <div className="rounded-lg bg-[hsl(var(--background))] shadow">
          <div className="border-b border-[hsl(var(--border))] px-6 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold">Users</h2>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                  />
                  <Button type="submit" variant="outline">
                    <Search className="h-4 w-4" />
                  </Button>
                </form>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteAllModal(true)}
                  disabled={totalUsers === 0}
                  className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete All Users
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[hsl(var(--secondary))]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[hsl(var(--muted-foreground))]">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[hsl(var(--muted-foreground))]">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-[hsl(var(--secondary))]/50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-lg font-medium">
                                {user.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{user.displayName}</div>
                            <div className="text-sm text-[hsl(var(--muted-foreground))]">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">{user.email}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            user.isOnline
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                          }`}
                        >
                          {user.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-[hsl(var(--muted-foreground))]">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={deletingUserId === user.id}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[hsl(var(--border))] px-6 py-4">
              <div className="text-sm text-[hsl(var(--muted-foreground))]">
                Showing {(usersPage - 1) * 10 + 1} to {Math.min(usersPage * 10, totalUsers)} of {totalUsers} users
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                  disabled={usersPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUsersPage((p) => Math.min(totalPages, p + 1))}
                  disabled={usersPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete All Users Confirmation Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-[hsl(var(--background))] p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3 text-red-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Delete All Users</h3>
            </div>
            <p className="mb-4 text-[hsl(var(--muted-foreground))]">
              This action will permanently delete <strong className="text-[hsl(var(--foreground))]">{totalUsers} users</strong> and all their data. This cannot be undone.
            </p>
            <p className="mb-4 text-sm text-[hsl(var(--muted-foreground))]">
              To confirm, type <strong className="text-red-600">DELETE ALL</strong> below:
            </p>
            <Input
              type="text"
              placeholder="Type DELETE ALL to confirm"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="mb-4"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteAllModal(false);
                  setDeleteConfirmText('');
                }}
                disabled={isDeletingAll}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteAllUsers}
                disabled={deleteConfirmText !== 'DELETE ALL' || isDeletingAll}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeletingAll ? 'Deleting...' : 'Delete All Users'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  isLoading: boolean;
}

function StatCard({ title, value, icon, color, isLoading }: StatCardProps) {
  return (
    <div className="rounded-lg bg-[hsl(var(--background))] p-6 shadow">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${color} text-white`}>{icon}</div>
        <div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{title}</p>
          <p className="text-2xl font-bold">
            {isLoading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-[hsl(var(--secondary))]" /> : value}
          </p>
        </div>
      </div>
    </div>
  );
}
