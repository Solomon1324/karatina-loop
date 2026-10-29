import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { BusinessSection, CampusSection } from './DirectorySections'
import GroupDialog from './GroupDialog'
import AdminDashboard from './AdminDashboard'
import ProfileDialog from './ProfileDialog'

const sampleGroups = [
  { id: 'computing', name: 'Karatina Computing Society', category: 'Academic', description: 'Coding, tech projects, study circles and career tips.', emoji: '💻', tone: 'sage' },
  { id: 'entrepreneurs', name: 'Karatina Entrepreneurs', category: 'Business', description: 'Share business ideas, promote student ventures and learn together.', emoji: '💡', tone: 'peach' },
  { id: 'sports', name: 'Campus Football & Sports', category: 'Sports', description: 'Find teammates, organise games and follow campus sports.', emoji: '⚽', tone: 'blue' },
  { id: 'creatives', name: 'Karatina Creatives', category: 'Hobbies', description: 'A home for photography, music, art and design.', emoji: '🎨', tone: 'lilac' },
  { id: 'hostel', name: 'Hostel Life & Roommates', category: 'Hostel life', description: 'Share practical tips and connect with fellow residents.', emoji: '🏠', tone: 'rose' },
  { id: 'study', name: 'Study Buddies', category: 'Academic', description: 'Find study partners, swap revision tips and plan sessions.', emoji: '📚', tone: 'sand' },
]
const categories = ['All groups', 'Academic', 'Business', 'Sports', 'Hobbies', 'Hostel life']
const tones = ['sage', 'peach', 'blue', 'lilac', 'rose', 'sand']
const emojis = ['💻', '💡', '⚽', '🎨', '🏠', '📚']

function GroupCard({ group, pending, membership, onOpen, onJoin, isDemo }) {
  const approved = membership?.status === 'approved'
  const requestPending = pending || membership?.status === 'pending'
  return <article className="group-card">
    <div className={`group-art ${group.tone || 'sage'}`}><span className="tag">{isDemo ? 'Example · ' : ''}{group.category}</span><span className="group-emoji">{group.emoji || '✳️'}</span></div>
    <div className="group-content"><h3>{group.name}</h3><p>{group.description}</p>
      <div className="card-meta"><span>{isDemo ? 'Sample group' : group.members != null ? `${group.members} members` : 'Membership by approval'}</span><strong>Posts + chat</strong></div>
      <div className="card-actions"><button className="button button-primary small" onClick={() => onOpen(group)}>Open group</button><button className="button button-outline small" disabled={isDemo || requestPending || approved} onClick={() => onJoin(group)}>{approved ? 'Joined' : requestPending ? 'Request pending' : 'Request to join'}</button></div>
    </div>
  </article>
}

function AuthDialog({ mode, setMode, onClose, onSubmit, onGoogle, busy }) {
  return <div className="veil" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="authTitle">
    <button className="close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">Welcome to the community</span><h2 id="authTitle">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
    <p className="muted">Sign-up is open to everyone. Email accounts may need to verify their address before signing in.</p>
    <div className="auth-tabs"><button className={mode === 'signup' ? 'selected' : ''} onClick={() => setMode('signup')}>Create account</button><button className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')}>Sign in</button></div>
    <form onSubmit={onSubmit} className="form-stack">
      {mode === 'signup' && <label>Your name<input name="name" required autoComplete="name" maxLength="80" placeholder="Name shown to members" /></label>}
      <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
      <label>Password<input name="password" type="password" required minLength="8" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="At least 8 characters" /></label>
      <button className="button button-primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} <span>↗</span></button>
    </form>
    <div className="or"><span>or</span></div><button className="button google full" onClick={onGoogle} disabled={busy}><b>G</b> Continue with Google</button>
    <p className="privacy-note">Only approved members can contribute to a group's posts or chat.</p>
  </section></div>
}

