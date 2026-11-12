export type Role = 'owner' | 'accountant' | 'staff'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface User {
  id: number
  email: string
  name: string
  is_guest: boolean
  preferred_currency: string
}

export interface Company {
  id: number
  name: string
  trn: string | null
  emirate: string
  vat_quarter_start_month: number
  is_demo: boolean
  role: Role
}

export interface ReceiptItem {
  item_name: string
  quantity: number
  price: number
}

export interface Receipt {
  receipt_id: string
  store_name: string
  address: string | null
  transaction_trn: string | null
  trn_valid: boolean
  date: string | null
  category: string
  currency: string
  original_amount: number | null
  total_incl_vat: number
  vat_amount: number
  total_excl_vat: number
  payment_method: string | null
  notes: string | null
  image_path: string | null
  status: ReviewStatus
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  uploaded_by: string | null
  vat_claimable: boolean
  vat_issue: string | null
  items: ReceiptItem[]
}

export interface VatPeriod {
  key: string
  label: string
  start: string
  end: string
  due_date: string
}

export interface VatSummary {
  period: VatPeriod
  totals: { count: number; net: number; vat: number; gross: number }
  claimable: { count: number; net: number; vat: number }
  pending_review: number
  issues: { type: string; label: string; count: number; vat: number }[]
  by_category: { category: string; net: number; vat: number; claimable_vat: number }[]
  vat201_box9: { amount: number; recoverable_vat: number }
}

export interface Member {
  id: number
  role: Role
  user: User
}

export interface Invite {
  id: number
  email: string
  role: Role
  created_at: string
}
