import { useCallback, useEffect, useState } from 'react'
import ProfileAvatar from './ProfileAvatar'

const DEMO_POSTS = [
  { id: 'demo-post-1', author: 'Group admin', body: 'Welcome! Use this feed to share updates, ask questions and keep the community connected.', created_at: null },
  { id: 'demo-post-2', author: 'Member', body: 'Introduce yourself and share what you hope to get out of this group.', created_at: null },
]
const DEMO_MESSAGES = [
  { id: 'demo-message-1', author: 'Sam · example', body: 'Hey everyone, welcome!', created_at: null },
  { id: 'demo-message-2', author: 'Amina · example', body: 'Glad to be here 👋', created_at: null },
]
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const EMOJIS = ['😀', '😂', '🥹', '😍', '🥰', '😎', '🤔', '😭', '🙌', '👏', '👍', '❤️', '🔥', '🎉', '💯', '✨', '💚', '🙏', '🤝', '👀', '💡', '📚', '💻', '⚽']
const STICKERS = [
  { emoji: '🫶', label: 'Much love' }, { emoji: '🥹', label: 'So proud' }, { emoji: '🔥', label: 'Fire' },
  { emoji: '🎉', label: 'Celebrate' }, { emoji: '😂', label: 'LOL' }, { emoji: '💚', label: 'Green heart' },
  { emoji: '🚀', label: 'Let’s go' }, { emoji: '💯', label: '100 percent' }, { emoji: '🌻', label: 'Good vibes' },
  { emoji: '🎓', label: 'Campus life' }, { emoji: '💻', label: 'Tech time' }, { emoji: '🤝', label: 'Teamwork' },
]
const REACTIONS = ['👍', '❤️', '😂', '🔥', '👏', '🎉', '🥰', '😮']

function safeImageUrl(supabase, path) {
  if (!path || !supabase) return null
  const { data } = supabase.storage.from('group-media').getPublicUrl(path)
  return data?.publicUrl || null
}
function displayTime(value) {
  if (!value) return 'Example post'
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
function buildPrivatePeers(rows, userId) {
  const peers = new Map()
  for (const row of rows || []) {
    const peerId = row.sender_id === userId ? row.recipient_id : row.sender_id
    if (!peerId || peerId === userId) continue
    const peerName = row.sender_id === userId ? row.recipient_name : row.sender_name
    const existing = peers.get(peerId)
    if (!existing || new Date(row.created_at || 0) > new Date(existing.lastMessageAt || 0)) {
      peers.set(peerId, {
        id: peerId,
        name: peerName || 'Group member',
        lastMessageAt: row.created_at,
        lastMessage: row.body || 'Private reply',
      })
    }
  }
  return [...peers.values()].sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))
}

function getOnlineGroupMembers(presenceState) {
  const members = new Map()
  for (const [key, presences] of Object.entries(presenceState || {})) {
    for (const presence of (Array.isArray(presences) ? presences : [presences])) {
      const id = presence?.user_id || key
      if (!id) continue
      const existing = members.get(id)
      const name = presence?.display_name || existing?.display_name || 'Member'
      members.set(id, {
        user_id: id,
        display_name: name,
        avatar_url: presence?.avatar_url || existing?.avatar_url || null,
      })
    }
  }
  return [...members.values()].sort((a, b) => a.display_name.localeCompare(b.display_name))
}

function renderRichText(value) {
  if (!value) return null
  const allowed = new Set(STICKERS.map(item => item.emoji))
  return value.split(/(\[\[sticker:[^\]]+\]\])/g).map((part, index) => {
    const match = part.match(/^\[\[sticker:([^\]]+)\]\]$/)
    if (match && allowed.has(match[1])) {
      return <span className="inline-sticker" role="img" aria-label="Sticker" key={`sticker-${index}`}>{match[1]}</span>
    }
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

function PhotoPicker({ disabled, file, onChange, onClear, label = '📷 Add a photo', compact = false }) {
  const [previewUrl, setPreviewUrl] = useState('')
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return undefined }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <div className="photo-picker-wrap">
    <label className={`photo-picker${compact ? ' chat-photo' : ''}`}>
      {label}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled} onChange={event => { const picked = event.target.files?.[0] || null; event.target.value = ''; onChange(picked) }} />
    </label>
    {file && <span className="selected-photo">{previewUrl && <img className="photo-picker-preview" src={previewUrl} alt="Selected photo preview" />}<span>{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</span><button type="button" className="remove-photo" onClick={() => onClear()} aria-label="Remove selected photo">×</button></span>}
  </div>
}


