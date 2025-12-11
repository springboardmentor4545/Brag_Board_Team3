import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../utils/api'
import { showToast } from '../utils/toast'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Password must have: uppercase, lowercase, number, special char, min 8 chars
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-={}\[\]|;:'",.<>/?]).{8,}$/

export default function Register() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [departmentId, setDepartmentId] = useState<number | ''>('')
  const [adminCode, setAdminCode] = useState('')
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordsMatch = useMemo(() => password === confirmPassword, [password, confirmPassword])
  const emailValid = useMemo(() => EMAIL_REGEX.test(email.trim()), [email])
  const passwordValid = useMemo(() => PASSWORD_REGEX.test(password), [password])
  const canSubmit = useMemo(
    () =>
      fullName.trim() !== '' &&
      emailValid &&
      passwordValid &&
      passwordsMatch &&
      !loading,
    [fullName, emailValid, passwordValid, passwordsMatch, loading]
  )

  useEffect(() => {
    api.get('/departments/public').then(r => setDepartments(r.data))
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!emailValid || !passwordValid || !passwordsMatch) {
      setError('Please fix the highlighted fields before continuing.')
      return
    }
    try {
      setLoading(true)
      await api.post('/auth/register', {
        email: email.trim(),
        full_name: fullName,
        password,
        department_id: departmentId || null,
        admin_code: adminCode.trim() || null,
      })
      showToast('Registration successful! Please login.', 'success')
      navigate('/login')
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || 'Registration failed'
      setError(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 card p-8 sm:p-10 bg-white shadow-2xl border-0">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg mb-4">
            BB
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create your account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Join your teammates on BragBoard
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 border border-red-100">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={onSubmit}>
          <div className="space-y-5">
            <div>
              <label htmlFor="full-name" className="label">
                Full name
              </label>
              <input
                id="full-name"
                name="full-name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="input"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="email-address" className="label">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={`input ${email && !emailValid ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                placeholder="you@company.com"
              />
              {email && !emailValid && (
                <p className="mt-1 text-xs text-red-500">Please enter a valid work email address.</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`input pr-10 ${password && !passwordValid ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Min 8 chars, uppercase, lowercase, number, special char.
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="label">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={`input pr-10 ${confirmPassword && !passwordsMatch ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <div>
              <label htmlFor="department" className="label">
                Department
              </label>
              <select
                id="department"
                name="department"
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                className="input"
              >
                <option value="">Select department</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="admin-code" className="label flex items-center justify-between">
                <span>Admin invite code</span>
                <span className="text-xs text-slate-400 font-normal">Optional</span>
              </label>
              <input
                id="admin-code"
                name="admin-code"
                type="text"
                value={adminCode}
                onChange={e => setAdminCode(e.target.value)}
                className="input"
                placeholder="Enter code if you have one"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md transition-all duration-200 ${!canSubmit ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg transform hover:-translate-y-0.5'}`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">
                Already have an account?
              </span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
