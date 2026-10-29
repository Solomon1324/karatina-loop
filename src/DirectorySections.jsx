import { useCallback, useEffect, useMemo, useState } from 'react'
import ProfileAvatar from './ProfileAvatar'

const businessCategories = ['Food', 'Printing', 'Fashion', 'Beauty', 'Technology', 'Tutoring', 'Transport', 'Other']
const campusKinds = [
  { value: 'notice', label: 'Notice' }, { value: 'event', label: 'Event' },
  { value: 'place', label: 'Place or service' }, { value: 'resource', label: 'Student resource' },
]
const icons = { notice: '📢', event: '🗓️', place: '📍', resource: '🤝' }
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const EMOJIS = ['😀', '😂', '🥹', '😍', '🥰', '😎', '🤔', '😭', '🙌', '👏', '👍', '❤️', '🔥', '🎉', '💯', '✨', '💚', '🙏', '🤝', '👀', '💡', '📚', '💻', '⚽']
const STICKERS = [
  { emoji: '🫶', label: 'Much love' }, { emoji: '🥹', label: 'So proud' }, { emoji: '🔥', label: 'Fire' },
  { emoji: '🎉', label: 'Celebrate' }, { emoji: '😂', label: 'LOL' }, { emoji: '💚', label: 'Green heart' },
  { emoji: '🚀', label: 'Let’s go' }, { emoji: '💯', label: '100 percent' }, { emoji: '🌻', label: 'Good vibes' },
  { emoji: '🎓', label: 'Campus life' }, { emoji: '💻', label: 'Tech time' }, { emoji: '🤝', label: 'Teamwork' },
]
const REACTIONS = ['👍', '❤️', '😂', '🔥', '👏', '🎉', '🥰', '😮']

const socialConfig = {
  business: {
    commentsTable: 'business_listing_comments',
    reactionsTable: 'business_listing_reactions',
    itemKey: 'business_id',
    uploadFolder: 'businesses',
    commentFolder: 'business-comments',
  },
  campus: {
    commentsTable: 'campus_information_comments',
    reactionsTable: 'campus_information_reactions',
    itemKey: 'campus_information_id',
    uploadFolder: 'campus',
    commentFolder: 'campus-comments',
  },
}

function safeHttpUrl(value) {
  if (!value) return null
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}
function displayTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
}
function appendText(current, value) {
  return `${current}${current && !/\s$/.test(current) ? ' ' : ''}${value}`
}
function removeStickerMarkup(value) {
  return String(value || '').replace(/\[\[sticker:[^\]]+\]\]/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
function RemoveStickersButton({ value, onRemove }) {
  if (!/\[\[sticker:[^\]]+\]\]/.test(value || '')) return null
  return <button type="button" className="remove-stickers-button" onClick={onRemove}>Remove stickers</button>
}
function useSiteAdmin(supabase, user) {
  const [isSiteAdmin, setIsSiteAdmin] = useState(false)
  useEffect(() => {
    if (!supabase || !user?.id) { setIsSiteAdmin(false); return undefined }
    let cancelled = false
    supabase.rpc('is_site_admin').then(({ data, error }) => {
      if (!cancelled) setIsSiteAdmin(!error && data === true)
    }).catch(() => { if (!cancelled) setIsSiteAdmin(false) })
    return () => { cancelled = true }
  }, [supabase, user?.id])
  return isSiteAdmin
}
export function renderRichText(value) {
  if (!value) return null
  const allowed = new Set(STICKERS.map(item => item.emoji))
  return String(value).split(/(\[\[sticker:[^\]]+\]\])/g).map((part, index) => {
    const match = part.match(/^\[\[sticker:([^\]]+)\]\]$/)
    if (match && allowed.has(match[1])) return <span className="inline-sticker" role="img" aria-label="Sticker" key={`sticker-${index}`}>{match[1]}</span>
    return part ? <span key={`text-${index}`}>{part}</span> : null
  })
}