function VideoPicker({ disabled, file, onChange, onClear }) {
  const [previewUrl, setPreviewUrl] = useState('')
  useEffect(() => {
    if (!file) { setPreviewUrl(''); return undefined }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  return <div className="photo-picker-wrap">
    <label className="photo-picker chat-photo">🎬 Video
      <input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={disabled} onChange={event => { const picked = event.target.files?.[0] || null; event.target.value = ''; onChange(picked) }} />
    </label>
    {file && <span className="selected-photo"><span>{file.name} · {Math.max(1, Math.round(file.size / 1024 / 1024))} MB</span><button type="button" className="remove-photo" onClick={onClear} aria-label="Remove selected video">×</button></span>}
    {previewUrl && <video className="chat-video-preview" src={previewUrl} controls muted />}
    <small className="muted">MP4, WebM or MOV · maximum 50 MB</small>
  </div>
}

export default function GroupDialog({ group, user, membership, supabase, onRequestJoin, onClose, notify, onMembershipChange }) {
  const [tab, setTab] = useState('posts')
  const [posts, setPosts] = useState([])
  const [messages, setMessages] = useState([])
  const [requests, setRequests] = useState([])
  const [groupMembers, setGroupMembers] = useState([])
  const [onlineMembers, setOnlineMembers] = useState([])
  const [presenceStatus, setPresenceStatus] = useState('idle')
  const [presenceError, setPresenceError] = useState('')
  const [adminChangeBusy, setAdminChangeBusy] = useState('')
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [postText, setPostText] = useState('')
  const [chatText, setChatText] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)
  const [privateTarget, setPrivateTarget] = useState(null)
  const [privatePanelOpen, setPrivatePanelOpen] = useState(false)
  const [privatePeerId, setPrivatePeerId] = useState('')
  const [privateDraft, setPrivateDraft] = useState('')
  const [privateMessages, setPrivateMessages] = useState([])
  const [privateLoading, setPrivateLoading] = useState(false)
  const [privateSending, setPrivateSending] = useState(false)
  const [privateError, setPrivateError] = useState('')
  const [privateRefreshKey, setPrivateRefreshKey] = useState(0)
  const [postPhoto, setPostPhoto] = useState(null)
  const [chatPhoto, setChatPhoto] = useState(null)
  const [chatVideo, setChatVideo] = useState(null)
  const [commentDrafts, setCommentDrafts] = useState({})
  const [commentPhotos, setCommentPhotos] = useState({})
  const [commentSending, setCommentSending] = useState({})
  const [reactionBusy, setReactionBusy] = useState({})
  const [mediaActionBusy, setMediaActionBusy] = useState({})
  const [isSiteAdmin, setIsSiteAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [requestLoading, setRequestLoading] = useState(false)
  const [error, setError] = useState('')

  const isDemo = !supabase || !group?.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(group.id)
  const isMember = membership?.status === 'approved'
  const isGroupAdmin = isMember && membership?.role === 'admin'
  const isPending = membership?.status === 'pending'
  const canManageGroupAdmins = !isDemo && (isSiteAdmin || isGroupAdmin)
  const currentGroupAdmins = groupMembers.filter(member => member.role === 'admin')
  const activeGroupAdmin = currentGroupAdmins[0] || null

  useEffect(() => {
    if (!supabase || !user?.id) { setIsSiteAdmin(false); return undefined }
    let cancelled = false
    supabase.rpc('is_site_admin').then(({ data, error: adminError }) => {
      if (!cancelled) setIsSiteAdmin(!adminError && data === true)
    }).catch(() => { if (!cancelled) setIsSiteAdmin(false) })
    return () => { cancelled = true }
  }, [supabase, user?.id])

  const loadActivity = useCallback(async () => {
    if (!group) return
    if (isDemo) {
      setPosts(DEMO_POSTS.map(p => ({ ...p, profiles: { display_name: p.author, avatar_url: null }, comments: [], reactions: [] })))
      setMessages(DEMO_MESSAGES.map(m => ({ ...m, profiles: { display_name: m.author, avatar_url: null } })))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const [postResult, messageResult] = await Promise.all([
      supabase.from('group_posts').select('id,group_id,author_id,body,image_path,created_at,profiles:profiles(display_name, avatar_url)').eq('group_id', group.id).order('created_at', { ascending: true }),
      supabase.from('group_messages').select('id,group_id,author_id,body,image_path,video_path,reply_to_message_id,created_at,profiles:profiles(display_name, avatar_url)').eq('group_id', group.id).order('created_at', { ascending: true }).limit(200),
    ])
    if (postResult.error || messageResult.error) {
      setError('Could not load group activity. Check the latest Supabase migrations and database permissions.')
      setLoading(false)
      return
    }
    const postRows = postResult.data || []
    let commentRows = []
    let reactionRows = []
    if (postRows.length) {
      const [commentResult, reactionResult] = await Promise.all([
        supabase.from('group_post_comments').select('id,group_id,post_id,author_id,body,image_path,created_at,profiles:profiles(display_name, avatar_url)').eq('group_id', group.id).order('created_at', { ascending: true }),
        supabase.from('group_post_reactions').select('id,group_id,post_id,user_id,emoji').eq('group_id', group.id),
      ])
      if (commentResult.error || reactionResult.error) {
        setError('Posts loaded, but comments or reactions could not load. Check that the social-features database migration has been applied.')
      } else {
        commentRows = commentResult.data || []
        reactionRows = reactionResult.data || []
      }
    }
    setPosts(postRows.map(post => ({
      ...post,
      comments: commentRows.filter(comment => comment.post_id === post.id),
      reactions: reactionRows.filter(reaction => reaction.post_id === post.id),
    })))
    setMessages(messageResult.data || [])
    setLoading(false)
  }, [group, isDemo, supabase])

  const loadRequests = useCallback(async () => {
    if (!isGroupAdmin || isDemo) { setRequests([]); return }
    const { data, error: loadError } = await supabase.from('group_members')
      .select('id,group_id,user_id,requested_at,profiles:profiles(display_name, avatar_url)')
      .eq('group_id', group.id).eq('role', 'member').eq('status', 'pending')
      .order('requested_at', { ascending: true })
    if (loadError) notify('Could not load membership requests. Check the group-membership permissions.')
    else setRequests(data || [])
  }, [group?.id, isDemo, isGroupAdmin, notify, supabase])

  const loadGroupMembers = useCallback(async () => {
    if (!canManageGroupAdmins || isDemo) { setGroupMembers([]); return }
    const { data, error: loadError } = await supabase.from('group_members')
      .select('id,group_id,user_id,role,status,requested_at,profiles:profiles(display_name, avatar_url)')
      .eq('group_id', group.id).eq('status', 'approved')
      .order('requested_at', { ascending: true })
    if (loadError) {
      setGroupMembers([])
      notify('Could not load approved group members. Check group-membership permissions and the latest SQL migration.')
    } else setGroupMembers(data || [])
  }, [group?.id, isDemo, canManageGroupAdmins, notify, supabase])

  useEffect(() => {
    setTab('posts'); setPostText(''); setChatText(''); setPostPhoto(null); setChatPhoto(null)
    setReplyTarget(null); setPrivateTarget(null); setPrivatePanelOpen(false); setPrivatePeerId(''); setPrivateDraft(''); setPrivateMessages([]); setPrivateError('')
    setCommentDrafts({}); setCommentPhotos({})
    loadActivity()
    loadRequests()
    loadGroupMembers()
    if (isDemo || !supabase) return undefined
    let cancelled = false
    let broadcastChannel = null
    async function connectRealtime() {
      try {
        await supabase.realtime.setAuth()
        if (cancelled) return
        broadcastChannel = supabase.channel(`group:${group.id}`, { config: { private: true } })
          .on('broadcast', { event: 'INSERT' }, () => { loadActivity() })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'group_posts', filter: `group_id=eq.${group.id}` }, () => { loadActivity() })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${group.id}` }, () => { loadActivity() })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'group_post_comments', filter: `group_id=eq.${group.id}` }, () => { loadActivity() })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'group_post_reactions', filter: `group_id=eq.${group.id}` }, () => { loadActivity() })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'group_private_messages', filter: `group_id=eq.${group.id}` }, () => { setPrivateRefreshKey(value => value + 1) })
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setError('Live updates are temporarily unavailable. You can still refresh the group to load new activity.')
            }
          })
      } catch {
        if (!cancelled) setError('Live updates could not connect. Refresh the group to load new activity.')
      }
    }
    connectRealtime()
    return () => {
      cancelled = true
      if (broadcastChannel) supabase.removeChannel(broadcastChannel)
    }
  }, [group?.id, loadActivity, loadRequests, loadGroupMembers, isDemo, supabase])

  // Publish online presence only while an approved member is in this group's Live chat.
  // Presence is isolated from the message-broadcast channel and protected by its own RLS policies.
  useEffect(() => {
    if (isDemo || !supabase || !user?.id || !isMember || tab !== 'chat') {
      setOnlineMembers([])
      setPresenceStatus('idle')
      setPresenceError('')
      return undefined
    }

    let cancelled = false
    let presenceChannel = null
    setOnlineMembers([])
    setPresenceStatus('connecting')
    setPresenceError('')

    const refreshPresence = () => {
      if (cancelled || !presenceChannel) return
      setOnlineMembers(getOnlineGroupMembers(presenceChannel.presenceState()))
    }

    async function connectPresence() {
      try {
        await supabase.realtime.setAuth()
        if (cancelled) return

        const { data: profile } = await supabase.from('profiles')
          .select('display_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle()
        if (cancelled) return

        const displayName = profile?.display_name
          || user.user_metadata?.display_name
          || user.user_metadata?.full_name
          || 'Member'

        presenceChannel = supabase.channel(`group-chat-presence:${group.id}`, {
          config: { private: true, presence: { key: user.id } },
        })
          .on('presence', { event: 'sync' }, refreshPresence)
          .on('presence', { event: 'join' }, refreshPresence)
          .on('presence', { event: 'leave' }, refreshPresence)
          .subscribe(async status => {
            if (cancelled) return
            if (status === 'SUBSCRIBED') {
              setPresenceStatus('online')
              const result = await presenceChannel.track({
                user_id: user.id,
                display_name: displayName,
                avatar_url: profile?.avatar_url || null,
                online_at: new Date().toISOString(),
              })
              if (cancelled) return
              if (result !== 'ok') {
                setPresenceStatus('unavailable')
                setPresenceError('Live online status could not be published. Check the group-chat-presence SQL migration in Supabase.')
                return
              }
              setPresenceError('')
              refreshPresence()
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              setPresenceStatus('unavailable')
              setPresenceError('Live online status could not connect. Apply the group-chat-presence SQL migration in Supabase and retry.')
            }
          })
      } catch {
        if (!cancelled) {
          setPresenceStatus('unavailable')
          setPresenceError('Live online status could not connect. Check your connection and the group-chat-presence SQL migration.')
        }
      }
    }

    connectPresence()
    return () => {
      cancelled = true
      if (presenceChannel) supabase.removeChannel(presenceChannel)
    }
  }, [group?.id, isDemo, isMember, supabase, tab, user?.id])

  async function uploadPhoto(file) {
    if (!file) return null
    if (!IMAGE_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, WebP or GIF image.')
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 8 MB or smaller.')
    if (!user) throw new Error('Sign in before uploading a photo.')
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const path = `${group.id}/${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('group-media').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    return path
  }

  async function uploadVideo(file) {
    if (!file) return null
    if (!VIDEO_TYPES.has(file.type)) throw new Error('Choose an MP4, WebM or MOV video.')
    if (file.size > MAX_VIDEO_BYTES) throw new Error('Videos must be 50 MB or smaller.')
    if (!user) throw new Error('Sign in before uploading a video.')
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
    const path = `${group.id}/${user.id}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('group-media').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    return path
  }

  async function submitPost(event) {
    event.preventDefault()
    if (!user) { notify('Sign in before posting.'); return }
    if (!isMember) { notify('An approved group membership is required to post.'); return }
    if (!postText.trim() && !postPhoto) return
    setSending(true); setError('')
    let imagePath = null
    try {
      imagePath = await uploadPhoto(postPhoto)
      const { error: insertError } = await supabase.from('group_posts').insert({ group_id: group.id, author_id: user.id, body: postText.trim(), image_path: imagePath })
      if (insertError) {
        if (imagePath) await supabase.storage.from('group-media').remove([imagePath])
        throw insertError
      }
      setPostText(''); setPostPhoto(null)
      await loadActivity()
      notify('Your post has been published.')
    } catch (err) { setError(err.message || 'Post could not be published.'); }
    finally { setSending(false) }
  }

  async function submitMessage(event) {
    event.preventDefault()
    if (!user) { notify('Sign in before sending a message.'); return }
    if (!isMember) { notify('An approved group membership is required to chat.'); return }
    if (!chatText.trim() && !chatPhoto && !chatVideo) return
    setSending(true); setError('')
    let imagePath = null
    let videoPath = null
    try {
      imagePath = await uploadPhoto(chatPhoto)
      videoPath = await uploadVideo(chatVideo)
      const { error: insertError } = await supabase.from('group_messages').insert({ group_id: group.id, author_id: user.id, body: chatText.trim(), image_path: imagePath, video_path: videoPath, reply_to_message_id: replyTarget?.id || null })
      if (insertError) {
        const uploadedPaths = [imagePath, videoPath].filter(Boolean)
        if (uploadedPaths.length) await supabase.storage.from('group-media').remove(uploadedPaths)
        throw insertError
      }
      setChatText(''); setChatPhoto(null); setChatVideo(null); setReplyTarget(null)
      await loadActivity()
    } catch (err) { setError(err.message || 'Message could not be sent.'); }
    finally { setSending(false) }
  }

  async function submitPrivateReply(event) {
    event.preventDefault()
    if (!user) { notify('Sign in before sending a private reply.'); return }
    if (!isMember) { notify('An approved group membership is required for private replies.'); return }
    if (!privateTarget || !privatePeerId || !privateDraft.trim()) return
    setPrivateSending(true)
    setPrivateError('')
    const { error: insertError } = await supabase.from('group_private_messages').insert({
      group_id: group.id,
      reply_to_message_id: privateTarget.id,
      sender_id: user.id,
      recipient_id: privatePeerId,
      body: privateDraft.trim(),
    })
    setPrivateSending(false)
    if (insertError) {
      setPrivateError(insertError.message || 'Private reply could not be sent.')
      return
    }
    setPrivateDraft('')
    setPrivateRefreshKey(value => value + 1)
  }

  function openPrivateReplies(message) {
    if (!user) { notify('Sign in before using private replies.'); return }
    if (!isMember) { notify('An approved group membership is required for private replies.'); return }
    setPrivateTarget(message)
    setPrivatePanelOpen(true)
    setPrivateDraft('')
    setPrivateError('')
    setPrivatePeerId(message.author_id === user.id ? '' : message.author_id)
  }

  useEffect(() => {
    if (isDemo || !supabase || !user || !isMember || !privatePanelOpen || !privateTarget) return undefined
    let cancelled = false
    async function refreshPrivateThread() {
      setPrivateLoading(true)
      const { data, error: fetchError } = await supabase.from('group_private_messages')
        .select('id,group_id,reply_to_message_id,sender_id,recipient_id,body,created_at')
        .eq('reply_to_message_id', privateTarget.id)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (fetchError) {
        setPrivateError('Could not load private replies. Check your sign-in and database permissions.')
        setPrivateMessages([])
        setPrivateLoading(false)
        return
      }
      const rows = data || []
      const profileIds = [...new Set(rows.flatMap(row => [row.sender_id, row.recipient_id]))]
      let profiles = []
      if (profileIds.length) {
        const profileResult = await supabase.from('profiles').select('id,display_name').in('id', profileIds)
        if (!cancelled && !profileResult.error) profiles = profileResult.data || []
      }
      if (cancelled) return
      const names = Object.fromEntries(profiles.map(profile => [profile.id, profile.display_name]))
      const enriched = rows.map(row => ({
        ...row,
        sender_name: names[row.sender_id] || (row.sender_id === user.id ? 'You' : 'Group member'),
        recipient_name: names[row.recipient_id] || (row.recipient_id === user.id ? 'You' : 'Group member'),
      }))
      setPrivateMessages(enriched)
      setPrivatePeerId(current => {
        if (privateTarget.author_id !== user.id) return privateTarget.author_id
        const peers = buildPrivatePeers(enriched, user.id)
        if (current && peers.some(peer => peer.id === current)) return current
        return peers.length === 1 ? peers[0].id : ''
      })
      setPrivateLoading(false)
    }
    refreshPrivateThread()
    return () => { cancelled = true }
  }, [isDemo, supabase, user?.id, isMember, privatePanelOpen, privateTarget?.id, privateTarget?.author_id, privateRefreshKey])

  async function submitComment(event, post) {
    event.preventDefault()
    if (!user) { notify('Sign in before commenting.'); return }
    if (!isMember) { notify('An approved group membership is required to comment.'); return }
    const body = (commentDrafts[post.id] || '').trim()
    const photo = commentPhotos[post.id] || null
    if (!body && !photo) return
    setCommentSending(current => ({ ...current, [post.id]: true }))
    setError('')
    let imagePath = null
    try {
      imagePath = await uploadPhoto(photo)
      const { error: insertError } = await supabase.from('group_post_comments').insert({ group_id: group.id, post_id: post.id, author_id: user.id, body, image_path: imagePath })
      if (insertError) {
        if (imagePath) await supabase.storage.from('group-media').remove([imagePath])
        throw insertError
      }
      setCommentDrafts(current => ({ ...current, [post.id]: '' }))
      setCommentPhotos(current => ({ ...current, [post.id]: null }))
      await loadActivity()
    } catch (err) { setError(err.message || 'Your comment could not be published.'); }
    finally { setCommentSending(current => ({ ...current, [post.id]: false })) }
  }

  async function removeGroupPhoto(record, table, label) {
    if (!record?.image_path || !record?.body?.trim()) return
    const key = `${table}:${record.id}:photo`
    if (!window.confirm(`Remove the photo from this ${label}? The text will stay.`)) return
    setMediaActionBusy(current => ({ ...current, [key]: true }))
    try {
      const { data, error: updateError } = await supabase.from(table).update({ image_path: null }).eq('id', record.id).select('id').maybeSingle()
      if (updateError) throw updateError
      if (!data) throw new Error('Photo was not changed. You may not have permission to remove it.')
      const { error: storageError } = await supabase.storage.from('group-media').remove([record.image_path])
      await loadActivity()
      if (storageError) notify('The photo was removed from the post, but its stored file could not be deleted. A site admin may need to clean it up.')
      else notify(`${label[0].toUpperCase()}${label.slice(1)} photo removed.`)
    } catch (err) { setError(err?.message || `Could not remove the ${label} photo.`) }
    finally { setMediaActionBusy(current => ({ ...current, [key]: false })) }
  }

  async function deleteGroupComment(comment) {
    if (!comment || !(comment.author_id === user?.id || isGroupAdmin || isSiteAdmin)) return
    if (!window.confirm('Delete this comment? This cannot be undone.')) return
    const key = `comment:${comment.id}:delete`
    setMediaActionBusy(current => ({ ...current, [key]: true }))
    try {
      const { data, error: deleteError } = await supabase.from('group_post_comments').delete().eq('id', comment.id).select('id').maybeSingle()
      if (deleteError) throw deleteError
      if (!data) throw new Error('Comment was not deleted. Check that you own the comment or are a group admin.')
      if (comment.image_path) {
        const { error: storageError } = await supabase.storage.from('group-media').remove([comment.image_path])
        if (storageError) notify('Comment deleted, but its stored photo could not be removed.')
      }
      await loadActivity()
      notify('Comment deleted.')
    } catch (err) { setError(err?.message || 'Could not delete the comment.') }
    finally { setMediaActionBusy(current => ({ ...current, [key]: false })) }
  }

  async function deleteGroupPost(post) {
    if (!post || !(post.author_id === user?.id || isGroupAdmin || isSiteAdmin)) return
    if (!window.confirm('Delete this post and its comments? This cannot be undone.')) return
    const key = `post:${post.id}:delete`
    setMediaActionBusy(current => ({ ...current, [key]: true }))
    try {
      const paths = []
      if (post.image_path && (post.author_id === user?.id || isGroupAdmin || isSiteAdmin)) paths.push(post.image_path)
      for (const comment of post.comments || []) {
        if (comment.image_path && (comment.author_id === user?.id || isGroupAdmin || isSiteAdmin)) paths.push(comment.image_path)
      }
      const { data, error: deleteError } = await supabase.from('group_posts').delete().eq('id', post.id).select('id').maybeSingle()
      if (deleteError) throw deleteError
      if (!data) throw new Error('Post was not deleted. Check your permissions.')
      let storageCleanupFailed = false
      for (const path of paths) {
        const { error: storageError } = await supabase.storage.from('group-media').remove([path])
        if (storageError) storageCleanupFailed = true
      }
      if (storageCleanupFailed) notify('Post deleted, but one or more stored photos could not be removed.')
      await loadActivity()
      notify('Post and its comments deleted.')
    } catch (err) { setError(err?.message || 'Could not delete the post.') }
    finally { setMediaActionBusy(current => ({ ...current, [key]: false })) }
  }

  async function deleteChatMessage(message) {
    if (!message || !(message.author_id === user?.id || isGroupAdmin || isSiteAdmin)) return
    if (!window.confirm('Delete this chat message? Private replies connected to it will also be removed.')) return
    const key = `message:${message.id}:delete`
    setMediaActionBusy(current => ({ ...current, [key]: true }))
    try {
      const { data, error: deleteError } = await supabase.from('group_messages').delete().eq('id', message.id).select('id').maybeSingle()
      if (deleteError) throw deleteError
      if (!data) throw new Error('Message was not deleted. Check your permissions.')
      if (message.image_path) {
        const { error: storageError } = await supabase.storage.from('group-media').remove([message.image_path])
        if (storageError) notify('Message deleted, but its stored photo could not be removed.')
      }
      await loadActivity()
      if (privateTarget?.id === message.id) {
        setPrivatePanelOpen(false); setPrivateTarget(null); setPrivateMessages([]); setPrivatePeerId('')
      }
      notify('Chat message deleted.')
    } catch (err) { setError(err?.message || 'Could not delete the chat message.') }
    finally { setMediaActionBusy(current => ({ ...current, [key]: false })) }
  }

  async function toggleReaction(post, emoji) {
    if (!user) { notify('Sign in before reacting.'); return }
    if (!isMember) { notify('Request to join this group and wait for approval to react.'); return }
    const key = `${post.id}:${emoji}`
    setReactionBusy(current => ({ ...current, [key]: true }))
    const existing = (post.reactions || []).find(item => item.user_id === user.id && item.emoji === emoji)
    const result = existing
      ? await supabase.from('group_post_reactions').delete().eq('id', existing.id)
      : await supabase.from('group_post_reactions').insert({ group_id: group.id, post_id: post.id, user_id: user.id, emoji })
    setReactionBusy(current => ({ ...current, [key]: false }))
    if (result.error) { setError(result.error.message || 'Could not save your reaction.'); return }
    await loadActivity()
  }

  async function reviewMembership(request, approve) {
    setRequestLoading(true)
    const { error: reviewError } = await supabase.rpc('review_group_membership', {
      target_group_id: group.id, target_user_id: request.user_id, approve,
    })
    setRequestLoading(false)
    if (reviewError) { notify(reviewError.message || 'Could not review membership request.'); return }
    notify(approve ? 'Membership approved.' : 'Membership declined.')
    await loadRequests()
    onMembershipChange?.()
  }

  async function assignGroupAdmin(member) {
    if (!member?.user_id || !canManageGroupAdmins || adminChangeBusy) return
    setAdminChangeBusy(member.user_id)
    const { error: assignError } = await supabase.rpc('assign_group_admin', {
      target_group_id: group.id,
      target_user_id: member.user_id,
    })
    setAdminChangeBusy('')
    if (assignError) {
      notify(assignError.message || 'Could not assign the group admin. Apply the group-admin handover SQL migration in Supabase first.')
      return
    }
    notify(`${member.profiles?.display_name || 'Selected member'} is now the group admin. Only one group admin is assigned at a time.`)
    await loadGroupMembers()
    onMembershipChange?.()
  }

  async function leaveGroup() {
    if (!isMember || isDemo || leaveBusy) return
    const prompt = isGroupAdmin
      ? 'Leave this group? You will give up your group admin role. After you leave, only the main site admin can appoint the next group admin.'
      : 'Leave this group? You will need to request to join again to participate.'
    if (!window.confirm(prompt)) return
    setLeaveBusy(true)
    const { error: leaveError } = await supabase.rpc('leave_group', { target_group_id: group.id })
    setLeaveBusy(false)
    if (leaveError) {
      notify(leaveError.message || 'Could not leave this group. Apply the group-admin handover SQL migration in Supabase first.')
      return
    }
    notify('You have left the group.')
    onMembershipChange?.()
    onClose?.()
  }

  if (!group) return null
  function authorName(item) { return item.profiles?.display_name || (item.author_id === user?.id ? 'You' : 'Member') }
  function renderComment(comment) {
    const imageUrl = safeImageUrl(supabase, comment.image_path)
    const canManage = Boolean(user && (comment.author_id === user.id || isGroupAdmin || isSiteAdmin))
    const deleteKey = `comment:${comment.id}:delete`
    const photoKey = `group_post_comments:${comment.id}:photo`
    return <article className="comment-item" key={comment.id}>
      <ProfileAvatar profile={comment.profiles} name={authorName(comment)} className="profile-avatar-comment" />
      <div className="comment-content"><div className="comment-meta"><b>{authorName(comment)}</b><small>{displayTime(comment.created_at)}</small></div>
        {comment.body && <p className="rich-text">{renderRichText(comment.body)}</p>}
        {imageUrl && <div className="comment-media"><a href={imageUrl} target="_blank" rel="noreferrer"><img className="comment-image" src={imageUrl} alt="Photo shared in a comment" loading="lazy" /></a>{canManage && comment.body?.trim() && <button type="button" className="content-action-button" disabled={Boolean(mediaActionBusy[photoKey])} onClick={() => removeGroupPhoto(comment, 'group_post_comments', 'comment')}>{mediaActionBusy[photoKey] ? 'Removing…' : 'Remove photo'}</button>}</div>}
        {canManage && <div className="content-action-row"><button type="button" className="content-action-button danger" disabled={Boolean(mediaActionBusy[deleteKey])} onClick={() => deleteGroupComment(comment)}>{mediaActionBusy[deleteKey] ? 'Deleting…' : 'Delete comment'}</button></div>}
      </div>
    </article>
  }
  function renderActivity(items) {
    if (!items.length) return <div className="empty-state">No activity yet. Be the first to share something.</div>
    return items.map(item => {
      const imageUrl = safeImageUrl(supabase, item.image_path)
      const itemReactions = item.reactions || []
      const canManage = Boolean(user && (item.author_id === user.id || isGroupAdmin || isSiteAdmin))
      const deleteKey = `post:${item.id}:delete`
      const photoKey = `group_posts:${item.id}:photo`
      return <article className="post" key={item.id}>
        <div className="post-head"><div className="post-author"><ProfileAvatar profile={item.profiles} name={authorName(item)} className="profile-avatar-post" /><b>{authorName(item)}</b></div><small>{displayTime(item.created_at)}</small></div>
        {item.body && <p className="post-body rich-text">{renderRichText(item.body)}</p>}
        {imageUrl && <div className="post-media"><a href={imageUrl} target="_blank" rel="noreferrer"><img className="group-post-image" src={imageUrl} alt="Shared by a group member" loading="lazy" /></a>{canManage && item.body?.trim() && <button type="button" className="content-action-button" disabled={Boolean(mediaActionBusy[photoKey])} onClick={() => removeGroupPhoto(item, 'group_posts', 'post')}>{mediaActionBusy[photoKey] ? 'Removing…' : 'Remove photo'}</button>}</div>}
        {canManage && <div className="content-action-row post-content-actions"><button type="button" className="content-action-button danger" disabled={Boolean(mediaActionBusy[deleteKey])} onClick={() => deleteGroupPost(item)}>{mediaActionBusy[deleteKey] ? 'Deleting…' : 'Delete post'}</button></div>}
        {!isDemo && <>
          <div className="reaction-row" aria-label="Reactions">
            {REACTIONS.map(emoji => {
              const count = itemReactions.filter(reaction => reaction.emoji === emoji).length
              const selectedReaction = itemReactions.some(reaction => reaction.user_id === user?.id && reaction.emoji === emoji)
              return <button type="button" key={emoji} title={isMember ? `React with ${emoji}` : 'Join and wait for approval to react'} className={`reaction-chip${selectedReaction ? ' selected' : ''}`} disabled={!isMember || Boolean(reactionBusy[`${item.id}:${emoji}`])} onClick={() => toggleReaction(item, emoji)}><span>{emoji}</span>{count > 0 && <small>{count}</small>}</button>
            })}
          </div>
          <section className="comments-section" aria-label="Post comments">
            <div className="comments-heading">Comments <span>{(item.comments || []).length}</span></div>
            {(item.comments || []).map(renderComment)}
            <form className="comment-composer" onSubmit={event => submitComment(event, item)}>
              <textarea value={commentDrafts[item.id] || ''} onChange={event => setCommentDrafts(current => ({ ...current, [item.id]: event.target.value }))} disabled={!isMember || Boolean(commentSending[item.id])} maxLength={1000} rows={2} placeholder={isMember ? 'Write a comment…' : 'Join and wait for approval to comment'} />
              <div className="comment-tools">
                <EmojiStickerPicker compact disabled={!isMember || Boolean(commentSending[item.id])} onEmoji={emoji => setCommentDrafts(current => ({ ...current, [item.id]: appendText(current[item.id] || '', emoji) }))} onSticker={emoji => setCommentDrafts(current => ({ ...current, [item.id]: appendText(current[item.id] || '', `[[sticker:${emoji}]]`) }))} />
                <RemoveStickersButton value={commentDrafts[item.id] || ''} onRemove={() => setCommentDrafts(current => ({ ...current, [item.id]: removeStickerMarkup(current[item.id] || '') }))} />
                <PhotoPicker compact disabled={!isMember || Boolean(commentSending[item.id])} file={commentPhotos[item.id] || null} onChange={file => setCommentPhotos(current => ({ ...current, [item.id]: file }))} onClear={() => setCommentPhotos(current => ({ ...current, [item.id]: null }))} label="📷" />
                <button className="button button-primary small" disabled={!isMember || Boolean(commentSending[item.id]) || (!(commentDrafts[item.id] || '').trim() && !commentPhotos[item.id])}>{commentSending[item.id] ? 'Sending…' : 'Comment'}</button>
              </div>
            </form>
          </section>
        </>}
      </article>
    })
  }

  const appendPostEmoji = emoji => setPostText(value => appendText(value, emoji))
  const appendPostSticker = emoji => setPostText(value => appendText(value, `[[sticker:${emoji}]]`))
  const appendChatEmoji = emoji => setChatText(value => appendText(value, emoji))
  const appendChatSticker = emoji => setChatText(value => appendText(value, `[[sticker:${emoji}]]`))

  return <div className="veil" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="dialog group-dialog" role="dialog" aria-modal="true" aria-labelledby="groupTitle">
    <button className="close" onClick={onClose} aria-label="Close">×</button>
    <span className="eyebrow">{group.category}{isDemo ? ' · example group' : ' · community group'}</span><h2 id="groupTitle">{group.name}</h2><p className="muted">{group.description}</p>
    <div className="access-note"><span>◎</span><span>Everyone can view approved group activity. Only students whose membership is approved can post, comment, react, chat or upload photos.</span></div>
    <div className="dialog-actions">
      <button className="button button-outline small" disabled={isDemo || isMember || isPending} onClick={() => onRequestJoin(group)}>{isGroupAdmin ? 'Group admin' : isMember ? 'Approved member' : isPending ? 'Request pending' : !user ? 'Sign in to join' : 'Request to join'}</button>
      <span className="member-count">{isDemo ? 'Example group · sample activity' : isMember ? 'Your membership is approved' : 'Read-only until approved'}</span>
      {isMember && !isDemo && <button type="button" className="button button-outline small" disabled={leaveBusy} onClick={leaveGroup}>{leaveBusy ? 'Leaving…' : 'Leave group'}</button>}
    </div>
    <div className="tabs"><button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>Posts</button><button className={tab === 'chat' ? 'active' : ''} onClick={() => setTab('chat')}>Live chat</button>{isGroupAdmin && <button className={tab === 'requests' ? 'active' : ''} onClick={() => { setTab('requests'); loadRequests() }}>Join requests {requests.length ? `(${requests.length})` : ''}</button>}{canManageGroupAdmins && <button className={tab === 'group-admin' ? 'active' : ''} onClick={() => { setTab('group-admin'); loadGroupMembers() }}>Group admin</button>}</div>
    {error && <p className="preview-note" role="alert">{error}</p>}
    {tab === 'posts' && <div className="activity-list">
      {loading ? <p className="muted">Loading posts…</p> : renderActivity(posts)}
      {!isDemo && <form className="composer" onSubmit={submitPost}><textarea value={postText} onChange={e => setPostText(e.target.value)} disabled={!isMember || sending} maxLength={5000} placeholder={isMember ? 'What would you like to share with the group?' : 'Join and wait for approval to post'} /><div className="composer-tools"><EmojiStickerPicker disabled={!isMember || sending} onEmoji={appendPostEmoji} onSticker={appendPostSticker} /><RemoveStickersButton value={postText} onRemove={() => setPostText(removeStickerMarkup(postText))} /><PhotoPicker disabled={!isMember || sending} file={postPhoto} onChange={setPostPhoto} onClear={() => setPostPhoto(null)} /><button className="button button-primary small" disabled={!isMember || sending || (!postText.trim() && !postPhoto)}>{sending ? 'Posting…' : 'Post'}</button></div><p className="upload-hint">Share text, emojis, stickers or a photo (JPEG, PNG, WebP or GIF · maximum 8 MB).</p></form>}
    </div>}
    {tab === 'chat' && <div className="chat-panel">
      <div className="chat-help-row"><span>Reply to a message or send a private reply visible only to the conversation participants.</span><button type="button" className="button button-outline small" onClick={loadActivity}>Refresh</button></div>
      {!isDemo && isMember && <section className="group-chat-presence" aria-live="polite" aria-label="Group members online">
        <div className="group-chat-presence-heading">
          <span className={`group-chat-presence-dot${presenceStatus === 'online' ? ' is-live' : ''}`} />
          <b>{presenceStatus === 'connecting' ? 'Checking who is online…' : presenceStatus === 'unavailable' ? 'Online status unavailable' : `${onlineMembers.length} member${onlineMembers.length === 1 ? '' : 's'} online`}</b>
          {presenceStatus === 'online' && <span className="group-chat-presence-context">in this group chat</span>}
        </div>
        {presenceStatus === 'unavailable' ? <p className="group-chat-presence-note" role="status">{presenceError || 'Online status is currently unavailable.'}</p> : onlineMembers.length > 0 ? <div className="group-chat-online-list">
          {onlineMembers.slice(0, 8).map(member => <span className="group-chat-online-member" key={member.user_id} title={member.display_name}>
            <ProfileAvatar profile={{ display_name: member.display_name, avatar_url: member.avatar_url }} name={member.display_name} className="profile-avatar-presence" />
            <span>{member.user_id === user?.id ? 'You' : member.display_name}</span>
            <i aria-label="Online" />
          </span>)}
          {onlineMembers.length > 8 && <span className="group-chat-online-extra">+{onlineMembers.length - 8} more</span>}
        </div> : presenceStatus === 'online' ? <p className="group-chat-presence-note">Connecting to the online member list…</p> : null}
      </section>}
      {!isDemo && !isMember && <div className="group-chat-presence guest-presence-note">Online member status is available to approved group members.</div>}
      <div className="chat-messages">{loading ? <p className="muted">Loading messages…</p> : messages.length ? messages.map(msg => {
        const imageUrl = safeImageUrl(supabase, msg.image_path)
        const videoUrl = safeImageUrl(supabase, msg.video_path)
        const replyParent = msg.reply_to_message_id ? messages.find(item => item.id === msg.reply_to_message_id) : null
        return <div key={msg.id} className={`chat-bubble ${msg.author_id === user?.id ? 'mine' : ''}`}>
          <div className="chat-author-row"><ProfileAvatar profile={msg.profiles} name={authorName(msg)} className="profile-avatar-chat" /><small>{authorName(msg)} · {displayTime(msg.created_at)}</small></div>
          {msg.reply_to_message_id && <div className="chat-reply-context"><b>↪ {replyParent ? `Reply to ${authorName(replyParent)}` : 'Reply to a message'}</b><span>{replyParent ? (replyParent.body || (replyParent.video_path ? '🎬 Video' : replyParent.image_path ? '📷 Photo' : 'Message')).slice(0, 110) : 'Original message'}</span></div>}
          {msg.body && <p className="rich-text">{renderRichText(msg.body)}</p>}
          {videoUrl && <div className="chat-media"><video className="chat-video" src={videoUrl} controls preload="metadata">Your browser does not support video playback.</video></div>}
          {imageUrl && <div className="chat-media"><a className="chat-image-frame" href={imageUrl} target="_blank" rel="noreferrer"><img className="group-post-image" src={imageUrl} alt="Chat attachment" loading="lazy" /></a>{(msg.author_id === user?.id || isGroupAdmin || isSiteAdmin) && msg.body?.trim() && <button type="button" className="content-action-button" disabled={Boolean(mediaActionBusy[`group_messages:${msg.id}:photo`])} onClick={() => removeGroupPhoto(msg, 'group_messages', 'message')}>{mediaActionBusy[`group_messages:${msg.id}:photo`] ? 'Removing…' : 'Remove photo'}</button>}</div>}
          {isMember && <div className="chat-message-actions"><button type="button" onClick={() => { setReplyTarget(msg); setPrivatePanelOpen(false) }}>↩ Reply</button><button type="button" onClick={() => openPrivateReplies(msg)}>{msg.author_id === user?.id ? '✉ Private replies' : '✉ Private reply'}</button>{(msg.author_id === user?.id || isGroupAdmin || isSiteAdmin) && <button type="button" className="chat-delete-action" disabled={Boolean(mediaActionBusy[`message:${msg.id}:delete`])} onClick={() => deleteChatMessage(msg)}>{mediaActionBusy[`message:${msg.id}:delete`] ? 'Deleting…' : 'Delete message'}</button>}</div>}
        </div>
      }) : <div className="empty-state">No messages yet. Start the conversation.</div>}</div>

      {privatePanelOpen && privateTarget && <section className="private-chat-panel" aria-label="Private replies">
        <header className="private-chat-heading"><div><b>🔒 Private replies</b><span>About: “{(privateTarget.body || (privateTarget.image_path ? 'Photo shared in chat' : 'Group message')).slice(0, 90)}”</span></div><button type="button" className="close-private-chat" onClick={() => { setPrivatePanelOpen(false); setPrivateTarget(null); setPrivateMessages([]); setPrivatePeerId('') }} aria-label="Close private replies">×</button></header>
        {privateTarget.author_id === user?.id && <div className="private-peer-list">{buildPrivatePeers(privateMessages, user?.id).length ? buildPrivatePeers(privateMessages, user?.id).map(peer => <button type="button" key={peer.id} className={privatePeerId === peer.id ? 'selected' : ''} onClick={() => setPrivatePeerId(peer.id)}><b>{peer.name}</b><small>{peer.lastMessage}</small></button>) : <p className="muted">No private replies to this message yet. When a member privately replies to your message, their conversation will appear here.</p>}</div>}
        {privatePeerId && <div className="private-thread-messages">{privateLoading ? <p className="muted">Loading private conversation…</p> : privateMessages.filter(item => (item.sender_id === user?.id && item.recipient_id === privatePeerId) || (item.sender_id === privatePeerId && item.recipient_id === user?.id)).map(item => <article key={item.id} className={`private-thread-message ${item.sender_id === user?.id ? 'mine' : ''}`}><b>{item.sender_id === user?.id ? 'You' : item.sender_name}</b><p className="rich-text">{renderRichText(item.body)}</p><small>{displayTime(item.created_at)}</small></article>)}{!privateLoading && !privateMessages.some(item => (item.sender_id === user?.id && item.recipient_id === privatePeerId) || (item.sender_id === privatePeerId && item.recipient_id === user?.id)) && <p className="muted">This private conversation is ready. Send the first message below.</p>}</div>}
        {privateError && <p className="social-error" role="alert">{privateError}</p>}
        {privatePeerId && <form className="private-chat-composer" onSubmit={submitPrivateReply}><textarea rows={2} value={privateDraft} onChange={event => setPrivateDraft(event.target.value)} maxLength={2000} disabled={privateSending} placeholder={`Private message to ${privateTarget.author_id === user?.id ? (buildPrivatePeers(privateMessages, user?.id).find(peer => peer.id === privatePeerId)?.name || 'group member') : authorName(privateTarget)}…`} /><div className="private-chat-tools"><EmojiStickerPicker compact disabled={privateSending} onEmoji={emoji => setPrivateDraft(value => appendText(value, emoji))} onSticker={emoji => setPrivateDraft(value => appendText(value, `[[sticker:${emoji}]]`))} /><RemoveStickersButton value={privateDraft} onRemove={() => setPrivateDraft(removeStickerMarkup(privateDraft))} /><button type="submit" className="button button-primary small" disabled={privateSending || !privateDraft.trim()}>{privateSending ? 'Sending…' : 'Send privately'}</button></div></form>}
      </section>}

      {!isDemo && <form className="chat-composer" onSubmit={submitMessage}>
        {replyTarget && <div className="reply-composer-banner"><div><b>↩ Replying to {authorName(replyTarget)}</b><span>{(replyTarget.body || (replyTarget.image_path ? '📷 Photo' : 'Message')).slice(0, 110)}</span></div><button type="button" onClick={() => setReplyTarget(null)} aria-label="Cancel reply">×</button></div>}
        <textarea rows={2} value={chatText} onChange={e => setChatText(e.target.value)} disabled={!isMember || sending} maxLength={2000} placeholder={isMember ? 'Write a message…' : 'Join and wait for approval to chat'} />
        <div className="chat-composer-tools"><EmojiStickerPicker compact disabled={!isMember || sending} onEmoji={appendChatEmoji} onSticker={appendChatSticker} /><RemoveStickersButton value={chatText} onRemove={() => setChatText(removeStickerMarkup(chatText))} /><PhotoPicker compact disabled={!isMember || sending || Boolean(chatVideo)} file={chatPhoto} onChange={file => { setChatPhoto(file); if (file) setChatVideo(null) }} onClear={() => setChatPhoto(null)} label="📷" /><VideoPicker disabled={!isMember || sending || Boolean(chatPhoto)} file={chatVideo} onChange={file => { setChatVideo(file); if (file) setChatPhoto(null) }} onClear={() => setChatVideo(null)} /><button className="button button-primary small" disabled={!isMember || sending || (!chatText.trim() && !chatPhoto && !chatVideo)}>{sending ? 'Sending…' : 'Send'}</button></div>
      </form>}
    </div>}
    {tab === 'requests' && isGroupAdmin && <div className="admin-list">{!requests.length ? <div className="empty-state">There are no pending join requests.</div> : requests.map(request => <article className="admin-item" key={request.id}><div><b>{request.profiles?.display_name || 'Student'}</b><span>Requested {displayTime(request.requested_at)}</span></div><div className="admin-actions"><button className="button button-primary small" disabled={requestLoading} onClick={() => reviewMembership(request, true)}>Approve</button><button className="button button-outline small" disabled={requestLoading} onClick={() => reviewMembership(request, false)}>Decline</button></div></article>)}</div>}
    {tab === 'group-admin' && canManageGroupAdmins && <section className="group-admin-panel">
      <div className="access-note"><span>◎</span><span>{isSiteAdmin ? (activeGroupAdmin ? `Current group admin: ${activeGroupAdmin.profiles?.display_name || 'Member'}. As the main site admin, you can appoint or replace the group admin.` : 'No active group admin is assigned. As the main site admin, choose an approved member below. Only the main site admin can restore group admin control after the group admin leaves.') : 'Choose an approved member to take over as the group admin. This transfers the role: you will become a regular member.'}</span></div>
      <div className="admin-list">{!groupMembers.length ? <div className="empty-state">No approved members could be found for this group.</div> : groupMembers.map(member => {
        const name = member.profiles?.display_name || 'Student'
        const isSelf = member.user_id === user?.id
        const isSoleCurrentAdmin = member.role === 'admin' && currentGroupAdmins.length === 1
        const actionLabel = member.role === 'admin' && !isSoleCurrentAdmin ? 'Make sole admin' : isSoleCurrentAdmin ? 'Current group admin' : adminChangeBusy === member.user_id ? 'Assigning…' : isSiteAdmin ? 'Appoint as admin' : 'Transfer admin role'
        const canAssign = !isSoleCurrentAdmin && (isSiteAdmin || !isSelf)
        return <article className="admin-item" key={member.id}><div><b>{name}{isSelf ? ' (you)' : ''}</b><span>{member.role === 'admin' ? 'Current group admin' : 'Approved member'}</span></div><div className="admin-actions"><button type="button" className="button button-primary small" disabled={!canAssign || Boolean(adminChangeBusy)} onClick={() => assignGroupAdmin(member)}>{actionLabel}</button></div></article>
      })}</div>
    </section>}
    {isDemo && <p className="preview-note">These are sample records for preview only. Join requests, posts, comments, reactions, chat and photo uploads work only for real groups in the connected database.</p>}
  </section></div>
}
