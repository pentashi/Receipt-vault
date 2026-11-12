import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Download, Loader2, Lock } from 'lucide-react'
import { downloadVatExport, getVatPeriods, getVatSummary } from '../services/api'
import { aed, daysUntil, errorMessage, shortDate } from '../lib/format'
import type { Role, VatPeriod, VatSummary } from '../lib/types'
import type { ReceiptFilter } from './ReceiptList'

export default function VatReturn({ role, onOpenReceipts }: { role: Role; onOpenReceipts: (f: ReceiptFilter) => void }) {
  const [periods, setPeriods] = useState<VatPeriod[]>([])
  const [period, setPeriod] = useState<string>('')
  const [summary, setSummary] = useState<VatSummary | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    getVatPeriods().then((d) => { setPeriods(d.periods); setPeriod(d.periods[0]?.key || '') }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!period) return
    setSummary(null)
    getVatSummary(period).then(setSummary).catch(() => toast.error("Couldn't load the VAT summary"))
  }, [period])

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadVatExport(period)
      toast.success('Export downloaded')
    } catch (err) {
      toast.error(errorMessage(err, 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  const missing = summary?.issues.find((i) => i.type === 'missing_trn')
  const notRecoverable = summary ? Math.max(0, summary.totals.vat - summary.claimable.vat) : 0
  const checks = summary ? [
    { ok: summary.pending_review === 0, text: summary.pending_review === 0 ? 'Every receipt has been reviewed' : `${summary.pending_review} receipts still waiting for review`, action: () => onOpenReceipts({ status: 'pending' }) },
    { ok: !missing, text: missing ? `${missing.count} receipts missing a supplier TRN (${aed(missing.vat)} VAT)` : 'All receipts with VAT have a supplier TRN', action: () => onOpenReceipts({ issue: 'missing_trn' }) },
    { ok: summary.totals.count > 0, text: summary.totals.count > 0 ? `${summary.totals.count} receipts in this quarter` : 'No receipts in this quarter yet', action: undefined },
  ] : []

  return (
    <div className="space-y-6 fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-auto font-semibold" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        {summary && (
          <span className="text-sm text-night-500">
            Due {shortDate(summary.period.due_date)}
            {daysUntil(summary.period.due_date) >= 0 && ` · ${daysUntil(summary.period.due_date)} days left`}
          </span>
        )}
        <div className="ml-auto">
          {role === 'staff' ? (
            <span className="flex items-center gap-1.5 text-xs text-night-400"><Lock className="h-3.5 w-3.5" /> Owner or accountant can export</span>
          ) : (
            <button onClick={exportCsv} disabled={exporting || !summary} className="btn-gold">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export for accountant (CSV)
            </button>
          )}
        </div>
      </div>

      {!summary ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl bg-night-950 p-6 text-white md:col-span-2">
              <div className="pattern-mashrabiya absolute inset-0 opacity-[0.07]" />
              <div className="relative">
                <p className="eyebrow text-gold-300">VAT 201 · Box 9 · Standard rated expenses</p>
                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                  <div>
                    <div className="text-sm text-night-200">Amount (excl. VAT)</div>
                    <div className="mt-1 font-display text-3xl font-semibold">{aed(summary.vat201_box9.amount)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-night-200">Recoverable VAT</div>
                    <div className="mt-1 font-display text-3xl font-semibold text-gold-200">{aed(summary.vat201_box9.recoverable_vat)}</div>
                  </div>
                </div>
                <p className="mt-5 text-xs text-night-300">Based on {summary.claimable.count} receipts with a valid supplier TRN. A guide for your accountant, not a filed return.</p>
              </div>
            </div>
            <div className="card p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-night-400">Input VAT on all receipts</div>
              <div className="mt-1 font-display text-2xl font-semibold">{aed(summary.totals.vat)}</div>
              <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-night-400">Not recoverable</div>
              <div className={`mt-1 font-display text-2xl font-semibold ${notRecoverable > 0 ? 'text-clay-600' : ''}`}>{aed(notRecoverable)}</div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
            <div className="card p-5">
              <h3 className="font-display text-lg font-semibold">Before you file</h3>
              <div className="mt-4 space-y-2.5">
                {checks.map((c) => (
                  <button key={c.text} onClick={c.action} disabled={!c.action || c.ok} className="flex w-full items-start gap-3 rounded-xl p-2.5 text-left text-sm enabled:hover:bg-sand-50">
                    {c.ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-palm-500" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-clay-500" />}
                    <span className={`flex-1 ${c.ok ? 'text-night-600' : 'font-semibold text-night-900'}`}>{c.text}</span>
                    {!c.ok && c.action && <ArrowRight className="mt-0.5 h-4 w-4 text-night-300" />}
                  </button>
                ))}
              </div>
              {summary.issues.length > 0 && (
                <div className="mt-5 border-t border-sand-200 pt-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-night-400">Why some VAT is left out</div>
                  <ul className="mt-2 space-y-2 text-sm">
                    {summary.issues.map((i) => (
                      <li key={i.type} className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-gold-600" />
                        <span className="flex-1">{i.label} <span className="text-night-400">({i.count})</span></span>
                        <span className="font-semibold">{aed(i.vat)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 pt-5"><h3 className="font-display text-lg font-semibold">By category</h3></div>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="border-y border-sand-200 bg-sand-50 text-left text-[11px] font-bold uppercase tracking-wider text-night-400">
                    <th className="px-5 py-2.5">Category</th><th className="px-3 py-2.5 text-right">Net</th><th className="px-3 py-2.5 text-right">VAT</th><th className="px-5 py-2.5 text-right">Recoverable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200">
                  {summary.by_category.map((c) => (
                    <tr key={c.category}>
                      <td className="px-5 py-2.5 font-medium">{c.category}</td>
                      <td className="px-3 py-2.5 text-right text-night-600">{aed(c.net, 0)}</td>
                      <td className="px-3 py-2.5 text-right text-night-600">{aed(c.vat)}</td>
                      <td className={`px-5 py-2.5 text-right font-semibold ${c.claimable_vat < c.vat ? 'text-gold-700' : 'text-palm-700'}`}>{aed(c.claimable_vat)}</td>
                    </tr>
                  ))}
                  {summary.by_category.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-night-500">No receipts in this quarter.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
