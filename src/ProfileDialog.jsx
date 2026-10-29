import { useEffect, useState } from 'react'

export default function ProfileDialog({ supabase, user, onClose, notify }) {
  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.name || ''
  )
  const [avatarUrl, setAvatarUrl] = useState('')
  const [originalAvatarUrl, setOriginalAvatarUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      if (!supabase || !user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return
      if (error) {
        notify('Could not load your profile: ' + error.message)
      } else if (data) {
        setDisplayName(data.display_name || '')
        setAvatarUrl(data.avatar_url || '')
        setOriginalAvatarUrl(data.avatar_url || '')
      }
      setLoading(false)
    }

    loadProfile()
    return () => { active = false }
  }, [supabase, user, notify])

  async function saveProfile(event) {
    event.preventDefault()
    if (!supabase || !user) {
      notify('Please sign in again.')
      return
    }

    setSaving(true)
    try {
      const { data: existingProfile, error: readError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (readError) throw readError

      const values = {
        display_name: displayName.trim(),
        avatar_url: avatarUrl || null
      }

      const result = existingProfile
        ? await supabase.from('profiles').update(values).eq('id', user.id)
        : await supabase.from('profiles').insert({ id: user.id, ...values })

      if (result.error) throw result.error

      // Remove the previous uploaded image from storage when the user clears or replaces it.
      if (originalAvatarUrl && originalAvatarUrl !== avatarUrl) {
        const marker = '/storage/v1/object/public/profile-avatars/'
        const markerIndex = originalAvatarUrl.indexOf(marker)
        if (markerIndex !== -1) {
          const oldPath = decodeURIComponent(originalAvatarUrl.slice(markerIndex + marker.length).split('?')[0])
          if (oldPath.startsWith(`${user.id}/`)) {
            const { error: removeError } = await supabase.storage.from('profile-avatars').remove([oldPath])
            if (removeError) notify('Profile saved, but the old picture could not be deleted from storage: ' + removeError.message)
          }
        }
      }
      setOriginalAvatarUrl(avatarUrl || '')
      notify('Profile saved successfully.')
      onClose()
    } catch (error) {
      notify('Could not save your profile: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      notify('Please choose an image file.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('Choose a picture smaller than 5 MB.')
      event.target.value = ''
      return
    }

    setSaving(true)
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${crypto.randomUUID()}.${extension}`

      const { error } = await supabase.storage
        .from('profile-avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        })

      if (error) throw error

      const { data } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(path)

      setAvatarUrl(data.publicUrl)
      notify('Picture uploaded. Click Save profile to keep it on your profile.')
    } catch (error) {
      notify('Picture upload failed: ' + error.message)
    } finally {
      setSaving(false)
      event.target.value = ''
    }
  }

  return (
    <div className="veil" role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <section className="dialog" role="dialog" aria-modal="true"
        aria-labelledby="profileTitle">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <span className="eyebrow">Your account</span>
        <h2 id="profileTitle">My Profile</h2>
        <p className="muted">Choose a picture and the name other students will see.</p>

        {loading ? <p>Loading profile…</p> : (
          <form className="form-stack" onSubmit={saveProfile}>
            <div style={{ textAlign: 'center', margin: '8px 0 16px' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Your profile"
                  style={{
                    width: 112, height: 112, borderRadius: '50%',
                    objectFit: 'cover', display: 'block', margin: '0 auto 12px'
                  }} />
              ) : (
                <div style={{
                  width: 112, height: 112, borderRadius: '50%',
                  background: '#e8eee8', display: 'grid', placeItems: 'center',
                  fontSize: 40, margin: '0 auto 12px'
                }}>👤</div>
              )}

              <label>
                Change profile picture
                <input type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={uploadAvatar} disabled={saving} />
              </label>
              <p className="muted">JPG, PNG, WebP or GIF · Maximum 5 MB</p>
              {avatarUrl && (
                <button type="button" className="button button-outline small"
                  disabled={saving} onClick={() => setAvatarUrl('')}
                  style={{ marginTop: 4 }}>Remove profile picture</button>
              )}
            </div>

            <label>
              Edit display name
              <input value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                required maxLength={80} />
            </label>

            <label>
              Email address
              <input value={user?.email || ''} readOnly />
            </label>

            <button className="button button-primary full" disabled={saving || loading}>
              {saving ? 'Please wait…' : 'Save profile'}
            </button>
          </form>
        )}
      </section>
    </div>
  )
}
