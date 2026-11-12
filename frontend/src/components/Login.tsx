import { useState } from 'react'
import { ArrowRight, Building2, CheckCircle2, Loader2, ScanLine, ShieldCheck, Users } from 'lucide-react'
import { guestLogin, login, register, type AuthResponse } from '../services/auth'
import { errorMessage, isValidTrn } from '../lib/format'
import { Skyline, Wordmark } from './Brand'

const POINTS = [
  { icon: ScanLine, title: 'Snap any receipt', text: 'We read the supplier, TRN, 5% VAT and total, in AED or any currency.' },
  { icon: ShieldCheck, title: 'Know what you can claim', text: 'Receipts without a valid supplier TRN are flagged before your return.' },
  { icon: Users, title: 'Bring your accountant in', text: 'They review, approve and export the quarter in one click.' },
]

export default function Login({ onLogin }: { onLogin: (data: AuthResponse) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', company_name: '', company_trn: '', email: '', password: '' })
  const [loading, setLoading] = useState<'form' | 'demo' | null>(null)
  const [error, setError] = useState('')

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'register' && form.company_trn && !isValidTrn(form.company_trn)) {
      setError('A UAE TRN has 15 digits. Leave it empty if you are not VAT-registered yet.')
      return
    }
    setLoading('form')
    try {
      const data = mode === 'login' ? await login(form.email, form.password) : await register(form)
      onLogin(data)
    } catch (err) {
      setError(errorMessage(err, 'Something went wrong. Please try again.'))
    } finally {
      setLoading(null)
    }
  }

  const demo = async () => {
    setError('')
    setLoading('demo')
    try {
      onLogin(await guestLogin())
    } catch (err) {
      setError(errorMessage(err, 'The demo is not available right now.'))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid min-h-screen bg-sand-100 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-night-950 text-white lg:flex lg:flex-col">
        <div className="pattern-mashrabiya absolute inset-0 opacity-[0.07]" />
        <div className="absolute -right-24 top-1/3 h-[420px] w-[420px] rounded-full bg-gold-400/20 blur-3xl" />
        <div className="absolute bottom-16 left-[52%] h-48 w-48 -translate-x-1/2 rounded-full bg-gradient-to-b from-gold-300 to-gold-600 opacity-80" />
        <div className="relative z-10 flex flex-1 flex-col px-14 pt-12">
          <Wordmark light />
          <div className="mt-20 max-w-lg">
            <p className="eyebrow text-gold-300">For UAE businesses &amp; their accountants</p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.08]">
              VAT-ready receipts, <span className="text-gold-300">every quarter.</span>
            </h1>
            <p className="mt-3 font-arabic text-xl text-gold-200/80" dir="rtl">إيصالات جاهزة لضريبة القيمة المضافة</p>
            <ul className="mt-10 space-y-6">
              {POINTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-400/30 bg-gold-400/10">
                    <Icon className="h-5 w-5 text-gold-300" />
                  </div>
                  <div>
                    <div className="font-semibold">{title}</div>
                    <div className="text-sm text-night-200">{text}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Skyline className="relative z-10 h-56 w-full text-night-800" />
        <div className="absolute bottom-0 h-10 w-full bg-night-900" />
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md fade-in">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>
          <h2 className="font-display text-3xl font-semibold text-night-900">
            {mode === 'login' ? 'Marhaba, welcome back' : 'Set up your company'}
          </h2>
          <p className="mt-1.5 text-sm text-night-500">
            {mode === 'login'
              ? 'Sign in to your company workspace.'
              : 'Free while in beta. Invite your team and accountant after sign-up.'}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-xl bg-sand-200/70 p-1 text-sm font-semibold">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError('') }}
                className={`rounded-lg py-2 transition ${mode === m ? 'bg-white text-night-900 shadow-sm' : 'text-night-500 hover:text-night-800'}`}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="label">Your name</label>
                  <input className="input" value={form.name} onChange={set('name')} placeholder="Omar Al Mansoori" required />
                </div>
                <div>
                  <label className="label">Company name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-sand-400" />
                    <input className="input pl-10" value={form.company_name} onChange={set('company_name')} placeholder="Falcon Trading LLC" required />
                  </div>
                </div>
                <div>
                  <label className="label">Company TRN <span className="normal-case tracking-normal text-sand-400">(optional)</span></label>
                  <input className="input font-mono" value={form.company_trn} onChange={set('company_trn')} placeholder="100 1234 5678 9003" inputMode="numeric" />
                </div>
              </>
            )}
            <div>
              <label className="label">Work email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="you@company.ae" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={set('password')} placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'} minLength={mode === 'register' ? 8 : undefined} required />
            </div>
            {error && <div className="rounded-xl border border-clay-100 bg-clay-50 px-3.5 py-2.5 text-sm text-clay-700">{error}</div>}
            <button type="submit" disabled={!!loading} className="btn-primary w-full py-3">
              {loading === 'form' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {mode === 'login' ? 'Sign in' : 'Create company workspace'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-sand-400">
            <div className="h-px flex-1 bg-sand-300" /> or <div className="h-px flex-1 bg-sand-300" />
          </div>

          <button onClick={demo} disabled={!!loading} className="btn-gold w-full py-3">
            {loading === 'demo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            Explore a demo Dubai company
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-night-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-palm-500" /> Sample receipts from ENOC, DEWA, du, Careem and more
          </p>
        </div>
      </section>
    </div>
  )
}
