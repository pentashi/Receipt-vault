import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Camera, CheckCircle2, FileText, Keyboard, Loader2, ShieldCheck, Upload, X } from 'lucide-react'
import { createManualReceipt, getCategories, uploadReceipt } from '../services/api'
import { aed, errorMessage, formatTrn, isValidTrn } from '../lib/format'
import type { Receipt } from '../lib/types'

const PAYMENT_METHODS = ['Card', 'Cash', 'Bank transfer', 'Company card', 'Apple Pay']

export default function ReceiptUpload({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<'scan' | 'manual'>('scan')
  const [categories, setCategories] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ receipt: Receipt; autoRead: boolean } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    store_name: '', transaction_trn: '', date: today, category: '', total_incl_vat: '', vat_amount: '', payment_method: 'Card', notes: '',
  })

  useEffect(() => { getCategories().then((d) => setCategories(d.categories)).catch(() => undefined) }, [])

  const pick = (f: File | undefined) => {
    if (!f) return
    setFile(f)
    setResult(null)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  const scan = async () => {
    if (!file) return
    setBusy(true)
    try {
      const data = await uploadReceipt(file)
      setResult({ receipt: data.receipt, autoRead: data.auto_read })
      setFile(null)
      setPreview(null)
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed. Try a clearer photo.'))
    } finally {
      setBusy(false)
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const fillVat = () => {
    const gross = parseFloat(form.total_incl_vat)
    if (gross > 0) setForm({ ...form, vat_amount: (gross - gross / 1.05).toFixed(2) })
  }

  const saveManual = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const data = await createManualReceipt({
        ...form,
        total_incl_vat: parseFloat(form.total_incl_vat) || 0,
        vat_amount: parseFloat(form.vat_amount) || 0,
        category: form.category || undefined,
      })
      setResult({ receipt: data.receipt, autoRead: true })
      setForm({ ...form, store_name: '', transaction_trn: '', total_incl_vat: '', vat_amount: '', notes: '' })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the receipt.'))
    } finally {
      setBusy(false)
    }
  }

  const trnState = form.transaction_trn ? (isValidTrn(form.transaction_trn) ? 'ok' : 'bad') : 'empty'

  return (
    <div className="mx-auto grid max-w-5xl gap-6 fade-in lg:grid-cols-[1.5fr_1fr]">
      <div className="card overflow-hidden">
        <div className="grid grid-cols-2 border-b border-sand-200 text-sm font-semibold">
          {([['scan', 'Scan receipt', Camera], ['manual', 'Type it in', Keyboard]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => { setMode(id); setResult(null) }} className={`flex items-center justify-center gap-2 py-3.5 transition ${mode === id ? 'border-b-2 border-gold-500 text-night-900' : 'text-night-400 hover:text-night-700'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {mode === 'scan' ? (
          <div className="p-6">
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]) }}
              className={`relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${file ? 'border-gold-400 bg-gold-50/40' : 'border-sand-300 hover:border-gold-400 hover:bg-sand-50'}`}
            >
              <input ref={inputRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              {file ? (
                <>
                  {preview ? <img src={preview} alt="Receipt preview" className="max-h-64 rounded-xl shadow-card" /> : <FileText className="h-14 w-14 text-gold-600" />}
                  <div className="mt-3 text-sm font-semibold">{file.name}</div>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null) }} className="absolute right-3 top-3 rounded-full bg-white p-1.5 shadow"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-night-950"><Upload className="h-6 w-6 text-gold-300" /></div>
                  <div className="mt-4 font-display text-lg font-semibold">Drop a receipt or tap to take a photo</div>
                  <div className="mt-1 text-sm text-night-500">JPG, PNG or PDF · tax invoices, fuel slips, DEWA bills</div>
                </>
              )}
            </div>
            <button onClick={scan} disabled={!file || busy} className="btn-primary mt-5 w-full py-3">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {busy ? 'Reading receipt…' : 'Read & add to this quarter'}
            </button>
          </div>
        ) : (
          <form onSubmit={saveManual} className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Supplier</label>
              <input className="input" value={form.store_name} onChange={set('store_name')} placeholder="ENOC, DEWA, Sharaf DG…" required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Supplier TRN</label>
              <input className={`input font-mono ${trnState === 'bad' ? 'border-clay-500' : ''}`} value={form.transaction_trn} onChange={set('transaction_trn')} placeholder="15 digits, printed on the tax invoice" inputMode="numeric" />
              <div className={`mt-1 text-xs ${trnState === 'ok' ? 'text-palm-600' : trnState === 'bad' ? 'text-clay-600' : 'text-night-400'}`}>
                {trnState === 'ok' ? `Valid format · ${formatTrn(form.transaction_trn)}` : trnState === 'bad' ? 'A UAE TRN has 15 digits' : "Without a TRN you can't recover the VAT"}
              </div>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date} max={today} onChange={set('date')} required />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={set('category')}>
                <option value="">Detect from supplier</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Total incl. VAT (AED)</label>
              <input type="number" step="0.01" min="0" className="input" value={form.total_incl_vat} onChange={set('total_incl_vat')} onBlur={() => !form.vat_amount && fillVat()} required />
            </div>
            <div>
              <label className="label flex justify-between">VAT (AED) <button type="button" onClick={fillVat} className="normal-case tracking-normal text-gold-600 hover:underline">Calculate 5%</button></label>
              <input type="number" step="0.01" min="0" className="input" value={form.vat_amount} onChange={set('vat_amount')} />
            </div>
            <div>
              <label className="label">Paid with</label>
              <select className="input" value={form.payment_method} onChange={set('payment_method')}>
                {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Note</label>
              <input className="input" value={form.notes} onChange={set('notes')} placeholder="Client lunch, site visit…" />
            </div>
            <button type="submit" disabled={busy} className="btn-primary py-3 sm:col-span-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save receipt
            </button>
          </form>
        )}
      </div>

      <aside className="space-y-4">
        {result ? (
          <div className="card fade-in p-5">
            <div className={`flex items-center gap-2 text-sm font-semibold ${result.autoRead ? 'text-palm-600' : 'text-gold-700'}`}>
              {result.autoRead ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              {result.autoRead ? 'Added, waiting for review' : "Saved. We couldn't read it, please fill in the details"}
            </div>
            <div className="mt-4 rounded-xl bg-sand-50 p-4">
              <div className="font-display text-lg font-semibold">{result.receipt.store_name}</div>
              <div className="text-xs text-night-500">{result.receipt.category}</div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-night-500">Total</dt><dd className="font-semibold">{aed(result.receipt.total_incl_vat)}</dd></div>
                <div className="flex justify-between"><dt className="text-night-500">VAT</dt><dd className="font-semibold">{aed(result.receipt.vat_amount)}</dd></div>
                <div className="flex justify-between"><dt className="text-night-500">Supplier TRN</dt><dd className={result.receipt.trn_valid ? 'font-mono text-palm-600' : 'text-clay-600'}>{result.receipt.trn_valid ? formatTrn(result.receipt.transaction_trn) : 'Missing'}</dd></div>
              </dl>
            </div>
            <button onClick={onDone} className="btn-ghost mt-4 w-full">Go to receipts</button>
          </div>
        ) : (
          <div className="rounded-2xl bg-night-950 p-5 text-white">
            <div className="pattern-mashrabiya -m-5 mb-0 h-2 opacity-20" />
            <h3 className="mt-3 font-display text-lg font-semibold text-gold-200">What makes a receipt claimable?</h3>
            <ul className="mt-3 space-y-3 text-sm text-night-100">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> It's a tax invoice showing the supplier's 15-digit TRN</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> VAT is charged at 5% and shown separately</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" /> It's a business expense, not staff entertainment</li>
            </ul>
            <p className="mt-4 text-xs text-night-300">Keep originals for at least 5 years. ReceiptVault stores them for you.</p>
          </div>
        )}
      </aside>
    </div>
  )
}
