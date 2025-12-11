import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../state/useAuth'
import { api } from '../utils/api'
import { showToast } from '../utils/toast'

interface Department {
  id: number
  name: string
}

interface User {
  id: number
  email: string
  full_name: string
  avatar_url: string | null
  department: Department | null
  is_admin: boolean
}

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Department[]>([])
  const [profileDepartmentId, setProfileDepartmentId] = useState<number | ''>('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [avatarUploadMessage, setAvatarUploadMessage] = useState('')
  const [avatarUploadError, setAvatarUploadError] = useState('')

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    setProfileDepartmentId(user.department?.id || '')
    loadDepartments()
  }, [user, navigate])

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get('/departments')
      setDepartments(res.data)
    } catch (err: any) {
      console.error('Failed to load departments:', err)
    }
  }, [])

  const resolveAvatarUrl = (url: string | null | undefined): string | null => {
    if (!url) return null
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url
    const base = (api.defaults.baseURL || '').replace(/\/$/, '')
    if (!base) return url
    if (url.startsWith('/')) {
      return `${base}${url}`
    }
    return `${base}/${url}`
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMessage('')
    setProfileError('')
    setSavingProfile(true)

    try {
      const updateData: any = {}
      if (profileDepartmentId !== (user?.department?.id || '')) {
        updateData.department_id = profileDepartmentId || null
      }

      if (Object.keys(updateData).length === 0) {
        setProfileMessage('No changes to save')
        setSavingProfile(false)
        return
      }

      await api.patch('/users/me', updateData)
      setProfileMessage('Profile updated successfully!')
      await refreshUser()
      setTimeout(() => setProfileMessage(''), 3000)
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to update profile'
      setProfileError(msg)
      showToast(msg, 'error')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage('')
    setPasswordError('')

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (!currentPassword) {
      setPasswordError('Please enter your current password')
      return
    }

    setChangingPassword(true)

    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPasswordMessage('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordMessage(''), 3000)
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to change password'
      setPasswordError(msg)
      showToast(msg, 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setAvatarUploadError('File size must be less than 5MB')
      return
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setAvatarUploadError('Invalid file type. Please use JPG, PNG, GIF, or WebP.')
      return
    }

    setUploadingAvatar(true)
    setAvatarUploadError('')
    setAvatarUploadMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAvatarUploadMessage('Avatar uploaded successfully!')
      await refreshUser()
      setTimeout(() => setAvatarUploadMessage(''), 3000)
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to upload avatar'
      setAvatarUploadError(msg)
      showToast(msg, 'error')
    } finally {
      setUploadingAvatar(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!user) {
    return null
  }

  const displayAvatar = resolveAvatarUrl(user.avatar_url)
  const initials = user.full_name.split(' ').map(p => p[0]).slice(0, 2).join('')

  return (
    <div className="max-w-4xl mx-auto py-8 flex flex-col gap-8">
      {/* Header Card */}
      <div className="card p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-xl">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="relative group">
            <div className="h-32 w-32 rounded-full p-1 bg-white/10 backdrop-blur-sm ring-4 ring-white/20">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={user.full_name}
                  className="h-full w-full rounded-full object-cover bg-slate-800"
                />
              ) : (
                <div className="h-full w-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white shadow-inner">
                  {initials}
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full cursor-pointer shadow-lg transition-transform hover:scale-105 active:scale-95">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
            {uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full backdrop-blur-sm">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-blue-200 border border-white/10 mb-2">
              {user.is_admin ? 'Administrator' : 'Team Member'}
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{user.full_name}</h1>
            <p className="text-slate-300 text-lg">{user.email}</p>
            <div className="flex items-center justify-center md:justify-start gap-4 mt-4 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                {user.department?.name || 'No Department'}
              </span>
            </div>
          </div>
        </div>

        {(avatarUploadMessage || avatarUploadError) && (
          <div className={`mt-6 p-3 rounded-lg text-sm text-center font-medium ${avatarUploadError ? 'bg-red-500/10 text-red-200 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/20'
            }`}>
            {avatarUploadError || avatarUploadMessage}
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Profile Settings */}
        <div className="card p-6 h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Profile Settings</h2>
              <p className="text-sm text-slate-500">Update your personal information</p>
            </div>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Department
              </label>
              <div className="relative">
                <select
                  value={profileDepartmentId === '' ? '' : String(profileDepartmentId)}
                  onChange={e => setProfileDepartmentId(e.target.value ? Number(e.target.value) : '')}
                  className="input appearance-none"
                >
                  <option value="">Select your department</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary w-full justify-center"
              >
                {savingProfile ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving Changes...
                  </>
                ) : 'Save Changes'}
              </button>
            </div>

            {profileMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-100 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                {profileMessage}
              </div>
            )}
            {profileError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {profileError}
              </div>
            )}
          </form>
        </div>

        {/* Security Settings */}
        <div className="card p-6 h-full">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Security</h2>
              <p className="text-sm text-slate-500">Manage your password and access</p>
            </div>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="btn-secondary w-full justify-center"
              >
                {changingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>

            {passwordMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-100 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                {passwordMessage}
              </div>
            )}
            {passwordError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {passwordError}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card p-6 border-l-4 border-l-red-500">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Sign Out</h3>
            <p className="text-sm text-slate-500">End your current session securely.</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-6 py-2.5 rounded-lg border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}
