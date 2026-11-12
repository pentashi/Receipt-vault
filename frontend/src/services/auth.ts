import api from './api'
import type { Company, User } from '../lib/types'

export interface AuthResponse {
  user: User
  companies: Company[]
  access_token: string
}

const persist = (data: AuthResponse) => {
  localStorage.setItem('token', data.access_token)
  localStorage.setItem('user', JSON.stringify(data.user))
  saveCompanies(data.companies)
  return data
}

export const saveCompanies = (companies: Company[]) => {
  localStorage.setItem('companies', JSON.stringify(companies))
  const active = localStorage.getItem('companyId')
  if (!companies.some((c) => String(c.id) === active) && companies.length) {
    localStorage.setItem('companyId', String(companies[0].id))
  }
}

export const login = async (email: string, password: string) =>
  persist((await api.post('/auth/login', { email, password })).data)

export const register = async (data: {
  email: string
  password: string
  name: string
  company_name: string
  company_trn?: string
}) => persist((await api.post('/auth/register', data)).data)

export const guestLogin = async () => persist((await api.post('/auth/guest-login')).data)

export const logout = () => {
  ;['token', 'user', 'companies', 'companyId'].forEach((k) => localStorage.removeItem(k))
  window.location.href = '/'
}

const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export const getCurrentUser = () => read<User>('user')
export const getStoredCompanies = () => read<Company[]>('companies') || []
export const getActiveCompanyId = () => Number(localStorage.getItem('companyId')) || null
export const setActiveCompanyId = (id: number) => localStorage.setItem('companyId', String(id))
export const isAuthenticated = () => !!localStorage.getItem('token')
