import type { Role } from './types'

export const aed = (value: number | null | undefined, decimals = 2) =>
  `AED ${Number(value || 0).toLocaleString('en-AE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`

export const shortDate = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const daysUntil = (iso: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86400000)
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  accountant: 'Accountant',
  staff: 'Staff',
}

export const ROLE_HINTS: Record<Role, string> = {
  owner: 'Full access, manages team and company details',
  accountant: 'Reviews receipts and exports the VAT quarter',
  staff: 'Uploads receipts and sees only their own',
}

export const ISSUE_LABELS: Record<string, string> = {
  missing_trn: 'Supplier TRN missing',
  blocked_category: 'Usually not recoverable',
  no_vat: 'No VAT on receipt',
  rejected: 'Rejected',
}

export const formatTrn = (trn: string | null | undefined) => {
  if (!trn) return ''
  const d = trn.replace(/\D/g, '')
  return d.length === 15 ? `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7, 11)} ${d.slice(11)}` : d
}

export const isValidTrn = (trn: string | null | undefined) => (trn || '').replace(/\D/g, '').length === 15

export const QUARTER_STARTS: Record<number, string> = {
  1: 'Jan · Apr · Jul · Oct',
  2: 'Feb · May · Aug · Nov',
  3: 'Mar · Jun · Sep · Dec',
}

export const errorMessage = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { error?: string; message?: string } } }
  return e?.response?.data?.error || e?.response?.data?.message || fallback
}
