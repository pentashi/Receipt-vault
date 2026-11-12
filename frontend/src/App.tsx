import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { Check, ChevronsUpDown, Landmark, LayoutDashboard, LogOut, Receipt, ScanLine, Users } from 'lucide-react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import ReceiptUpload from './components/ReceiptUpload'
import ReceiptList, { type ReceiptFilter } from './components/ReceiptList'
import VatReturn from './components/VatReturn'
import Team from './components/Team'
import { Wordmark } from './components/Brand'
import { getCompanies } from './services/api'
import {
  getActiveCompanyId, getCurrentUser, getStoredCompanies, isAuthenticated, logout,
  saveCompanies, setActiveCompanyId, type AuthResponse,
} from './services/auth'
import { ROLE_LABELS } from './lib/format'
import type { Company, User } from './lib/types'

export type Tab = 'overview' | 'scan' | 'receipts' | 'vat' | 'team'

const NAV: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'scan', label: 'Add receipt', icon: ScanLine },
  { id: 'receipts', label: 'Receipts', icon: Receipt },
  { id: 'vat', label: 'VAT return', icon: Landmark },
  { id: 'team', label: 'Team & company', icon: Users },
]

const TITLES: Record<Tab, { title: string; sub: string }> = {
  overview: { title: 'Overview', sub: 'This VAT quarter at a glance' },
  scan: { title: 'Add a receipt', sub: 'Scan it or type it in' },
  receipts: { title: 'Receipts', sub: 'Every receipt your team has uploaded' },
  vat: { title: 'VAT return', sub: 'Input VAT you can recover this quarter' },
  team: { title: 'Team & company', sub: 'Company details, people and access' },
}

function CompanySwitcher({ companies, active, onSelect }: { companies: Company[]; active: Company; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold-400/15 font-display text-sm font-semibold text-gold-300">
          {active.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{active.name}</div>
          <div className="text-xs text-night-300">{active.emirate} · {ROLE_LABELS[active.role]}</div>
        </div>
        <ChevronsUpDown className="h-4 w-4 text-night-300" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-sand-200 bg-white py-1 shadow-xl">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => { onSelect(c.id); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sand-100"
            >
              <span className="flex-1 truncate font-medium text-night-900">{c.name}</span>
              <span className="text-xs text-night-400">{ROLE_LABELS[c.role]}</span>
              {c.id === active.id && <Check className="h-4 w-4 text-gold-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(isAuthenticated())
  const [user, setUser] = useState<User | null>(getCurrentUser())
  const [companies, setCompanies] = useState<Company[]>(getStoredCompanies())
  const [activeId, setActiveId] = useState<number | null>(getActiveCompanyId())
  const [tab, setTab] = useState<Tab>('overview')
  const [receiptFilter, setReceiptFilter] = useState<ReceiptFilter>({})

  const refreshCompanies = async (selectId?: number) => {
    const { companies: list } = await getCompanies()
    if (selectId) setActiveCompanyId(selectId)
    saveCompanies(list)
    setCompanies(list)
    setActiveId(getActiveCompanyId())
  }

  useEffect(() => {
    if (authed) refreshCompanies().catch(() => undefined)
  }, [authed])

  const handleLogin = (data: AuthResponse) => {
    setUser(data.user)
    setCompanies(data.companies)
    setActiveId(getActiveCompanyId())
    setTab('overview')
    setAuthed(true)
  }

  const go = (next: Tab, filter: ReceiptFilter = {}) => {
    setReceiptFilter(filter)
    setTab(next)
    window.scrollTo({ top: 0 })
  }

  const selectCompany = (id: number) => {
    setActiveCompanyId(id)
    setActiveId(id)
    go('overview')
  }

  const company = companies.find((c) => c.id === activeId) || companies[0]

  if (!authed || !user || !company) return <Login onLogin={handleLogin} />

  return (
    <div className="min-h-screen bg-sand-100 text-night-900">
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: 12, fontSize: 14 } }} />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-night-950 lg:flex">
        <div className="pattern-mashrabiya pointer-events-none absolute inset-0 opacity-[0.05]" />
        <div className="relative flex h-full flex-col p-5">
          <div className="px-1 pb-6 pt-1"><Wordmark light /></div>
          <CompanySwitcher companies={companies} active={company} onSelect={selectCompany} />
          <nav className="mt-6 space-y-1">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => go(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  tab === id ? 'bg-gold-400/15 text-gold-200' : 'text-night-200 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] ${tab === id ? 'text-gold-300' : ''}`} />
                {label}
                {tab === id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-gold-300" />}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-night-700 text-sm font-semibold text-white">
                {(user.name || user.email).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{user.name || 'You'}</div>
                <div className="truncate text-xs text-night-300">{user.is_guest ? 'Demo account' : user.email}</div>
              </div>
              <button onClick={logout} className="rounded-lg p-2 text-night-300 hover:bg-white/10 hover:text-white" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-sand-200 bg-sand-100/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-8">
            <div className="lg:hidden"><Wordmark /></div>
            <div className="hidden lg:block">
              <h1 className="font-display text-2xl font-semibold">{TITLES[tab].title}</h1>
              <p className="text-sm text-night-500">{TITLES[tab].sub}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="font-arabic text-sm text-gold-600" dir="rtl">مرحبا</div>
                <div className="text-xs text-night-500">{company.name}</div>
              </div>
              <button onClick={logout} className="btn-ghost px-3 lg:hidden" title="Sign out"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </header>

        {company.is_demo && (
          <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-8">
            <div className="flex items-center gap-3 rounded-xl border border-gold-200 bg-gold-50 px-4 py-2.5 text-sm text-gold-800">
              <span className="chip shrink-0 bg-gold-400 text-night-950">Demo</span>
              <span>You're exploring <b>{company.name}</b>, a sample Dubai trading company. Changes are private to you.</span>
            </div>
          </div>
        )}

        <main key={company.id} className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-8 lg:pb-12">
          <div className="mb-5 lg:hidden">
            <h1 className="font-display text-2xl font-semibold">{TITLES[tab].title}</h1>
            <p className="text-sm text-night-500">{TITLES[tab].sub}</p>
          </div>
          {tab === 'overview' && <Dashboard company={company} onNavigate={go} />}
          {tab === 'scan' && <ReceiptUpload onDone={() => go('receipts')} />}
          {tab === 'receipts' && <ReceiptList role={company.role} initialFilter={receiptFilter} />}
          {tab === 'vat' && <VatReturn role={company.role} onOpenReceipts={(f) => go('receipts', f)} />}
          {tab === 'team' && <Team company={company} user={user} onCompaniesChanged={refreshCompanies} />}
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-sand-200 pt-5 text-xs text-night-400">
            <span>ReceiptVault · Built for UAE businesses · VAT at 5%</span>
            <span className="font-arabic" dir="rtl">صُنع في الإمارات</span>
          </footer>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-night-800 bg-night-950 px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => go(id)} className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${tab === id ? 'text-gold-300' : 'text-night-300'}`}>
            <Icon className="h-5 w-5" />
            {label.split(' ')[0]}
          </button>
        ))}
      </nav>
    </div>
  )
}
