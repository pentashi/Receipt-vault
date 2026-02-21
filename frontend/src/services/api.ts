import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Receipt APIs
export const uploadReceipt = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await api.post('/receipts/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const getReceipts = async (filters?: {
  category?: string
  start_date?: string
  end_date?: string
  store_name?: string
}) => {
  const response = await api.get('/receipts/', { params: filters })
  return response.data
}

export const getReceipt = async (receiptId: string) => {
  const response = await api.get(`/receipts/${receiptId}`)
  return response.data
}

export const updateReceipt = async (receiptId: string, data: any) => {
  const response = await api.put(`/receipts/${receiptId}`, data)
  return response.data
}

export const deleteReceipt = async (receiptId: string) => {
  const response = await api.delete(`/receipts/${receiptId}`)
  return response.data
}

// Expense APIs
export const getExpenseSummary = async (params: {
  period?: string
  year?: number
  month?: number
}) => {
  const response = await api.get('/expenses/summary', { params })
  return response.data
}

export const getExpenseTrends = async (months: number = 6) => {
  const response = await api.get('/expenses/trends', { params: { months } })
  return response.data
}

export const getTopStores = async (limit: number = 10) => {
  const response = await api.get('/expenses/top-stores', { params: { limit } })
  return response.data
}

export const getCategories = async () => {
  const response = await api.get('/expenses/categories')
  return response.data
}

export const exportExpenses = async (startDate?: string, endDate?: string) => {
  const response = await api.get('/expenses/export', {
    params: { start_date: startDate, end_date: endDate }
  })
  return response.data
}

// Budget APIs
export const getBudgets = async (month?: number, year?: number) => {
  const response = await api.get('/budgets/', { params: { month, year } })
  return response.data
}

export const createBudget = async (data: {
  category: string
  monthly_limit: number
  month?: number
  year?: number
  alert_threshold?: number
}) => {
  const response = await api.post('/budgets/', data)
  return response.data
}

export const updateBudget = async (budgetId: number, data: any) => {
  const response = await api.put(`/budgets/${budgetId}`, data)
  return response.data
}

export const deleteBudget = async (budgetId: number) => {
  const response = await api.delete(`/budgets/${budgetId}`)
  return response.data
}

export const getBudgetAlerts = async (month?: number, year?: number) => {
  const response = await api.get('/budgets/alerts', { params: { month, year } })
  return response.data
}

// Auth APIs
export const registerUser = async (data: { email: string; password: string; name?: string }) => {
  const response = await api.post('/auth/register', data, { withCredentials: true })
  return response.data
}

export const loginUser = async (data: { email: string; password: string }) => {
  const response = await api.post('/auth/login', data, { withCredentials: true })
  return response.data
}

export const logoutUser = async () => {
  const response = await api.post('/auth/logout', {}, { withCredentials: true })
  return response.data
}

export const getCurrentUser = async () => {
  const response = await api.get('/auth/me', { withCredentials: true })
  return response.data
}

export default api
