import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Building2, Loader2, Mail, Plus, Trash2, UserPlus } from 'lucide-react'
import { cancelInvite, createCompany, getMembers, getMeta, inviteMember, removeMember, updateCompany, updateMemberRole } from '../services/api'
import { errorMessage, isValidTrn, QUARTER_STARTS, ROLE_HINTS, ROLE_LABELS } from '../lib/format'
import type { Company, Invite, Member, Role, User } from '../lib/types'

const ROLES: Role[] = ['owner', 'accountant', 'staff']

export default function Team({ company, user, onCompaniesChanged }: { company: Company; user: User; onCompaniesChanged: (selectId?: number) => Promise<void> }) {
  const isOwner = company.role === 'owner'
  const [emirates, setEmirates] = useState<string[]>([company.emirate])
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [profile, setProfile] = useState({ name: company.name, trn: company.trn || '', emirate: company.emirate, vat_quarter_start_month: company.vat_quarter_start_month })
  const [invite, setInvite] = useState<{ email: string; role: Role }>({ email: '', role: 'accountant' })
  const [newCompany, setNewCompany] = useState({ name: '', trn: '' })
  const [busy, setBusy] = useState<string | null>(null)

  const loadMembers = () => getMembers().then((d) => { setMembers(d.members); setInvites(d.invites) }).catch(() => undefined)

  useEffect(() => {
    loadMembers()
    getMeta().then((d) => setEmirates(d.emirates)).catch(() => undefined)
  }, [])

  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key)
    try {
      await fn()
      toast.success(done)
      return true
    } catch (err) {
      toast.error(errorMessage(err, 'Something went wrong'))
      return false
    } finally {
      setBusy(null)
    }
  }

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (profile.trn && !isValidTrn(profile.trn)) return toast.error('A UAE TRN has 15 digits')
    act('profile', async () => { await updateCompany(profile); await onCompaniesChanged() }, 'Company details saved')
  }

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await act('invite', async () => {
      const res = await inviteMember(invite.email, invite.role)
      if (!res.added) toast(`They'll join ${company.name} when they sign up with ${invite.email}`, { icon: '✉️' })
    }, 'Invite sent')
    if (ok) { setInvite({ ...invite, email: '' }); loadMembers() }
  }

  const addCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newCompany.trn && !isValidTrn(newCompany.trn)) return toast.error('A UAE TRN has 15 digits')
    await act('company', async () => {
      const res = await createCompany({ name: newCompany.name, trn: newCompany.trn || undefined, emirate: 'Dubai' })
      await onCompaniesChanged(res.company.id)
    }, 'Company created')
  }

  return (
    <div className="grid gap-6 fade-in lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-6">
        <form onSubmit={saveProfile} className="card space-y-4 p-5">
          <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-gold-600" /><h3 className="font-display text-lg font-semibold">Company details</h3></div>
          <div>
            <label className="label">Legal name</label>
            <input className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} disabled={!isOwner} required />
          </div>
          <div>
            <label className="label">Company TRN</label>
            <input className="input font-mono" value={profile.trn} onChange={(e) => setProfile({ ...profile, trn: e.target.value })} disabled={!isOwner} placeholder="15 digits" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Emirate</label>
              <select className="input" value={profile.emirate} onChange={(e) => setProfile({ ...profile, emirate: e.target.value })} disabled={!isOwner}>
                {emirates.map((em) => <option key={em}>{em}</option>)}
              </select>
            </div>
            <div>
              <label className="label">VAT quarters end</label>
              <select className="input" value={profile.vat_quarter_start_month} onChange={(e) => setProfile({ ...profile, vat_quarter_start_month: Number(e.target.value) })} disabled={!isOwner}>
                {[1, 2, 3].map((m) => <option key={m} value={m}>Start {QUARTER_STARTS[m]}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-night-500">Your quarters come from your FTA registration certificate.</p>
          {isOwner && <button disabled={busy === 'profile'} className="btn-primary w-full">{busy === 'profile' && <Loader2 className="h-4 w-4 animate-spin" />} Save details</button>}
        </form>

        <form onSubmit={addCompany} className="card space-y-3 p-5">
          <h3 className="font-display text-lg font-semibold">Add another company</h3>
          <p className="text-sm text-night-500">Run a second trade licence, or keep books for clients? Each company gets its own receipts and VAT quarters.</p>
          <input className="input" value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} placeholder="Company name" required />
          <input className="input font-mono" value={newCompany.trn} onChange={(e) => setNewCompany({ ...newCompany, trn: e.target.value })} placeholder="TRN (optional)" />
          <button disabled={busy === 'company'} className="btn-ghost w-full"><Plus className="h-4 w-4" /> Create company</button>
        </form>
      </div>

      <div className="space-y-6">
        <div className="card p-5">
          <h3 className="font-display text-lg font-semibold">People</h3>
          <div className="mt-3 divide-y divide-sand-200">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-night-900 text-sm font-semibold text-gold-200">
                  {(m.user.name || m.user.email).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.user.name || m.user.email}{m.user.id === user.id && <span className="text-night-400"> (you)</span>}</div>
                  <div className="truncate text-xs text-night-500">{m.user.is_guest ? 'Demo account' : m.user.email}</div>
                </div>
                {isOwner && m.user.id !== user.id ? (
                  <>
                    <select className="input w-auto py-1.5 text-xs" value={m.role} onChange={(e) => act(`role-${m.id}`, () => updateMemberRole(m.id, e.target.value as Role), 'Role updated').then(loadMembers)}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <button onClick={() => act(`rm-${m.id}`, () => removeMember(m.id), 'Removed').then(loadMembers)} className="rounded-lg p-2 text-night-400 hover:bg-clay-50 hover:text-clay-600" title="Remove"><Trash2 className="h-4 w-4" /></button>
                  </>
                ) : (
                  <span className="chip bg-sand-100 text-night-700">{ROLE_LABELS[m.role]}</span>
                )}
              </div>
            ))}
            {invites.map((i) => (
              <div key={`i-${i.id}`} className="flex items-center gap-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-sand-400"><Mail className="h-4 w-4 text-sand-500" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{i.email}</div>
                  <div className="text-xs text-night-500">Invited as {ROLE_LABELS[i.role].toLowerCase()} · joins on sign-up</div>
                </div>
                <button onClick={() => act(`ci-${i.id}`, () => cancelInvite(i.id), 'Invite cancelled').then(loadMembers)} className="text-xs font-semibold text-night-500 hover:text-clay-600">Cancel</button>
              </div>
            ))}
          </div>
        </div>

        {isOwner && (
          <form onSubmit={sendInvite} className="card space-y-4 p-5">
            <div className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-gold-600" /><h3 className="font-display text-lg font-semibold">Invite someone</h3></div>
            <input type="email" className="input" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="accountant@firm.ae" required />
            <div className="grid gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <button type="button" key={r} onClick={() => setInvite({ ...invite, role: r })} className={`rounded-xl border p-3 text-left transition ${invite.role === r ? 'border-gold-400 bg-gold-50 ring-2 ring-gold-100' : 'border-sand-200 hover:bg-sand-50'}`}>
                  <div className="text-sm font-semibold">{ROLE_LABELS[r]}</div>
                  <div className="mt-0.5 text-xs text-night-500">{ROLE_HINTS[r]}</div>
                </button>
              ))}
            </div>
            <button disabled={busy === 'invite'} className="btn-primary w-full">{busy === 'invite' && <Loader2 className="h-4 w-4 animate-spin" />} Send invite</button>
          </form>
        )}
      </div>
    </div>
  )
}
