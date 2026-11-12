import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
}

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  onConfirm,
  onCancel,
  confirmText = 'Yes, continue',
  cancelText = 'Cancel',
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-night-950/60 p-4 backdrop-blur-sm">
      <div className="card fade-in w-full max-w-sm p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-clay-50">
          <AlertTriangle className="h-5 w-5 text-clay-600" />
        </div>
        <h3 className="font-display text-xl font-semibold text-night-900">{title}</h3>
        <p className="mt-1.5 text-sm text-night-500">{message}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="btn-ghost flex-1">{cancelText}</button>
          <button onClick={onConfirm} className="btn flex-1 bg-clay-600 text-white hover:bg-clay-700">{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
