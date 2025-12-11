import { useState, useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

let toastListeners: Array<(toasts: Toast[]) => void> = []
let toasts: Toast[] = []

function notify() {
  toastListeners.forEach(listener => listener([...toasts]))
}

export function showToast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).substring(2, 9)
  toasts.push({ id, message, type })
  notify()
  return id
}

export function removeToast(id: string) {
  toasts = toasts.filter(t => t.id !== id)
  notify()
}

export function useToasts() {
  const [state, setState] = useState<Toast[]>(toasts)

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setState(newToasts)
    toastListeners.push(listener)
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener)
    }
  }, [])

  return state
}

export function ToastContainer() {
  const toasts = useToasts()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id)
    }, 5000)
    return () => clearTimeout(timer)
  }, [toast.id])

  const bgColor = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  }[toast.type]

  return (
    <div
      className={`${bgColor} border rounded-lg px-4 py-3 shadow-lg flex items-center justify-between gap-4 animate-in slide-in-from-right`}
    >
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-current opacity-60 hover:opacity-100 transition"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  )
}

