import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../utils/api'
import { useAuth } from '../state/useAuth'
import { showToast } from '../utils/toast'

type Department = {
  id: number
  name: string
}

type User = {
  id: number
  email: string
  full_name: string
  department?: Department | null
}

type UserStat = {
  user: User
  count: number
}

type ShoutOutSummary = {
  id: number
  content: string
  created_at: string
  created_by: User
}

type Report = {
  id: number
  status: 'open' | 'resolved'
  reason?: string | null
  created_at: string
  resolved_at?: string | null
  reporter: User
  resolved_by?: User | null
  shoutout: ShoutOutSummary
}

type Metrics = {
  top_contributors: UserStat[]
  most_tagged: UserStat[]
}

type LeaderboardEntry = {
  user: User
  shoutouts_sent: number
  shoutouts_received: number
  points: number
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved'>('open')
  const [resolving, setResolving] = useState<Record<number, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'pdf' | null>(null)

  useEffect(() => {
    if (!user?.is_admin) return
    setMetricsLoading(true)
    api.get('/admin/metrics')
      .then(res => setMetrics(res.data))
      .catch(() => setMetrics(null))
      .finally(() => setMetricsLoading(false))
  }, [user])

  useEffect(() => {
    if (!user?.is_admin) return
    setLeaderboardLoading(true)
    api.get('/admin/leaderboard')
      .then(res => setLeaderboard(res.data))
      .catch(() => setLeaderboard([]))
      .finally(() => setLeaderboardLoading(false))
  }, [user])

  useEffect(() => {
    if (!user?.is_admin) return
    loadReports(statusFilter)
  }, [statusFilter, user])

  const loadReports = (status: 'open' | 'resolved') => {
    setReportsLoading(true)
    setError(null)
    api.get('/admin/reports', { params: { status } })
      .then(res => setReports(res.data))
      .catch(() => {
        setReports([])
        setError('Failed to load reports')
      })
      .finally(() => setReportsLoading(false))
  }

  const handleResolve = async (reportId: number) => {
    setResolving(prev => ({ ...prev, [reportId]: true }))
    try {
      await api.post(`/admin/reports/${reportId}/resolve`)
      showToast('Report resolved successfully', 'success')
      loadReports(statusFilter)
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || 'Failed to resolve report'
      showToast(errorMsg, 'error')
    } finally {
      setResolving(prev => ({ ...prev, [reportId]: false }))
    }
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportingFormat(format)
    setError(null)
    try {
      const response = await api.get('/admin/reports/export', {
        params: { format, status: statusFilter },
        responseType: 'blob',
      })
      const blob = new Blob([response.data], {
        type: format === 'csv' ? 'text/csv' : 'application/pdf',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const dateStamp = new Date().toISOString().slice(0, 10)
      link.download = `reports-${statusFilter}-${dateStamp}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      showToast(`Reports exported successfully as ${format}`, 'success')
    } catch (err: any) {
      const errorMsg = err?.response?.data?.detail || 'Failed to export reports'
      setError(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setExportingFormat(null)
    }
  }

  const statusChips = useMemo(() => ([
    { key: 'open' as const, label: 'Open Reports' },
    { key: 'resolved' as const, label: 'Resolved Reports' },
  ]), [])

  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-8 py-6">
      <div className="card p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Admin Dashboard</h1>
            <p className="text-slate-500 mt-1">Overview of team activity and moderation</p>
          </div>
          {metricsLoading ? (
            <span className="text-sm text-slate-400 animate-pulse">Updating metrics...</span>
          ) : (
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-2"
              onClick={() => {
                setMetricsLoading(true)
                api.get('/admin/metrics')
                  .then(res => setMetrics(res.data))
                  .finally(() => setMetricsLoading(false))
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              Refresh Metrics
            </button>
          )}
        </div>

        {metricsLoading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-xl">🏆</span> Top Contributors
              </h2>
              {metrics.top_contributors.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No shout-outs created yet.</p>
              ) : (
                <ul className="space-y-3">
                  {metrics.top_contributors.map((entry, idx) => (
                    <li key={entry.user.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-4">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{entry.user.full_name}</div>
                          <div className="text-xs text-slate-500">{entry.user.email}</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                        {entry.count} sent
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-xl">⭐</span> Most Tagged Teammates
              </h2>
              {metrics.most_tagged.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No shout-out recipients yet.</p>
              ) : (
                <ul className="space-y-3">
                  {metrics.most_tagged.map((entry, idx) => (
                    <li key={entry.user.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-3 shadow-sm border border-slate-200">
                      <div className="flex items-center gap-4">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{entry.user.full_name}</div>
                          <div className="text-xs text-slate-500">{entry.user.email}</div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                        {entry.count} received
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">Metrics unavailable at the moment.</div>
        )}
      </div>

      <div className="card p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">🏅</span> Gamified Leaderboard
            </h2>
            <p className="text-sm text-slate-500 mt-1">Celebrate teammates earning appreciation points.</p>
          </div>
          {leaderboardLoading ? (
            <span className="text-sm text-slate-400 animate-pulse">Calculating standings...</span>
          ) : (
            <button
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-2"
              onClick={() => {
                setLeaderboardLoading(true)
                api.get('/admin/leaderboard')
                  .then(res => setLeaderboard(res.data))
                  .finally(() => setLeaderboardLoading(false))
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              Refresh Leaderboard
            </button>
          )}
        </div>
        {leaderboardLoading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No shout-out activity yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">Rank</th>
                  <th className="px-6 py-4">Teammate</th>
                  <th className="px-6 py-4 text-center">Sent</th>
                  <th className="px-6 py-4 text-center">Received</th>
                  <th className="px-6 py-4 text-right">Total Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {leaderboard.map((entry, idx) => (
                  <tr key={entry.user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-slate-200 text-slate-700' :
                            idx === 2 ? 'bg-orange-100 text-orange-800' :
                              'text-slate-500'
                        }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{entry.user.full_name}</div>
                      <div className="text-xs text-slate-500">{entry.user.department?.name || 'No department'}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-600">{entry.shoutouts_sent}</td>
                    <td className="px-6 py-4 text-center text-slate-600">{entry.shoutouts_received}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-block px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold">
                        {entry.points} pts
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="text-2xl">🚩</span> Reported Shout-Outs
            </h2>
            <p className="text-sm text-slate-500 mt-1">Review and resolve reported content.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {statusChips.map(chip => (
                <button
                  key={chip.key}
                  onClick={() => setStatusFilter(chip.key)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statusFilter === chip.key
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                disabled={exportingFormat === 'csv'}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {exportingFormat === 'csv' ? 'Exporting...' : 'Export CSV'}
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={exportingFormat === 'pdf'}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {exportingFormat === 'pdf' ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
            {error}
          </div>
        )}

        {reportsLoading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No reports in this state.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {reports.map(report => (
              <div key={report.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-3">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${report.status === 'open'
                          ? 'bg-orange-50 text-orange-700 border-orange-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                        {report.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Reported {new Date(report.created_at).toLocaleString()}
                      </span>
                      {report.resolved_at && (
                        <span className="text-xs text-slate-500 font-medium">
                          • Resolved {new Date(report.resolved_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-slate-800 mb-2">
                      <span className="font-bold">{report.reporter.full_name}</span> reported shout-out #{report.shoutout.id}
                    </div>

                    {report.reason && (
                      <div className="mb-4 text-sm bg-red-50 text-red-800 px-3 py-2 rounded-lg border border-red-100 inline-block">
                        <span className="font-bold mr-1">Reason:</span> {report.reason}
                      </div>
                    )}

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 relative">
                      <div className="absolute top-3 right-3 text-xs text-slate-400">
                        {new Date(report.shoutout.created_at).toLocaleString()}
                      </div>
                      <div className="text-xs font-bold text-slate-500 mb-1">
                        Shout-Out from {report.shoutout.created_by.full_name}
                      </div>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {report.shoutout.content}
                      </div>
                    </div>

                    {report.resolved_by && (
                      <div className="mt-3 text-xs font-medium text-slate-500 flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">✓</span>
                        Resolved by {report.resolved_by.full_name}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-row md:flex-col gap-2 min-w-[120px]">
                    {report.status === 'open' && (
                      <button
                        onClick={() => handleResolve(report.id)}
                        disabled={!!resolving[report.id]}
                        className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {resolving[report.id] ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Resolving
                          </>
                        ) : 'Resolve'}
                      </button>
                    )}
                    <button
                      onClick={() => window.open('/', '_blank')}
                      className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition flex items-center justify-center"
                    >
                      View Feed
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