function EmojiStickerPicker({ disabled, onEmoji, onSticker, compact = false }) {
  const [open, setOpen] = useState('')
  return <div className={`social-picker${compact ? ' social-picker-compact' : ''}`}>
    <button type="button" className="social-picker-trigger" disabled={disabled} aria-expanded={open === 'emoji'} onClick={() => setOpen(open === 'emoji' ? '' : 'emoji')}>😊 Emoji</button>
    <button type="button" className="social-picker-trigger" disabled={disabled} aria-expanded={open === 'sticker'} onClick={() => setOpen(open === 'sticker' ? '' : 'sticker')}>✨ Stickers</button>
    {open && <div className={`emoji-sticker-tray ${open === 'sticker' ? 'sticker-tray' : ''}`} role="group" aria-label={open === 'emoji' ? 'Choose an emoji' : 'Choose a sticker'}>
      {open === 'emoji' ? <div className="emoji-grid">{EMOJIS.map(emoji => <button type="button" className="emoji-option" key={emoji} aria-label={`Insert ${emoji}`} onClick={() => { onEmoji(emoji); setOpen('') }}>{emoji}</button>)}</div>
        : <div className="sticker-grid">{STICKERS.map(sticker => <button type="button" className="sticker-option" key={sticker.emoji} title={sticker.label} onClick={() => { onSticker(sticker.emoji); setOpen('') }}><span>{sticker.emoji}</span><small>{sticker.label}</small></button>)}</div>}
    </div>}
  </div>
}

function PhotoPicker({ disabled, file, onChange, onClear, compact = false, label = '📷 Add a photo' }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [validationError, setValidationError] = useState('')
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return undefined }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  function pick(event) {
    const picked = event.target.files?.[0] || null
    event.target.value = ''
    if (!picked) return
    if (!IMAGE_TYPES.has(picked.type)) { setValidationError('Choose a JPEG, PNG, WebP or GIF image.'); return }
    if (picked.size > MAX_IMAGE_BYTES) { setValidationError('Choose an image of 8 MB or smaller.'); return }
    setValidationError('')
    onChange(picked)
  }
  return <div className="photo-picker-wrap">
    <label className={`photo-picker${compact ? ' chat-photo' : ''}`}>
      {label}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled} onChange={pick} />
    </label>
    {file && <span className="selected-photo">{previewUrl && <img className="photo-picker-preview" src={previewUrl} alt="Selected photo preview" />}<span>{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</span><button type="button" className="remove-photo" onClick={onClear} aria-label="Remove selected photo">×</button></span>}
    {validationError && <small className="media-validation-error" role="alert">{validationError}</small>}
  </div>
}

async function uploadCommunityPhoto(supabase, user, file, folder) {
  if (!file) return null
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, WebP or GIF image.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 8 MB or smaller.')
  if (!user) throw new Error('Sign in before uploading a photo.')
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('community-media').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return path
}

async function signMediaPaths(supabase, paths) {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  const pairs = await Promise.all(uniquePaths.map(async path => {
    const { data, error } = await supabase.storage.from('community-media').createSignedUrl(path, 3600)
    return [path, error ? null : data?.signedUrl || null]
  }))
  return Object.fromEntries(pairs)
}

async function loadDirectorySocial(supabase, scope, items) {
  const config = socialConfig[scope]
  if (!items.length) return { socialByItem: {}, imageUrls: {}, error: '' }
  const ids = items.map(item => item.id)
  const [commentResult, reactionResult] = await Promise.all([
    supabase.from(config.commentsTable).select(`id,${config.itemKey},author_id,body,image_path,created_at,profiles:profiles(display_name, avatar_url)`).in(config.itemKey, ids).order('created_at', { ascending: true }),
    supabase.from(config.reactionsTable).select(`id,${config.itemKey},user_id,emoji`).in(config.itemKey, ids),
  ])
  const comments = commentResult.data || []
  const reactions = reactionResult.data || []
  const socialByItem = Object.fromEntries(items.map(item => [item.id, {
    comments: comments.filter(comment => comment[config.itemKey] === item.id),
    reactions: reactions.filter(reaction => reaction[config.itemKey] === item.id),
  }]))
  const imageUrls = await signMediaPaths(supabase, [
    ...items.map(item => item.image_path),
    ...comments.map(comment => comment.image_path),
  ])
  const error = commentResult.error || reactionResult.error ? 'Some comments or reactions could not be loaded. Refresh the section or check Supabase permissions.' : ''
  return { socialByItem, imageUrls, error }
}

function DirectorySocialInteractions({ scope, item, social = { comments: [], reactions: [] }, imageUrls = {}, supabase, user, isSiteAdmin = false, onNeedSignIn, onReload }) {
  const config = socialConfig[scope]
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [photo, setPhoto] = useState(null)
  const [sending, setSending] = useState(false)
  const [busyReaction, setBusyReaction] = useState('')
  const [error, setError] = useState('')
  const comments = social.comments || []
  const reactions = social.reactions || []

  async function toggleReaction(emoji) {
    if (!user) { onNeedSignIn?.(); return }
    if (!supabase) { setError('Connect Supabase before reacting.'); return }
    setBusyReaction(emoji); setError('')
    const existing = reactions.find(reaction => reaction.user_id === user.id && reaction.emoji === emoji)
    try {
      const result = existing
        ? await supabase.from(config.reactionsTable).delete().eq('id', existing.id)
        : await supabase.from(config.reactionsTable).insert({ [config.itemKey]: item.id, user_id: user.id, emoji })
      if (result.error) throw result.error
      await onReload?.()
    } catch (err) { setError(err?.message || 'Your reaction could not be saved.') }
    finally { setBusyReaction('') }
  }

  async function submitComment(event) {
    event.preventDefault()
    if (!user) { onNeedSignIn?.(); return }
    const body = draft.trim()
    if (!body && !photo) return
    setSending(true); setError('')
    let imagePath = null
    try {
      imagePath = await uploadCommunityPhoto(supabase, user, photo, config.commentFolder)
      const result = await supabase.from(config.commentsTable).insert({ [config.itemKey]: item.id, author_id: user.id, body, image_path: imagePath })
      if (result.error) {
        if (imagePath) await supabase.storage.from('community-media').remove([imagePath])
        throw result.error
      }
      setDraft(''); setPhoto(null)
      await onReload?.()
    } catch (err) { setError(err?.message || 'Your comment could not be published.') }
    finally { setSending(false) }
  }

  async function deleteComment(comment) {
    if (!(comment.author_id === user?.id || isSiteAdmin)) return
    if (!window.confirm('Delete this comment? This cannot be undone.')) return
    setError('')
    try {
      const result = await supabase.from(config.commentsTable).delete().eq('id', comment.id).select('id').maybeSingle()
      if (result.error) throw result.error
      if (!result.data) throw new Error('Comment was not deleted. Check that you own it or are a site admin.')
      if (comment.image_path) {
        const { error: storageError } = await supabase.storage.from('community-media').remove([comment.image_path])
        if (storageError) setError('Comment deleted, but its uploaded photo could not be removed from storage.')
      }
      await onReload?.()
    } catch (err) { setError(err?.message || 'Could not delete this comment.') }
  }

  async function removeCommentPhoto(comment) {
    if (!comment.image_path || !comment.body?.trim() || !(comment.author_id === user?.id || isSiteAdmin)) return
    if (!window.confirm('Remove the photo from this comment? The comment text will stay.')) return
    setError('')
    try {
      const result = await supabase.from(config.commentsTable).update({ image_path: null }).eq('id', comment.id).select('id').maybeSingle()
      if (result.error) throw result.error
      if (!result.data) throw new Error('Photo was not changed. Check your permissions.')
      const { error: storageError } = await supabase.storage.from('community-media').remove([comment.image_path])
      await onReload?.()
      if (storageError) setError('The photo was detached from the comment, but its stored file could not be deleted.')
    } catch (err) { setError(err?.message || 'Could not remove the photo.') }
  }

  return <div className="directory-social" aria-label="Reactions and comments">
    <div className="reaction-row" aria-label="Reactions">
      {REACTIONS.map(emoji => {
        const count = reactions.filter(reaction => reaction.emoji === emoji).length
        const selected = reactions.some(reaction => reaction.user_id === user?.id && reaction.emoji === emoji)
        return <button type="button" key={emoji} className={`reaction-chip${selected ? ' selected' : ''}`} title={user ? `React with ${emoji}` : 'Sign in to react'} disabled={Boolean(busyReaction)} onClick={() => toggleReaction(emoji)}><span>{emoji}</span>{count > 0 && <small>{count}</small>}</button>
      })}
      <button type="button" className="comments-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>💬 {expanded ? 'Hide comments' : `Comments (${comments.length})`}</button>
    </div>
    {expanded && <section className="comments-section" aria-label="Comments">
      <div className="comments-heading">Community conversation <span>{comments.length}</span></div>
      {comments.length ? comments.map(comment => {
        const author = comment.profiles?.display_name || (comment.author_id === user?.id ? 'You' : 'Student')
        const canManageComment = Boolean(user && (comment.author_id === user.id || isSiteAdmin))
        return <article className="comment-item" key={comment.id}>
          <ProfileAvatar profile={comment.profiles} name={author} className="profile-avatar-comment" />
          <div className="comment-content"><div className="comment-meta"><b>{author}</b><small>{displayTime(comment.created_at)}</small></div>
            {comment.body && <p className="rich-text">{renderRichText(comment.body)}</p>}
            {comment.image_path && imageUrls[comment.image_path] && <div className="comment-media"><a href={imageUrls[comment.image_path]} target="_blank" rel="noreferrer"><img className="comment-image" src={imageUrls[comment.image_path]} alt="Photo shared in a comment" loading="lazy" /></a>{canManageComment && comment.body?.trim() && <button type="button" className="content-action-button" onClick={() => removeCommentPhoto(comment)}>Remove photo</button>}</div>}
            {canManageComment && <div className="content-action-row"><button type="button" className="content-action-button danger" onClick={() => deleteComment(comment)}>Delete comment</button></div>}
          </div>
        </article>
      }) : <p className="muted">No comments yet. Start a helpful conversation.</p>}
      {user ? <form className="comment-composer" onSubmit={submitComment}>
        <textarea value={draft} onChange={event => setDraft(event.target.value)} disabled={sending} maxLength={1000} rows={2} placeholder="Write a comment, add an emoji or share a sticker…" />
        <div className="comment-tools">
          <EmojiStickerPicker compact disabled={sending} onEmoji={emoji => setDraft(value => appendText(value, emoji))} onSticker={emoji => setDraft(value => appendText(value, `[[sticker:${emoji}]]`))} />
          <RemoveStickersButton value={draft} onRemove={() => setDraft(removeStickerMarkup(draft))} />
          <PhotoPicker compact disabled={sending} file={photo} onChange={setPhoto} onClear={() => setPhoto(null)} label="📷 Photo" />
          <button type="submit" className="button button-primary small" disabled={sending || (!draft.trim() && !photo)}>{sending ? 'Sending…' : 'Comment'}</button>
        </div>
        <p className="upload-hint">Comments support text, emoji, stickers and photos up to 8 MB.</p>
      </form> : <div className="signin-comment-prompt"><span>Sign in to comment or share a photo.</span><button className="button button-outline small" onClick={onNeedSignIn}>Sign in</button></div>}
      {error && <p className="social-error" role="alert">{error}</p>}
    </section>}
  </div>
}

export function BusinessSection({ supabase, user, refreshKey = 0, onNeedSignIn, notify }) {
  const isSiteAdmin = useSiteAdmin(supabase, user)
  const [items, setItems] = useState([])
  const [socialByItem, setSocialByItem] = useState({})
  const [imageUrls, setImageUrls] = useState({})
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!supabase) { setItems([]); setSocialByItem({}); setImageUrls({}); setError('Connect the site to Supabase to load and submit real business listings.'); if (!quiet) setLoading(false); return }
    if (!quiet) setLoading(true)
    const { data, error: loadError } = await supabase.from('business_listings').select('id,name,category,description,location,contact_phone,contact_email,website_url,image_path,submitted_by,created_at').eq('status', 'approved').order('created_at', { ascending: false })
    if (loadError) { setItems([]); setSocialByItem({}); setImageUrls({}); setError(`Business directory could not load: ${loadError.message}`); if (!quiet) setLoading(false); return }
    const rows = data || []
    const submitterIds = [...new Set(rows.map(row => row.submitted_by).filter(Boolean))]
    let profilesById = {}
    if (submitterIds.length) {
      const { data: profileRows } = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', submitterIds)
      profilesById = Object.fromEntries((profileRows || []).map(profile => [profile.id, profile]))
    }
    const rowsWithProfiles = rows.map(row => ({ ...row, submitter_profile: profilesById[row.submitted_by] || null }))
    setItems(rowsWithProfiles)
    const activity = await loadDirectorySocial(supabase, 'business', rowsWithProfiles)
    setSocialByItem(activity.socialByItem); setImageUrls(activity.imageUrls); setError(activity.error)
    if (!quiet) setLoading(false)
  }, [supabase])
  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => {
    if (!supabase) return undefined
    const channel = supabase.channel('directory-business-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_listings' }, () => { void load({ quiet: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_listing_comments' }, () => { void load({ quiet: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_listing_reactions' }, () => { void load({ quiet: true }) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, load])

  const categories = useMemo(() => ['All', ...new Set(items.map(item => item.category))], [items])
  const visible = items.filter(item => (category === 'All' || item.category === category) && `${item.name} ${item.category} ${item.description} ${item.location}`.toLowerCase().includes(search.toLowerCase()))

  async function submit(event) {
    event.preventDefault()
    if (!user) { onNeedSignIn(); return }
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setSaving(true); setError('')
    let imagePath = null
    try {
      imagePath = await uploadCommunityPhoto(supabase, user, photo, socialConfig.business.uploadFolder)
      const row = { name: String(form.get('name') || '').trim(), category: form.get('category'), description: description.trim(), location: String(form.get('location') || '').trim(), contact_phone: String(form.get('phone') || '').trim() || null, contact_email: String(form.get('email') || '').trim() || null, website_url: safeHttpUrl(String(form.get('website') || '').trim()) || null, image_path: imagePath, submitted_by: user.id, status: 'pending' }
      const { error: saveError } = await supabase.from('business_listings').insert(row)
      if (saveError) { if (imagePath) await supabase.storage.from('community-media').remove([imagePath]); throw saveError }
      formElement.reset(); setDescription(''); setPhoto(null); setShowForm(false)
      notify('Business submitted for review. It will appear publicly after approval.')
    } catch (err) { setError(err?.message || 'Business could not be submitted. Check your connection and try again.') }
    finally { setSaving(false) }
  }

  async function removeDirectoryPhoto(item, table, bucket = 'community-media') {
    if (!item?.image_path || !(item.submitted_by === user?.id || isSiteAdmin)) return
    if (!window.confirm('Remove this listing photo? The listing details will stay.')) return
    setError('')
    try {
      const result = await supabase.from(table).update({ image_path: null }).eq('id', item.id).select('id').maybeSingle()
      if (result.error) throw result.error
      if (!result.data) throw new Error('Photo was not removed. Check that you own this listing or are a site admin.')
      const { error: storageError } = await supabase.storage.from(bucket).remove([item.image_path])
      await load({ quiet: true })
      if (storageError) setError('Photo removed from the listing, but the stored file could not be deleted.')
      else notify('Listing photo removed.')
    } catch (err) { setError(err?.message || 'Could not remove the listing photo.') }
  }

  return <section id="businesses" className="section">
    <div className="section-head"><div><span className="eyebrow">Support a comrade</span><h2>Student businesses.</h2><p className="muted">Discover and promote student-run businesses. Listings appear publicly after review. React and join the conversation on any listing.</p></div><button className="button button-outline" onClick={() => { if (!user) onNeedSignIn(); else setShowForm(value => !value) }}>{showForm ? 'Close form' : 'Suggest a business ↗'}</button></div>
    {showForm && <form className="form-stack directory-form" onSubmit={submit}>
      <h3>Submit a business</h3>
      <label>Business name<input name="name" required minLength="2" maxLength="100" placeholder="Business or service name" /></label>
      <label>Category<select name="category">{businessCategories.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Description<textarea name="description" value={description} onChange={event => setDescription(event.target.value)} required minLength="10" maxLength="1200" placeholder="What do you offer? You can add emojis and stickers." /></label>
      <div className="directory-composer-tools"><EmojiStickerPicker disabled={saving} onEmoji={emoji => setDescription(value => appendText(value, emoji))} onSticker={emoji => setDescription(value => appendText(value, `[[sticker:${emoji}]]`))} /><RemoveStickersButton value={description} onRemove={() => setDescription(removeStickerMarkup(description))} /><PhotoPicker disabled={saving} file={photo} onChange={setPhoto} onClear={() => setPhoto(null)} /><span className="upload-hint">Add a photo, emoji or sticker to your business listing. JPEG, PNG, WebP or GIF · max 8 MB.</span></div>
      <label>Location<input name="location" required maxLength="160" defaultValue="Karatina University area" /></label>
      <label>Phone (optional)<input name="phone" type="tel" maxLength="30" placeholder="Business contact number" /></label>
      <label>Email (optional)<input name="email" type="email" maxLength="254" placeholder="Business email" /></label>
      <label>Website or social link (optional)<input name="website" type="url" maxLength="500" placeholder="https://..." /></label>
      <button className="button button-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit for review'}</button>
    </form>}
    <label className="search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search businesses or services" aria-label="Search businesses" /></label>
    {categories.length > 1 && <div className="filters">{categories.map(value => <button key={value} className={`filter ${category === value ? 'active' : ''}`} onClick={() => setCategory(value)}>{value}</button>)}</div>}
    {error && <p className="preview-note" role="status">{error}</p>}
    {loading ? <p className="muted">Loading approved businesses…</p> : visible.length ? <div className="business-grid">{visible.map(b => <article className="business-card" key={b.id}>
      <div className={`business-art sage${b.image_path && imageUrls[b.image_path] ? ' has-directory-photo' : ''}`}>
        {b.image_path && imageUrls[b.image_path] ? <img className="directory-cover" src={imageUrls[b.image_path]} alt={`${b.name} business`} loading="lazy" /> : <span className="directory-placeholder-icon" aria-hidden="true">🏪</span>}
        <span className="tag">{b.category}</span>
        {b.image_path && user && (b.submitted_by === user.id || isSiteAdmin) && <button type="button" className="media-remove-overlay" onClick={() => removeDirectoryPhoto(b, 'business_listings')} aria-label="Remove business photo">Remove photo</button>}
      </div>
      <div className="business-card-main"><h3>{b.name}</h3>{b.submitter_profile && <div className="directory-submitter"><ProfileAvatar profile={b.submitter_profile} name={b.submitter_profile.display_name} className="profile-avatar-directory" /><span>Shared by <b>{b.submitter_profile.display_name || 'Student'}</b></span></div>}<p className="rich-text">{renderRichText(b.description)}</p><small>📍 {b.location}</small>
        <div className="business-contacts">{b.contact_phone && <a href={`tel:${b.contact_phone}`}>Call business</a>}{b.contact_email && <a href={`mailto:${b.contact_email}`}>Email</a>}{safeHttpUrl(b.website_url) && <a href={safeHttpUrl(b.website_url)} target="_blank" rel="noreferrer">Website / social ↗</a>}</div>
        <DirectorySocialInteractions scope="business" item={b} social={socialByItem[b.id]} imageUrls={imageUrls} supabase={supabase} user={user} isSiteAdmin={isSiteAdmin} onNeedSignIn={onNeedSignIn} onReload={() => load({ quiet: true })} />
      </div>
    </article>)}</div> : <div className="empty-state">{error ? 'Listings will appear when the directory is connected.' : 'No approved businesses yet. Sign in and submit the first listing for review.'}</div>}
  </section>
}

export function CampusSection({ supabase, user, refreshKey = 0, onNeedSignIn, notify }) {
  const isSiteAdmin = useSiteAdmin(supabase, user)
  const [items, setItems] = useState([])
  const [socialByItem, setSocialByItem] = useState({})
  const [imageUrls, setImageUrls] = useState({})
  const [kind, setKind] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState('')
  const [photo, setPhoto] = useState(null)

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!supabase) { setItems([]); setSocialByItem({}); setImageUrls({}); setError('Connect the site to Supabase to load and submit real campus information.'); if (!quiet) setLoading(false); return }
    if (!quiet) setLoading(true)
    const { data, error: loadError } = await supabase.from('campus_information').select('id,kind,title,summary,location,starts_at,ends_at,contact,link_url,image_path,submitted_by,created_at').eq('status', 'approved').order('starts_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    if (loadError) { setItems([]); setSocialByItem({}); setImageUrls({}); setError(`Campus information could not load: ${loadError.message}`); if (!quiet) setLoading(false); return }
    const rows = data || []
    const submitterIds = [...new Set(rows.map(row => row.submitted_by).filter(Boolean))]
    let profilesById = {}
    if (submitterIds.length) {
      const { data: profileRows } = await supabase.from('profiles').select('id,display_name,avatar_url').in('id', submitterIds)
      profilesById = Object.fromEntries((profileRows || []).map(profile => [profile.id, profile]))
    }
    const rowsWithProfiles = rows.map(row => ({ ...row, submitter_profile: profilesById[row.submitted_by] || null }))
    setItems(rowsWithProfiles)
    const activity = await loadDirectorySocial(supabase, 'campus', rowsWithProfiles)
    setSocialByItem(activity.socialByItem); setImageUrls(activity.imageUrls); setError(activity.error)
    if (!quiet) setLoading(false)
  }, [supabase])
  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => {
    if (!supabase) return undefined
    const channel = supabase.channel('directory-campus-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campus_information' }, () => { void load({ quiet: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campus_information_comments' }, () => { void load({ quiet: true }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campus_information_reactions' }, () => { void load({ quiet: true }) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, load])

  const visible = items.filter(item => kind === 'all' || item.kind === kind)

  async function submit(event) {
    event.preventDefault()
    if (!user) { onNeedSignIn(); return }
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const starts = String(form.get('starts_at') || '')
    const ends = String(form.get('ends_at') || '')
    if (starts && ends && new Date(ends).getTime() < new Date(starts).getTime()) { setError('The end date must be after the start date.'); return }
    setSaving(true); setError('')
    let imagePath = null
    try {
      imagePath = await uploadCommunityPhoto(supabase, user, photo, socialConfig.campus.uploadFolder)
      const row = { kind: form.get('kind'), title: String(form.get('title') || '').trim(), summary: summary.trim(), location: String(form.get('location') || '').trim() || null, starts_at: starts ? new Date(starts).toISOString() : null, ends_at: ends ? new Date(ends).toISOString() : null, contact: String(form.get('contact') || '').trim() || null, link_url: safeHttpUrl(String(form.get('link_url') || '').trim()) || null, image_path: imagePath, submitted_by: user.id, status: 'pending' }
      const { error: saveError } = await supabase.from('campus_information').insert(row)
      if (saveError) { if (imagePath) await supabase.storage.from('community-media').remove([imagePath]); throw saveError }
      formElement.reset(); setSummary(''); setPhoto(null); setShowForm(false)
      notify('Campus information submitted for review. It will appear after approval.')
    } catch (err) { setError(err?.message || 'Campus information could not be submitted. Check your connection and try again.') }
    finally { setSaving(false) }
  }

  async function removeCampusPhoto(item) {
    if (!item?.image_path || !(item.submitted_by === user?.id || isSiteAdmin)) return
    if (!window.confirm('Remove this campus information photo? The information will stay.')) return
    setError('')
    try {
      const result = await supabase.from('campus_information').update({ image_path: null }).eq('id', item.id).select('id').maybeSingle()
      if (result.error) throw result.error
      if (!result.data) throw new Error('Photo was not removed. Check that you own this submission or are a site admin.')
      const { error: storageError } = await supabase.storage.from('community-media').remove([item.image_path])
      await load({ quiet: true })
      if (storageError) setError('Photo removed from the information card, but the stored file could not be deleted.')
      else notify('Campus information photo removed.')
    } catch (err) { setError(err?.message || 'Could not remove the campus information photo.') }
  }

  return <section id="campus-info" className="info-band">
    <span className="eyebrow">Made useful by students</span><h2>Campus info, in one place.</h2><p className="muted">Find events, notices, places and student resources shared by the community. Submissions are reviewed before publication. React, comment, and add photos to useful information.</p>
    <div className="campus-toolbar"><div className="filters">{[{ value: 'all', label: 'Everything' }, ...campusKinds].map(entry => <button key={entry.value} className={`filter ${kind === entry.value ? 'active' : ''}`} onClick={() => setKind(entry.value)}>{entry.label}</button>)}</div><button className="button button-outline" onClick={() => { if (!user) onNeedSignIn(); else setShowForm(value => !value) }}>{showForm ? 'Close form' : 'Share campus info ↗'}</button></div>
    {showForm && <form className="form-stack directory-form" onSubmit={submit}>
      <h3>Share campus information</h3>
      <label>Type<select name="kind">{campusKinds.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></label>
      <label>Title<input name="title" required minLength="3" maxLength="140" placeholder="Short clear title" /></label>
      <label>Details<textarea name="summary" value={summary} onChange={event => setSummary(event.target.value)} required minLength="10" maxLength="2000" placeholder="Give useful details and make sure they are accurate. Emojis and stickers are welcome." /></label>
      <div className="directory-composer-tools"><EmojiStickerPicker disabled={saving} onEmoji={emoji => setSummary(value => appendText(value, emoji))} onSticker={emoji => setSummary(value => appendText(value, `[[sticker:${emoji}]]`))} /><RemoveStickersButton value={summary} onRemove={() => setSummary(removeStickerMarkup(summary))} /><PhotoPicker disabled={saving} file={photo} onChange={setPhoto} onClear={() => setPhoto(null)} /><span className="upload-hint">Add a photo, emoji or sticker. JPEG, PNG, WebP or GIF · max 8 MB.</span></div>
      <label>Location (optional)<input name="location" maxLength="200" placeholder="Building, campus area or online" /></label>
      <label>Start date and time (optional)<input name="starts_at" type="datetime-local" /></label>
      <label>End date and time (optional)<input name="ends_at" type="datetime-local" /></label>
      <label>Contact (optional)<input name="contact" maxLength="254" placeholder="Official contact information" /></label>
      <label>Related link (optional)<input name="link_url" type="url" maxLength="500" placeholder="https://..." /></label>
      <button className="button button-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit for review'}</button>
    </form>}
    {error && <p className="preview-note" role="status">{error}</p>}
    {loading ? <p className="muted">Loading approved campus information…</p> : visible.length ? <div className="info-grid">{visible.map(item => <article className="campus-info-card" key={item.id}>
      <div className={`campus-card-head${item.image_path && imageUrls[item.image_path] ? ' has-directory-photo' : ''}`}>
        {item.image_path && imageUrls[item.image_path] ? <img className="directory-cover" src={imageUrls[item.image_path]} alt={item.title} loading="lazy" /> : <span className="campus-kind-icon" aria-hidden="true">{icons[item.kind]}</span>}
        <span className="tag">{campusKinds.find(entry => entry.value === item.kind)?.label || item.kind}</span>
        {item.image_path && user && (item.submitted_by === user.id || isSiteAdmin) && <button type="button" className="media-remove-overlay" onClick={() => removeCampusPhoto(item)} aria-label="Remove campus information photo">Remove photo</button>}
      </div>
      <div className="campus-card-body"><b>{item.title}</b>{item.submitter_profile && <div className="directory-submitter"><ProfileAvatar profile={item.submitter_profile} name={item.submitter_profile.display_name} className="profile-avatar-directory" /><span>Shared by <b>{item.submitter_profile.display_name || 'Student'}</b></span></div>}<p className="rich-text">{renderRichText(item.summary)}</p>{item.location && <small>📍 {item.location}</small>}{item.starts_at && <p><small>🗓️ {new Date(item.starts_at).toLocaleString()}</small></p>}{item.ends_at && <p><small>Ends: {new Date(item.ends_at).toLocaleString()}</small></p>}{item.contact && <p><small>Contact: {item.contact}</small></p>}{safeHttpUrl(item.link_url) && <p><a href={safeHttpUrl(item.link_url)} target="_blank" rel="noreferrer">More information ↗</a></p>}
        <DirectorySocialInteractions scope="campus" item={item} social={socialByItem[item.id]} imageUrls={imageUrls} supabase={supabase} user={user} isSiteAdmin={isSiteAdmin} onNeedSignIn={onNeedSignIn} onReload={() => load({ quiet: true })} />
      </div>
    </article>)}</div> : <div className="empty-state">{error ? 'Approved information will appear here when connected.' : 'No approved campus information yet. Share a verified notice, event, place or student resource.'}</div>}
  </section>
}
