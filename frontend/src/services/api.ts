import axios from 'axios'
import type { Role } from '../lib/types'

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const companyId = localStorage.getItem('companyId')
  if (companyId) config.headers['X-Company-Id'] = companyId
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 422)) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('companies')
      localStorage.removeItem('companyId')
      window.location.href = '/'
    }
    return Promise.reject(error)
  },
)

export const fileUrl = (path: string | null) => {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const origin = /^https?:\/\//.test(API_BASE_URL) ? new URL(API_BASE_URL).origin : window.location.origin
  return `${origin}${path}`
}

// Receipts
export const uploadReceipt = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/receipts/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
  return response.data
}

export const createManualReceipt = async (data: Record<string, unknown>) => (await api.post('/receipts/manual', data)).data

export const getReceipts = async (filters?: Record<string, string | undefined>) =>
  (await api.get('/receipts/', { params: filters })).data

export const updateReceipt = async (receiptId: string, data: Record<string, unknown>) =>
  (await api.put(`/receipts/${receiptId}`, data)).data

export const reviewReceipt = async (receiptId: string, status: string, note?: string) =>
  (await api.post(`/receipts/${receiptId}/review`, { status, note })).data

export const deleteReceipt = async (receiptId: string) => (await api.delete(`/receipts/${receiptId}`)).data

// Analytics
export const getExpenseTrends = async (months = 6) => (await api.get('/expenses/trends', { params: { months } })).data
export const getTopStores = async (limit = 5) => (await api.get('/expenses/top-stores', { params: { limit } })).data
export const getCategories = async () => (await api.get('/expenses/categories')).data

// VAT
export const getVatPeriods = async () => (await api.get('/vat/periods')).data
export const getVatSummary = async (period?: string) => (await api.get('/vat/summary', { params: { period } })).data

export const downloadVatExport = async (period: string) => {
  const response = await api.get('/vat/export', { params: { period }, responseType: 'blob' })
  const disposition: string = response.headers['content-disposition'] || ''
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] || `vat-${period}.csv`
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// Companies & team
export const getCompanies = async () => (await api.get('/companies/')).data
export const createCompany = async (data: Record<string, unknown>) => (await api.post('/companies/', data)).data
export const updateCompany = async (data: Record<string, unknown>) => (await api.put('/companies/current', data)).data
export const getMembers = async () => (await api.get('/companies/current/members')).data
export const inviteMember = async (email: string, role: Role) =>
  (await api.post('/companies/current/invites', { email, role })).data
export const updateMemberRole = async (id: number, role: Role) =>
  (await api.put(`/companies/current/members/${id}`, { role })).data
export const removeMember = async (id: number) => (await api.delete(`/companies/current/members/${id}`)).data
export const cancelInvite = async (id: number) => (await api.delete(`/companies/current/invites/${id}`)).data
export const getMeta = async () => (await api.get('/companies/meta')).data

export default api
