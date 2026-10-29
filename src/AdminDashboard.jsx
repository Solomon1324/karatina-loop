import { renderRichText } from './DirectorySections'
import { useCallback, useEffect, useState } from 'react'

function fmt(value) {
  if (!value) return 'Recently submitted'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}

export default function AdminDashboard({ supabase, user, onClose, onDataChanged, notify }) {
  const [tab, setTab] = useState('groups')
  const [queues, setQueues] = useState({ groups: [], businesses: [], campus: [], memberships: [] })
  const [profiles, setProfiles] = useState({})
  const [groupNames, setGroupNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')

  const loadQueues = useCallback(async () => {
    if (!supabase) return
    setLoading(true); setError('')
    const [groups, businesses, campus, memberships] = await Promise.all([
      supabase.from('groups').select('id,name,category,description,created_by,created_at').eq('status', 'pending').order('created_at', { ascending: true }),
      supabase.from('business_listings').select('id,name,category,description,location,contact_phone,contact_email,website_url,image_path,submitted_by,created_at').eq('status', 'pending').order('created_at', { ascending: true }),
      supabase.from('campus_information').select('id,kind,title,summary,location,starts_at,contact,link_url,image_path,submitted_by,created_at').eq('status', 'pending').order('created_at', { ascending: true }),
      supabase.from('group_members').select('id,group_id,user_id,requested_at').eq('role', 'member').eq('status', 'pending').order('requested_at', { ascending: true }),
    ])
    const firstError = groups.error || businesses.error || campus.error || memberships.error
    if (firstError) {
      setError('The admin queues could not be loaded. Check the latest SQL migration, that your account is listed in site_admins, and that the admin functions are installed.')
      setLoading(false)
      return
    }
    const signRows = async rows => Promise.all((rows || []).map(async row => {
      if (!row.image_path) return row
      const { data, error: imageError } = await supabase.storage.from('community-media').createSignedUrl(row.image_path, 3600)
      return { ...row, image_url: imageError ? null : data?.signedUrl || null }
    }))
    const [businessRows, campusRows] = await Promise.all([signRows(businesses.data), signRows(campus.data)])
    const next = { groups: groups.data || [], businesses: businessRows, campus: campusRows, memberships: memberships.data || [] }
    setQueues(next)
    const userIds = [...new Set([
      ...next.groups.map(row => row.created_by), ...next.businesses.map(row => row.submitted_by),
      ...next.campus.map(row => row.submitted_by), ...next.memberships.map(row => row.user_id),
    ].filter(Boolean))]
    const groupIds = [...new Set(next.memberships.map(row => row.group_id).filter(Boolean))]
    const [profileResult, groupResult] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id,display_name').in('id', userIds) : Promise.resolve({ data: [], error: null }),
      groupIds.length ? supabase.from('groups').select('id,name').in('id', groupIds) : Promise.resolve({ data: [], error: null }),
    ])
    setProfiles(Object.fromEntries((profileResult.data || []).map(row => [row.id, row.display_name])))
    setGroupNames(Object.fromEntries((groupResult.data || []).map(row => [row.id, row.name])))
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadQueues() }, [loadQueues])

  async function perform(key, action) {
    setWorking(key)
    try {
      const result = await action()
      if (result?.error) throw result.error
      notify('Action completed successfully.')
      await loadQueues()
      onDataChanged?.()
    } catch (err) {
      notify(err?.message || 'That action failed. Check your admin permissions and SQL migrations.')
    } finally { setWorking('') }
  }
  function reviewGroup(row, approve) {
    return perform(`group:${row.id}`, () => supabase.rpc('review_group_proposal', { target_group_id: row.id, approve }))
  }
  function reviewBusiness(row, approve) {
    return perform(`business:${row.id}`, () => supabase.rpc('review_business_listing', { target_listing_id: row.id, approve }))
  }
  function reviewCampus(row, approve) {
    return perform(`campus:${row.id}`, () => supabase.rpc('review_campus_information', { target_information_id: row.id, approve }))
  }
  function reviewMember(row, approve) {
    return perform(`member:${row.id}`, () => supabase.rpc('review_group_membership', { target_group_id: row.group_id, target_user_id: row.user_id, approve }))
  }
  const count = key => queues[key].length
  const nameFor = id => profiles[id] || `User ${String(id || '').slice(0, 8)}`

  return <div className="veil" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="dialog admin-dialog" role="dialog" aria-modal="true" aria-labelledby="adminTitle">
    <button className="close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">Secure review area · signed in as {user?.email || 'site admin'}</span><h2 id="adminTitle">Admin dashboard</h2><p className="muted">Review submissions and manage membership requests. Supabase permissions—not this screen—decide who can approve content.</p>
    <div className="tabs admin-tabs"><button className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>Groups ({count('groups')})</button><button className={tab === 'businesses' ? 'active' : ''} onClick={() => setTab('businesses')}>Businesses ({count('businesses')})</button><button className={tab === 'campus' ? 'active' : ''} onClick={() => setTab('campus')}>Campus info ({count('campus')})</button><button className={tab === 'memberships' ? 'active' : ''} onClick={() => setTab('memberships')}>Join requests ({count('memberships')})</button></div>
    {error && <p className="preview-note" role="alert">{error}</p>}
    {loading ? <p className="muted">Loading review queues…</p> : <div className="admin-list">
      {tab === 'groups' && (queues.groups.length ? queues.groups.map(row => <article className="admin-item" key={row.id}><div><b>{row.name}</b><span>{row.category} · submitted by {nameFor(row.created_by)} · {fmt(row.created_at)}</span><p>{row.description}</p></div><div className="admin-actions"><button className="button button-primary small" disabled={Boolean(working)} onClick={() => reviewGroup(row, true)}>{working === `group:${row.id}` ? 'Saving…' : 'Approve'}</button><button className="button button-outline small" disabled={Boolean(working)} onClick={() => reviewGroup(row, false)}>Decline</button></div></article>) : <div className="empty-state">No group proposals need review.</div>)}
      {tab === 'businesses' && (queues.businesses.length ? queues.businesses.map(row => <article className="admin-item" key={row.id}><div><b>{row.name}</b><span>{row.category} · {row.location} · submitted by {nameFor(row.submitted_by)} · {fmt(row.created_at)}</span><p className="rich-text">{renderRichText(row.description)}</p>{row.image_url && <img className="admin-submission-photo" src={row.image_url} alt={`Photo for ${row.name}`} loading="lazy" />}<small>{[row.contact_phone, row.contact_email, row.website_url].filter(Boolean).join(' · ') || 'No contact details provided'}</small></div><div className="admin-actions"><button className="button button-primary small" disabled={Boolean(working)} onClick={() => reviewBusiness(row, true)}>{working === `business:${row.id}` ? 'Saving…' : 'Approve'}</button><button className="button button-outline small" disabled={Boolean(working)} onClick={() => reviewBusiness(row, false)}>Decline</button></div></article>) : <div className="empty-state">No business listings need review.</div>)}
      {tab === 'campus' && (queues.campus.length ? queues.campus.map(row => <article className="admin-item" key={row.id}><div><b>{row.title}</b><span>{row.kind} · submitted by {nameFor(row.submitted_by)} · {fmt(row.created_at)}</span><p className="rich-text">{renderRichText(row.summary)}</p>{row.image_url && <img className="admin-submission-photo" src={row.image_url} alt={`Photo for ${row.title}`} loading="lazy" />}<small>{[row.location, row.starts_at ? fmt(row.starts_at) : null, row.contact, row.link_url].filter(Boolean).join(' · ')}</small></div><div className="admin-actions"><button className="button button-primary small" disabled={Boolean(working)} onClick={() => reviewCampus(row, true)}>{working === `campus:${row.id}` ? 'Saving…' : 'Approve'}</button><button className="button button-outline small" disabled={Boolean(working)} onClick={() => reviewCampus(row, false)}>Decline</button></div></article>) : <div className="empty-state">No campus information needs review.</div>)}
      {tab === 'memberships' && (queues.memberships.length ? queues.memberships.map(row => <article className="admin-item" key={row.id}><div><b>{nameFor(row.user_id)}</b><span>Requests to join {groupNames[row.group_id] || 'a group'} · {fmt(row.requested_at)}</span></div><div className="admin-actions"><button className="button button-primary small" disabled={Boolean(working)} onClick={() => reviewMember(row, true)}>{working === `member:${row.id}` ? 'Saving…' : 'Approve'}</button><button className="button button-outline small" disabled={Boolean(working)} onClick={() => reviewMember(row, false)}>Decline</button></div></article>) : <div className="empty-state">No membership requests need review.</div>)}
    </div>}
    <div className="dialog-actions"><button className="button button-outline small" onClick={loadQueues} disabled={loading || Boolean(working)}>Refresh queues</button><span className="member-count">Refreshing does not change approval decisions.</span></div>
  </section></div>
}
