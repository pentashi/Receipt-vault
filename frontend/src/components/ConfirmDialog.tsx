import React from 'react'
import { AlertCircle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Are you sure?',
  message,
  onConfirm,
  onCancel,
  confirmText = 'Yes, Proceed',
  cancelText = 'Cancel',
}) => {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl max-w-sm w-full p-8 border dark:border-gray-800">
        <div className="w-14 h-14 bg-red-50 dark:bg-red-950/30 rounded-2xl flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">{title}</h3>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed mb-8">{message}</p>
        <div className="flex flex-col space-y-3">
          <button
            onClick={onConfirm}
            className="w-full py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all active:scale-95"
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-4 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmDialog

