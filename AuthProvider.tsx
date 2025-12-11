import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../utils/api'

export type User = {
  id: number
  email: string
  full_name: string
  is_admin: boolean
  avatar_url?: string | null
  department?: { id: number; name: string } | null
}

type AuthContextType = {
  user: User | null
  setUser: (u: User | null) => void
  refreshUser: () => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => { },
  refreshUser: async () => { },
  logout: () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const access = localStorage.getItem('access_token')
    if (!access) {
      setUser(null)
      return
    }
    try {
      const { data } = await api.get('/users/me')
      setUser(data)
    } catch (error) {
      setUser(null)
      logout()
    }
  }, [logout])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const value = useMemo(() => ({ user, setUser, refreshUser, logout }), [user, refreshUser, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
