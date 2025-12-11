import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './state/useAuth'
import { api } from './utils/api'
import { ToastContainer, showToast } from './utils/toast'
import { useTheme } from './state/ThemeProvider'

type NotificationItem = {
  id: number
  shoutout: {
    created_by: { full_name: string }
    content: string
  }
  is_read: boolean
  created_at: string
}

type AdminNotification = {
  id: number
  event_type: string
  message: string
  created_at: string
  actor: { full_name: string }
  shoutout_id?: number | null
  report_id?: number | null
}

const ADMIN_EVENT_LABELS: Record<string, string> = {
  report_submitted: 'Report submitted',
  shoutout_deleted: 'Shout-out deleted',
  comment_deleted: 'Comment deleted',
}

function resolveAvatarUrl(url?: string | null) {
  if (!url) return null
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) {
    return url
  }
  const base = (api.defaults.baseURL || '').replace(/\/$/, '')
  if (!base) return url
  if (url.startsWith('/')) {
    return `${base}${url}`
  }
  return `${base}/${url}`
}

export default function App() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuth()
  const { mode, setMode, resolvedTheme } = useTheme()

  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])
  const [profileDepartmentId, setProfileDepartmentId] = useState<number | ''>(user?.department?.id ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatar_url ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null)
  const [avatarUploadMessage, setAvatarUploadMessage] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [unreadNotificationCount, setUnreadNotificationCount] = useState<number>(0)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([])
  const [loadingAdminNotifications, setLoadingAdminNotifications] = useState(false)

  useEffect(() => {
    if (!user) return
    api.get('/departments/public').then(r => setDepartments(r.data)).catch(() => { })
  }, [user])

  useEffect(() => {
    if (!user) return
    const loadNotificationCount = () => {
      api.get('/notifications/count')
        .then(r => setUnreadNotificationCount(r.data.unread_count))
        .catch(() => { })
    }
    loadNotificationCount()
    const interval = setInterval(loadNotificationCount, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!user || !notificationsOpen) return
    setLoadingNotifications(true)
    api.get('/notifications?unread_only=false')
      .then(r => setNotifications(r.data))
      .catch(() => setNotifications([]))
      .finally(() => setLoadingNotifications(false))
  }, [user, notificationsOpen])

  useEffect(() => {
    if (!user?.is_admin || !notificationsOpen) return
    setLoadingAdminNotifications(true)
    api.get('/admin/notifications', { params: { limit: 25 } })
      .then(res => setAdminNotifications(res.data))
      .catch(() => setAdminNotifications([]))
      .finally(() => setLoadingAdminNotifications(false))
  }, [user?.is_admin, notificationsOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (notificationsOpen && !target.closest('.notification-dropdown')) {
        setNotificationsOpen(false)
      }
    }
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [notificationsOpen])

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await api.post(`/notifications/${notificationId}/read`)
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n))
      setUnreadNotificationCount(prev => Math.max(0, prev - 1))
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || 'Failed to mark notification as read'
      showToast(errorMsg, 'error')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadNotificationCount(0)
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || 'Failed to mark all notifications as read'
      showToast(errorMsg, 'error')
    }
  }

  useEffect(() => {
    setProfileDepartmentId(user?.department?.id ?? '')
    setAvatarUrl(user?.avatar_url ?? '')
  }, [user?.department?.id, user?.avatar_url])

  useEffect(() => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
    setPasswordMessage(null)
    setAvatarUploadError(null)
    setAvatarUploadMessage(null)
  }, [user?.id])


  async function handleProfileSave(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSavingProfile(true)
    setProfileError(null)
    setProfileMessage(null)
    try {
      const { data } = await api.patch('/users/me', {
        department_id: profileDepartmentId === '' ? null : profileDepartmentId,
        avatar_url: avatarUrl || null,
      })
      setUser(data)
      setProfileMessage('Profile updated.')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setProfileError(typeof detail === 'string' ? detail : 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    if (!user) return
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploadError(null)
    setAvatarUploadMessage(null)
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUser(data)
      setAvatarUrl(data.avatar_url ?? '')
      setAvatarUploadMessage('Profile photo updated.')
      e.target.value = ''
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setAvatarUploadError(typeof detail === 'string' ? detail : 'Failed to upload photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.')
      setPasswordMessage(null)
      return
    }
    setPasswordError(null)
    setPasswordMessage(null)
    setChangingPassword(true)
    try {
      await api.post('/users/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPasswordMessage('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setPasswordError(typeof detail === 'string' ? detail : 'Failed to update password.')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleLogoutClick = () => {
    logout()
    navigate('/')
  }
  const location = useLocation()
  const isLandingPage = location.pathname === '/' && !user

  return (
    <div className="min-h-full flex flex-col">
      <ToastContainer />
      {!isLandingPage && (
        <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
                BB
              </span>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                BragBoard
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {user && <Link to="/" className="font-medium text-slate-600 hover:text-indigo-600 transition-colors">Feed</Link>}
              {user?.is_admin && <Link to="/admin" className="font-medium text-slate-600 hover:text-indigo-600 transition-colors">Dashboard</Link>}
              {!user && <Link to="/login" className="font-medium text-slate-600 hover:text-indigo-600 transition-colors">Login</Link>}
              {!user && <Link to="/register" className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">Register</Link>}
              {user && (
                <div className="relative notification-dropdown">
                  <button
                    type="button"
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    className="relative p-2 rounded-full hover:bg-gray-100 transition"
                    aria-label="Notifications"
                  >
                    🔔
                    {unreadNotificationCount > 0 && (
                      <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                      </span>
                    )}
                  </button>
                  {notificationsOpen && (
                    <div className="absolute right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col notification-dropdown">
                      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-800">Notifications</h3>
                        <div className="flex gap-2">
                          {unreadNotificationCount > 0 && (
                            <button
                              type="button"
                              onClick={handleMarkAllAsRead}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Mark all read
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setNotificationsOpen(false)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                        <div>
                          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            Shout-out activity
                          </p>
                          {loadingNotifications ? (
                            <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
                          ) : notifications.length === 0 ? (
                            <div className="p-4 text-center text-gray-400 text-sm">No notifications</div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {notifications.map(notif => (
                                <div
                                  key={notif.id}
                                  className={`p-3 hover:bg-gray-50 cursor-pointer ${!notif.is_read ? 'bg-blue-50' : ''}`}
                                  onClick={() => {
                                    if (!notif.is_read) {
                                      handleMarkAsRead(notif.id)
                                    }
                                    setNotificationsOpen(false)
                                    window.location.href = '/'
                                  }}
                                >
                                  <div className="flex items-start gap-2">
                                    {!notif.is_read && (
                                      <span className="h-2 w-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-gray-800">
                                        <span className="font-semibold">{notif.shoutout.created_by.full_name}</span> tagged you in a shout-out
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1 truncate">{notif.shoutout.content}</p>
                                      <p className="text-xs text-gray-400 mt-1">
                                        {new Date(notif.created_at).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {user?.is_admin && (
                          <div>
                            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 flex items-center justify-between">
                              <span>Moderation alerts</span>
                              {!loadingAdminNotifications && (
                                <span className="text-[10px] text-gray-400">{adminNotifications.length}</span>
                              )}
                            </p>
                            {loadingAdminNotifications ? (
                              <div className="p-4 text-center text-gray-400 text-sm">Loading moderation updates...</div>
                            ) : adminNotifications.length === 0 ? (
                              <div className="p-4 text-center text-gray-400 text-sm">
                                No recent admin notifications
                              </div>
                            ) : (
                              <div className="divide-y divide-gray-100">
                                {adminNotifications.map(note => (
                                  <button
                                    key={note.id}
                                    type="button"
                                    onClick={() => {
                                      setNotificationsOpen(false)
                                      navigate('/admin')
                                    }}
                                    className="w-full text-left p-3 hover:bg-gray-50"
                                  >
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                      <span className="font-semibold text-gray-700">{note.actor.full_name}</span>
                                      <span>{new Date(note.created_at).toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 mt-1">
                                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                        {ADMIN_EVENT_LABELS[note.event_type] || note.event_type}
                                      </span>
                                      {note.report_id && <span>Report #{note.report_id}</span>}
                                      {note.shoutout_id && <span>Shout-Out #{note.shoutout_id}</span>}
                                    </div>
                                    <p className="text-sm text-gray-800 mt-1">{note.message}</p>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {user && (
                <div className="flex items-center gap-3">
                  <Link
                    to="/profile"
                    className="hidden sm:flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    {resolveAvatarUrl(user.avatar_url) ? (
                      <img
                        src={resolveAvatarUrl(user.avatar_url) ?? undefined}
                        alt={user.full_name}
                        className="h-8 w-8 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <span className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200 flex items-center justify-center text-xs font-bold">
                        {user.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                      </span>
                    )}
                    <div className="flex flex-col items-end">
                      <span className="font-semibold text-slate-900 text-sm">{user.full_name}</span>
                    </div>
                  </Link>
                  {/* Mobile profile link */}
                  <Link
                    to="/profile"
                    className="sm:hidden"
                  >
                    {resolveAvatarUrl(user.avatar_url) ? (
                      <img
                        src={resolveAvatarUrl(user.avatar_url) ?? undefined}
                        alt={user.full_name}
                        className="h-8 w-8 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <span className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 border border-indigo-200 flex items-center justify-center text-xs font-bold">
                        {user.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')}
                      </span>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </nav>
          </div>
        </header>
      )}
      <main className={`flex-1 ${!isLandingPage ? 'pt-16' : ''}`}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