function RequestDialog({ onClose, onSubmit, saving }) {
  return <div className="veil" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="requestTitle">
    <button className="close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">New community idea</span><h2 id="requestTitle">Propose a group</h2><p className="muted">A site admin reviews each proposal. If it is approved, you become its first group admin and can approve membership requests.</p>
    <form className="form-stack" onSubmit={onSubmit}><label>Group name<input name="groupName" required minLength="2" maxLength="80" placeholder="e.g. Karatina Nature Club" /></label><label>Category<select name="category"><option>Academic</option><option>Business</option><option>Sports</option><option>Hobbies</option><option>Hostel life</option><option>Other</option></select></label><label>What is the group for?<textarea name="description" required minLength="10" maxLength="600" placeholder="What would members share or do together?" /></label><button className="button button-primary full" disabled={saving}>{saving ? 'Submitting…' : 'Submit for admin review ↗'}</button></form>
  </section></div>
}

export default function App() {
  const [groups, setGroups] = useState(() => isSupabaseConfigured ? [] : sampleGroups)
  const [groupCounts, setGroupCounts] = useState({})
  const [groupsLoading, setGroupsLoading] = useState(isSupabaseConfigured)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All groups')
  const [selected, setSelected] = useState(null)
  const [showRequest, setShowRequest] = useState(false)
  const [proposalSaving, setProposalSaving] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('signup')
  const [showAdmin, setShowAdmin] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [isSiteAdmin, setIsSiteAdmin] = useState(false)
  const [memberships, setMemberships] = useState({})
  const [contentRefreshKey, setContentRefreshKey] = useState(0)
  const [user, setUser] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const isDemo = !isSupabaseConfigured
  const notify = useCallback(message => setNotice(message), [])
  const visibleGroups = useMemo(() => groups.filter(g => (category === 'All groups' || g.category === category) && `${g.name} ${g.category} ${g.description}`.toLowerCase().includes(query.toLowerCase())), [groups, category, query])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) return undefined
    let active = true
    supabase.auth.getSession().then(({ data }) => { if (active) setUser(data.session?.user ?? null) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const loadGroups = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return
    setGroupsLoading(true)
    const [groupResult, countResult] = await Promise.all([
      supabase.from('groups').select('id,name,category,description,status,created_at').eq('status', 'approved').order('created_at', { ascending: false }),
      user ? supabase.rpc('get_approved_group_counts') : Promise.resolve({ data: null, error: null }),
    ])
    const { data, error } = groupResult
    const { data: counts, error: countError } = countResult
    if (error) {
      setGroups([])
      notify('Could not load live groups. Check that the database migrations were applied in order.')
    } else {
      setGroups((data || []).map((g, i) => ({ ...g, emoji: emojis[i % emojis.length], tone: tones[i % tones.length] })))
    }
    if (!countError && counts) setGroupCounts(Object.fromEntries(counts.map(row => [row.group_id, Number(row.member_count)])))
    setGroupsLoading(false)
  }, [notify, user?.id])

  useEffect(() => { loadGroups() }, [loadGroups])

  const loadMemberships = useCallback(async () => {
    if (!supabase || !user) { setMemberships({}); return }
    const { data, error } = await supabase.from('group_members').select('group_id,user_id,role,status').eq('user_id', user.id)
    if (error) { notify('Could not load your group memberships.'); return }
    setMemberships(Object.fromEntries((data || []).map(row => [row.group_id, row])))
  }, [notify, user?.id])

  useEffect(() => { loadMemberships() }, [loadMemberships])

  const refreshContent = useCallback(() => {
    setContentRefreshKey(value => value + 1)
    loadGroups()
    loadMemberships()
  }, [loadGroups, loadMemberships])

  useEffect(() => {
    let active = true
    if (!supabase || !user) { setIsSiteAdmin(false); return undefined }
    supabase.rpc('is_site_admin').then(({ data, error }) => {
      if (!active) return
      setIsSiteAdmin(!error && data === true)
    })
    return () => { active = false }
  }, [user?.id])

  async function requestJoin(group) {
    if (!user) { setAuthMode('signup'); setShowAuth(true); notify('Create an account or sign in before requesting to join a group.'); return }
    if (!supabase || !isSupabaseConfigured || isDemo) { notify('Connect Supabase before requesting membership.'); return }
    const { error } = await supabase.rpc('request_group_membership', { target_group_id: group.id })
    if (error) { notify(error.message || 'Could not send your membership request.'); return }
    await loadMemberships()
    notify('Membership request sent. A group admin must approve it.')
  }

  async function submitProposal(event) {
    event.preventDefault()
    if (!user) { setAuthMode('signup'); setShowAuth(true); notify('Sign in before proposing a group.'); return }
    if (!supabase || !isSupabaseConfigured) { notify('Connect Supabase before proposing groups.'); return }
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const name = String(form.get('groupName') || '').trim()
    const slug = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
    if (!slug) { notify('Please use a group name containing letters or numbers.'); return }
    setProposalSaving(true)
    const { error } = await supabase.from('groups').insert({ name, slug, category: form.get('category'), description: String(form.get('description') || '').trim(), created_by: user.id, status: 'pending' })
    setProposalSaving(false)
    if (error) { notify(error.message || 'Could not submit group proposal.'); return }
    formElement.reset(); setShowRequest(false); notify('Group proposal sent to the site admin for review.')
  }

  async function submitAuth(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget), email = String(form.get('email') || '').trim(), password = String(form.get('password') || '')
    if (!isSupabaseConfigured || !supabase) { notify('Account service is not connected yet. Configure your public Supabase URL and publishable key.'); return }
    setBusy(true)
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: String(form.get('name') || '').trim() } } })
        if (error) throw error
        if (data.session) { setUser(data.session.user); notify('Account created successfully.') }
        else notify('Account created. Check your email to verify your address before signing in.')
        setShowAuth(false)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setShowAuth(false); notify('Signed in successfully.')
      }
    } catch (error) { notify(error.message || 'Could not sign in. Please try again.') }
    finally { setBusy(false) }
  }

  async function googleSignIn() {
    if (!isSupabaseConfigured || !supabase) { notify('Google sign-in works after the Supabase auth service is configured.'); return }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) notify(error.message)
  }

  async function signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) { notify(error.message || 'Could not sign out.'); return }
    }
    setUser(null); setMemberships({}); setIsSiteAdmin(false); setShowAdmin(false); notify('Signed out.')
  }

  const selectedMembership = selected ? memberships[selected.id] : null
  return <>
    <header className="topbar"><div className="shell nav"><a className="brand" href="#top"><span className="brand-mark">K</span>Karatina Loop</a><nav><a href="#groups">Groups</a><a href="#businesses">Businesses</a><a href="#campus-info">Campus info</a></nav><div className="nav-actions">{user ? <><button className="button button-outline small" onClick={() => setShowProfile(true)}>My Profile</button><span className="signed-in-status">Signed in</span>{isSiteAdmin && <button className="button button-outline small" onClick={() => setShowAdmin(true)}>Admin dashboard</button>}<button className="button button-primary small" onClick={signOut}>Sign out</button></> : <button className="button button-primary small" onClick={() => { setAuthMode('signup'); setShowAuth(true) }}>Sign in / join ↗</button>}</div></div></header>
    <main id="top" className="shell"><section className="hero"><div><span className="eyebrow"><i className="live-dot" /> Karatina University, Kenya · open community</span><h1>One campus.<br />Room for every <em>community.</em></h1><p className="hero-copy">Find your people, join a group, share what’s happening, and discover student businesses and useful campus information—all in one place.</p><p className="open-note">Open sign-up for everyone <span>·</span> Group admins approve join requests</p><div className="hero-actions"><a className="button button-primary" href="#groups">Explore groups ↓</a><button className="button button-outline" onClick={() => { if (!user) { setAuthMode('signup'); setShowAuth(true); notify('Sign in before proposing a group.') } else setShowRequest(true) }}>Start a group</button></div><div className="scope-proof"><span>Community groups</span><span>Student businesses</span><span>Campus information</span></div></div>
      <div className="hero-scene" aria-label="Illustration of a campus"><div className="sun"/><div className="building"><div className="windows">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</div><div className="door"/></div><span className="tree left">🌳</span><span className="tree right">🌳</span><div className="lawn"/><div className="scene-badge">✳ Built around student communities</div><div className="scene-count"><small>COMMUNITY GOAL</small><b>10,000+</b><span>aspirational reach · not current users</span></div></div>
    </section>
    <div className="goal-note"><b>Built for the campus community:</b> discover groups, support student businesses and share useful campus information. Listings and activity come from real submissions, not invented contacts or announcements.</div>
    <section id="groups" className="section"><div className="section-head"><div><span className="eyebrow">Find your people</span><h2>Explore campus groups.</h2><p className="muted">Read public group activity. Approved members can post and chat, and group admins can approve join requests.</p></div><label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search groups or interests" aria-label="Search groups" /></label></div><div className="filters">{categories.map(c => <button key={c} className={`filter ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>)}</div>
      {groupsLoading ? <p className="muted">Loading groups…</p> : <div className="group-grid">{visibleGroups.map(g => <GroupCard key={g.id} group={{ ...g, members: groupCounts[g.id] }} pending={memberships[g.id]?.status === 'pending'} membership={memberships[g.id]} onOpen={setSelected} onJoin={requestJoin} isDemo={isDemo} />)}{!visibleGroups.length && <div className="empty-state">{isDemo ? 'This is a sample preview. Connect Supabase to create real groups and use membership, posts and chat.' : 'No approved groups match your search yet. Sign in and propose a new group.'}</div>}</div>}
      {isDemo && <p className="preview-note">Preview mode: these example groups are not real listings. Connect the app to Supabase and apply the database migrations to enable actual membership, posts, chat and uploads.</p>}
      {!isDemo && <div className="section-actions"><button className="button button-outline" onClick={() => { if (!user) { setAuthMode('signup'); setShowAuth(true) } else setShowRequest(true) }}>Propose a group ↗</button><button className="button button-outline" onClick={loadGroups}>Refresh groups</button></div>}
    </section>
    <BusinessSection supabase={supabase} user={user} refreshKey={contentRefreshKey} onNeedSignIn={() => { setAuthMode('signup'); setShowAuth(true) }} notify={notify} />
    <CampusSection supabase={supabase} user={user} refreshKey={contentRefreshKey} onNeedSignIn={() => { setAuthMode('signup'); setShowAuth(true) }} notify={notify} />
    <section className="join-band"><div><span className="eyebrow">Have an idea for a community?</span><h2>Propose a group.</h2><p>Admins review proposals. Approved proposers become their group admins.</p></div><button className="button button-lime" onClick={() => { if (!user) { setAuthMode('signup'); setShowAuth(true) } else setShowRequest(true) }}>Request a group ↗</button></section></main>
    <footer className="footer"><div className="shell footer-inner"><a className="brand" href="#top"><span className="brand-mark">K</span>Karatina Loop</a><span>Student community project · {new Date().getFullYear()}</span><div><a href="#groups">Groups</a><a href="#businesses">Businesses</a><a href="#campus-info">Campus info</a></div></div></footer>
    {showAuth && <AuthDialog mode={authMode} setMode={setAuthMode} onClose={() => setShowAuth(false)} onSubmit={submitAuth} onGoogle={googleSignIn} busy={busy} />}
    {showProfile && user && <ProfileDialog supabase={supabase} user={user} onClose={() => setShowProfile(false)} notify={notify} />}
    {showRequest && <RequestDialog onClose={() => setShowRequest(false)} onSubmit={submitProposal} saving={proposalSaving} />}
    {showAdmin && isSiteAdmin && <AdminDashboard supabase={supabase} user={user} onClose={() => setShowAdmin(false)} onDataChanged={refreshContent} notify={notify} />}
    {selected && <GroupDialog group={selected} user={user} membership={selectedMembership} supabase={supabase} onRequestJoin={requestJoin} onClose={() => setSelected(null)} notify={notify} onMembershipChange={() => { loadMemberships(); loadGroups() }} />}
    {notice && <div className="toast" role="status">{notice}</div>}
  </>
}
