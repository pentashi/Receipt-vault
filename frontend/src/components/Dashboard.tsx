import { useEffect, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ClipboardCheck, Loader2, ScanLine, Store } from 'lucide-react'
import { getExpenseTrends, getTopStores, getVatSummary } from '../services/api'
import { aed, daysUntil, shortDate } from '../lib/format'
import type { Company, VatSummary } from '../lib/types'
import type { Tab } from '../App'
import type { ReceiptFilter } from './ReceiptList'

interface Trend { month: string; total_spent: number; vat: number; claimable_vat: number }
interface TopStore { store_name: string; visit_count: number; total_spent: number }

const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })

function Stat({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: 'default' | 'gold' | 'warn' }) {
  const styles = {
    default: 'card',
    gold: 'rounded-2xl border border-gold-300 bg-gradient-to-br from-gold-50 to-white shadow-card',
    warn: 'rounded-2xl border border-clay-100 bg-clay-50/60 shadow-card',
  }[tone]
  return (
    <div className={`${styles} p-5`}>
      <div className="text-xs font-semibold uppercase tracking-wider text-night-400">{label}</div>
      <div className={`mt-2 font-display text-2xl font-semibold ${tone === 'gold' ? 'text-gold-700' : tone === 'warn' ? 'text-clay-700' : 'text-night-900'}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-night-500">{hint}</div>}
    </div>
  )
}

export default function Dashboard({ company, onNavigate }: { company: Company; onNavigate: (tab: Tab, filter?: ReceiptFilter) => void }) {
  const [summary, setSummary] = useState<VatSummary | null>(null)
  const [trends, setTrends] = useState<Trend[]>([])
  const [stores, setStores] = useState<TopStore[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    Promise.all([getVatSummary(), getExpenseTrends(6), getTopStores(5)])
      .then(([s, t, st]) => { setSummary(s); setTrends(t.trends); setStores(st.top_stores) })
      .catch(() => setError(true))
  }, [])

  if (error) return <div className="card p-8 text-center text-night-500">Couldn't load your overview. Please refresh.</div>
  if (!summary) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>

  const days = daysUntil(summary.period.due_date)
  const missingTrn = summary.issues.find((i) => i.type === 'missing_trn')
  const lost = Math.max(0, summary.totals.vat - summary.claimable.vat)
  const maxCat = Math.max(1, ...summary.by_category.map((c) => c.net + c.vat))
  const isEmpty = summary.totals.count === 0 && summary.pending_review === 0

  return (
    <div className="space-y-6 fade-in">
      <section className="relative overflow-hidden rounded-3xl bg-night-950 p-6 text-white sm:p-8">
        <div className="pattern-mashrabiya absolute inset-0 opacity-[0.08]" />
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <p className="eyebrow text-gold-300">VAT quarter · {summary.period.label}</p>
            <div className="mt-3 text-sm text-night-200">Recoverable input VAT so far</div>
            <div className="mt-1 font-display text-5xl font-semibold text-gold-200">{aed(summary.claimable.vat)}</div>
            <div className="mt-2 text-sm text-night-200">
              from {summary.claimable.count} of {summary.totals.count} receipts · {company.name}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-semibold text-gold-200">
              <CalendarClock className="h-4 w-4" /> Return due {shortDate(summary.period.due_date)}
            </div>
            <div className="mt-1 text-xs text-night-200">
              {days >= 0 ? `${days} days left to file with the FTA` : `${-days} days past the filing date`}
            </div>
            <button onClick={() => onNavigate('vat')} className="btn-gold mt-4 w-full">
              Open VAT return <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {isEmpty ? (
        <section className="card flex flex-col items-center px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-50"><ScanLine className="h-7 w-7 text-gold-600" /></div>
          <h3 className="mt-4 font-display text-xl font-semibold">Add your first receipt</h3>
          <p className="mt-1 max-w-sm text-sm text-night-500">Snap a fuel, DEWA or supplier receipt. We'll read the TRN and VAT and file it into this quarter.</p>
          <button onClick={() => onNavigate('scan')} className="btn-primary mt-5">Add receipt</button>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Spend this quarter" value={aed(summary.totals.gross, 0)} hint={`${summary.totals.count} receipts incl. VAT`} />
            <Stat label="Input VAT paid" value={aed(summary.totals.vat)} hint="5% VAT on your purchases" />
            <Stat label="Recoverable VAT" value={aed(summary.claimable.vat)} hint="Valid TRN, approved for claim" tone="gold" />
            <Stat label="At risk" value={aed(lost)} hint="VAT you may not be able to claim" tone={lost > 0 ? 'warn' : 'default'} />
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="card p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg font-semibold">Spend &amp; recoverable VAT</h3>
                <span className="text-xs text-night-400">Last 6 months</span>
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trends.map((t) => ({ ...t, label: monthLabel(t.month) }))}>
                    <CartesianGrid stroke="#ece3d1" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#56779c" />
                    <YAxis yAxisId="spend" tickLine={false} axisLine={false} fontSize={12} stroke="#56779c" width={52} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <YAxis yAxisId="vat" orientation="right" tickLine={false} axisLine={false} fontSize={12} stroke="#a17424" width={40} />
                    <Tooltip
                      formatter={(value: number, name: string) => [aed(value), name === 'total_spent' ? 'Spend' : 'Recoverable VAT']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #ece3d1' }}
                    />
                    <Bar yAxisId="spend" dataKey="total_spent" fill="#12253c" radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
                    <Line yAxisId="vat" dataKey="claimable_vat" stroke="#d4a845" strokeWidth={3} dot={{ r: 4, fill: '#d4a845' }} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="font-display text-lg font-semibold">Needs attention</h3>
              <div className="mt-4 space-y-3">
                {summary.pending_review > 0 && (
                  <button onClick={() => onNavigate('receipts', { status: 'pending' })} className="flex w-full items-center gap-3 rounded-xl border border-sand-200 p-3 text-left hover:bg-sand-50">
                    <ClipboardCheck className="h-5 w-5 text-night-500" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{summary.pending_review} waiting for review</div>
                      <div className="text-xs text-night-500">Owner or accountant approves them</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-night-300" />
                  </button>
                )}
                {missingTrn && (
                  <button onClick={() => onNavigate('receipts', { issue: 'missing_trn' })} className="flex w-full items-center gap-3 rounded-xl border border-clay-100 bg-clay-50/50 p-3 text-left hover:bg-clay-50">
                    <AlertTriangle className="h-5 w-5 text-clay-600" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{missingTrn.count} without a supplier TRN</div>
                      <div className="text-xs text-night-500">{aed(missingTrn.vat)} VAT can't be claimed until fixed</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-night-300" />
                  </button>
                )}
                {summary.issues.filter((i) => i.type === 'blocked_category').map((i) => (
                  <div key={i.type} className="flex items-center gap-3 rounded-xl border border-sand-200 p-3">
                    <AlertTriangle className="h-5 w-5 text-gold-600" />
                    <div>
                      <div className="text-sm font-semibold">{i.count} entertainment receipt{i.count > 1 ? 's' : ''}</div>
                      <div className="text-xs text-night-500">{aed(i.vat)} VAT is usually blocked from recovery</div>
                    </div>
                  </div>
                ))}
                {summary.pending_review === 0 && summary.issues.length === 0 && (
                  <div className="flex items-center gap-3 rounded-xl bg-palm-50 p-3 text-sm text-palm-700">
                    <CheckCircle2 className="h-5 w-5" /> All clear. This quarter is ready for your accountant.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="font-display text-lg font-semibold">Where the money went</h3>
              <div className="mt-4 space-y-3.5">
                {summary.by_category.slice(0, 6).map((c) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{c.category}</span>
                      <span className="text-night-500">{aed(c.net + c.vat, 0)}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand-200">
                      <div className="h-full rounded-full bg-gradient-to-r from-night-700 to-night-500" style={{ width: `${((c.net + c.vat) / maxCat) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <h3 className="font-display text-lg font-semibold">Top suppliers</h3>
              <div className="mt-3 divide-y divide-sand-200">
                {stores.map((s, i) => (
                  <div key={s.store_name} className="flex items-center gap-3 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sand-100 text-sm font-semibold text-night-600">
                      {i === 0 ? <Store className="h-4 w-4 text-gold-600" /> : i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.store_name}</div>
                      <div className="text-xs text-night-500">{s.visit_count} receipts</div>
                    </div>
                    <div className="text-sm font-semibold">{aed(s.total_spent, 0)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
