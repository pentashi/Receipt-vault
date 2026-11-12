import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Check, CheckCircle2, ExternalLink, FileText, Loader2, RotateCcw, Search, Trash2, X, XCircle } from 'lucide-react'
import { deleteReceipt, fileUrl, getCategories, getReceipts, reviewReceipt, updateReceipt } from '../services/api'
import { aed, errorMessage, formatTrn, ISSUE_LABELS, isValidTrn, shortDate } from '../lib/format'
import type { Receipt, ReviewStatus, Role } from '../lib/types'
import ConfirmDialog from './ConfirmDialog'

export interface ReceiptFilter {
  status?: ReviewStatus
  issue?: 'missing_trn'
}

const STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: 'bg-gold-100 text-gold-800',
  approved: 'bg-palm-100 text-palm-700',
  rejected: 'bg-clay-100 text-clay-700',
}

const STATUS_LABELS: Record<ReviewStatus, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }

export function StatusPill({ status }: { status: ReviewStatus }) {
  return <span className={`chip ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
}

function TrnChip({ receipt }: { receipt: Receipt }) {
  return receipt.trn_valid
    ? <span className="chip bg-palm-50 text-palm-700"><Check className="h-3 w-3" /> TRN</span>
    : <span className="chip bg-clay-50 text-clay-600"><AlertTriangle className="h-3 w-3" /> No TRN</span>
}

const ISSUE_HELP: Record<string, string> = {
  missing_trn: "Ask the supplier for a tax invoice showing their 15-digit TRN, then add it here. Until then this VAT can't be recovered.",
  blocked_category: 'VAT on entertainment is usually blocked under UAE VAT rules. Your accountant can confirm.',
  no_vat: 'No VAT on this receipt, so there is nothing to recover. It still counts as a business expense.',
  rejected: 'Rejected in review, so it is left out of the VAT return.',
}

function ReceiptDrawer({ receipt, role, categories, onClose, onChanged }: {
  receipt: Receipt
  role: Role
  categories: string[]
  onClose: () => void
  onChanged: (r: Receipt | null) => void
}) {
  const [form, setForm] = useState({
    store_name: receipt.store_name,
    transaction_trn: receipt.transaction_trn || '',
    date: receipt.date?.slice(0, 10) || '',
    category: receipt.category,
    total_incl_vat: String(receipt.total_incl_vat ?? ''),
    vat_amount: String(receipt.vat_amount ?? ''),
    notes: receipt.notes || '',
  })
  const [note, setNote] = useState(receipt.review_note || '')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const canReview = role !== 'staff'
  const canEdit = canReview || receipt.status !== 'approved'
  const image = fileUrl(receipt.image_path)
  const isPdf = !!receipt.image_path?.toLowerCase().endsWith('.pdf')

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value })

  const run = async (fn: () => Promise<{ receipt?: Receipt }>, done: string, close = false) => {
    setBusy(true)
    try {
      const data = await fn()
      toast.success(done)
      onChanged(data.receipt || null)
      if (close) onClose()
    } catch (err) {
      toast.error(errorMessage(err, 'Something went wrong'))
    } finally {
      setBusy(false)
    }
  }

  const save = () => run(() => updateReceipt(receipt.receipt_id, {
    ...form,
    total_incl_vat: parseFloat(form.total_incl_vat) || 0,
    vat_amount: parseFloat(form.vat_amount) || 0,
  }), 'Receipt updated')

  const review = (status: ReviewStatus) => run(() => reviewReceipt(receipt.receipt_id, status, note), status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Moved back to pending')

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-night-950/40 backdrop-blur-[2px]" onClick={onClose}>
      <div className="fade-in flex h-full w-full max-w-xl flex-col bg-sand-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-sand-200 bg-white px-6 py-5">
          <div className="flex-1">
            <div className="flex items-center gap-2"><StatusPill status={receipt.status} /><TrnChip receipt={receipt} /></div>
            <h2 className="mt-2 font-display text-2xl font-semibold">{receipt.store_name}</h2>
            <p className="text-xs text-night-500">
              Uploaded by {receipt.uploaded_by || 'someone'} · {shortDate(receipt.date)}
              {receipt.reviewed_by && ` · ${STATUS_LABELS[receipt.status].toLowerCase()} by ${receipt.reviewed_by}`}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-sand-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {receipt.vat_issue && (
            <div className={`rounded-xl border p-3.5 text-sm ${receipt.vat_issue === 'no_vat' ? 'border-sand-200 bg-white text-night-600' : 'border-clay-100 bg-clay-50 text-clay-700'}`}>
              <div className="font-semibold">{ISSUE_LABELS[receipt.vat_issue]}</div>
              <div className="mt-0.5 opacity-90">{ISSUE_HELP[receipt.vat_issue]}</div>
            </div>
          )}
          {receipt.vat_claimable && (
            <div className="flex items-center gap-2 rounded-xl border border-palm-100 bg-palm-50 p-3.5 text-sm text-palm-700">
              <CheckCircle2 className="h-4 w-4" /> {aed(receipt.vat_amount)} VAT is recoverable on this receipt
            </div>
          )}

          {image && (
            isPdf ? (
              <a href={image} target="_blank" rel="noreferrer" className="btn-ghost w-full"><FileText className="h-4 w-4" /> Open original PDF <ExternalLink className="h-3.5 w-3.5" /></a>
            ) : (
              <a href={image} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-sand-200 bg-white">
                <img src={image} alt="Receipt" className="max-h-72 w-full object-contain" />
              </a>
            )
          )}

          <div className="card grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Supplier</label>
              <input className="input" value={form.store_name} onChange={set('store_name')} disabled={!canEdit} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Supplier TRN</label>
              <input className="input font-mono" value={form.transaction_trn} onChange={set('transaction_trn')} disabled={!canEdit} placeholder="15 digits" />
              {form.transaction_trn && !isValidTrn(form.transaction_trn) && <div className="mt-1 text-xs text-clay-600">A UAE TRN has 15 digits</div>}
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} onChange={set('date')} disabled={!canEdit} />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={set('category')} disabled={!canEdit}>
                {[...new Set([form.category, ...categories])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Total incl. VAT (AED)</label>
              <input type="number" step="0.01" className="input" value={form.total_incl_vat} onChange={set('total_incl_vat')} disabled={!canEdit} />
              {receipt.currency !== 'AED' && receipt.original_amount != null && (
                <div className="mt-1 text-xs text-night-400">Paid {receipt.currency} {receipt.original_amount}</div>
              )}
            </div>
            <div>
              <label className="label">VAT (AED)</label>
              <input type="number" step="0.01" className="input" value={form.vat_amount} onChange={set('vat_amount')} disabled={!canEdit} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Note</label>
              <input className="input" value={form.notes} onChange={set('notes')} disabled={!canEdit} />
            </div>
            {canEdit && <button onClick={save} disabled={busy} className="btn-primary sm:col-span-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</button>}
            {!canEdit && <p className="text-xs text-night-500 sm:col-span-2">Approved receipts can only be changed by the owner or accountant.</p>}
          </div>

          {receipt.items.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold">Line items</h3>
              <div className="mt-2 divide-y divide-sand-200 text-sm">
                {receipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between py-2"><span>{item.quantity} × {item.item_name}</span><span>{aed(item.price)}</span></div>
                ))}
              </div>
            </div>
          )}

          {canReview && (
            <div className="card p-5">
              <h3 className="font-display text-lg font-semibold">Review</h3>
              <input className="input mt-3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the uploader (optional)" />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button onClick={() => review('approved')} disabled={busy} className="btn bg-palm-600 text-white hover:bg-palm-700"><CheckCircle2 className="h-4 w-4" /> Approve</button>
                <button onClick={() => review('rejected')} disabled={busy} className="btn-danger"><XCircle className="h-4 w-4" /> Reject</button>
              </div>
              {receipt.status !== 'pending' && (
                <button onClick={() => review('pending')} disabled={busy} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-night-500 hover:text-night-800"><RotateCcw className="h-3.5 w-3.5" /> Move back to pending</button>
              )}
            </div>
          )}
          {!canReview && receipt.review_note && (
            <div className="card p-4 text-sm"><span className="font-semibold">Reviewer note:</span> {receipt.review_note}</div>
          )}
        </div>

        {canEdit && (
          <div className="border-t border-sand-200 bg-white px-6 py-4">
            <button onClick={() => setConfirm(true)} className="flex items-center gap-2 text-sm font-semibold text-clay-600 hover:text-clay-700"><Trash2 className="h-4 w-4" /> Delete receipt</button>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title="Delete this receipt?"
        message="The receipt and its image will be removed. This can't be undone."
        confirmText="Delete"
        onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); run(() => deleteReceipt(receipt.receipt_id), 'Receipt deleted', true) }}
      />
    </div>
  )
}

export default function ReceiptList({ role, initialFilter }: { role: Role; initialFilter: ReceiptFilter }) {
  const [receipts, setReceipts] = useState<Receipt[] | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [status, setStatus] = useState<ReviewStatus | 'all'>(initialFilter.status || 'all')
  const [missingTrn, setMissingTrn] = useState(initialFilter.issue === 'missing_trn')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<Receipt | null>(null)

  const load = useCallback(() => {
    getReceipts({
      status: status === 'all' ? undefined : status,
      category: category === 'all' ? undefined : category,
      store_name: search || undefined,
      issue: missingTrn ? 'missing_trn' : undefined,
    }).then((d) => setReceipts(d.receipts)).catch(() => setReceipts([]))
  }, [status, category, search, missingTrn])

  useEffect(() => { const t = setTimeout(load, search ? 300 : 0); return () => clearTimeout(t) }, [load, search])
  useEffect(() => { getCategories().then((d) => setCategories(d.categories)).catch(() => undefined) }, [])

  const handleChanged = (updated: Receipt | null) => {
    if (updated) setOpen(updated)
    load()
  }

  const totals = (receipts || []).reduce((acc, r) => ({ gross: acc.gross + r.total_incl_vat, vat: acc.vat + r.vat_amount }), { gross: 0, vat: 0 })

  return (
    <div className="space-y-4 fade-in">
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <div className="flex rounded-xl bg-sand-100 p-1 text-sm font-semibold">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-lg px-3 py-1.5 capitalize transition ${status === s ? 'bg-white text-night-900 shadow-sm' : 'text-night-500 hover:text-night-800'}`}>{s}</button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-sand-400" />
          <input className="input pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search supplier" />
        </div>
        <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => setMissingTrn(!missingTrn)} className={`btn ${missingTrn ? 'bg-clay-600 text-white' : 'btn-ghost'}`}>
          <AlertTriangle className="h-4 w-4" /> Missing TRN
        </button>
      </div>

      {receipts === null ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gold-500" /></div>
      ) : receipts.length === 0 ? (
        <div className="card px-6 py-16 text-center text-sm text-night-500">No receipts match these filters.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden grid-cols-[100px_1.6fr_1.2fr_90px_110px_120px_100px] gap-3 border-b border-sand-200 bg-sand-50 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-night-400 md:grid">
            <div>Date</div><div>Supplier</div><div>Category</div><div>TRN</div><div className="text-right">VAT</div><div className="text-right">Total</div><div className="text-right">Status</div>
          </div>
          <div className="divide-y divide-sand-200">
            {receipts.map((r) => (
              <button key={r.receipt_id} onClick={() => setOpen(r)} className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-5 py-3.5 text-left text-sm transition hover:bg-sand-50 md:grid-cols-[100px_1.6fr_1.2fr_90px_110px_120px_100px] md:items-center">
                <div className="order-3 text-xs text-night-500 md:order-none md:text-sm">{shortDate(r.date)}</div>
                <div className="order-1 min-w-0 md:order-none">
                  <div className="truncate font-semibold">{r.store_name}</div>
                  <div className="truncate text-xs text-night-400">{r.uploaded_by}{r.transaction_trn && r.trn_valid ? ` · ${formatTrn(r.transaction_trn)}` : ''}</div>
                </div>
                <div className="hidden truncate text-night-600 md:block">{r.category}</div>
                <div className="hidden md:block"><TrnChip receipt={r} /></div>
                <div className={`hidden text-right md:block ${r.vat_claimable ? 'text-palm-700' : 'text-night-500'}`}>{aed(r.vat_amount)}</div>
                <div className="order-2 text-right font-semibold md:order-none">{aed(r.total_incl_vat)}</div>
                <div className="order-4 text-right md:order-none"><StatusPill status={r.status} /></div>
              </button>
            ))}
          </div>
          <div className="flex justify-between border-t border-sand-200 bg-sand-50 px-5 py-3 text-sm">
            <span className="text-night-500">{receipts.length} receipts</span>
            <span className="font-semibold">{aed(totals.gross)} <span className="font-normal text-night-500">· VAT {aed(totals.vat)}</span></span>
          </div>
        </div>
      )}

      {open && <ReceiptDrawer key={`${open.receipt_id}-${open.status}`} receipt={open} role={role} categories={categories} onClose={() => setOpen(null)} onChanged={handleChanged} />}
    </div>
  )
}
