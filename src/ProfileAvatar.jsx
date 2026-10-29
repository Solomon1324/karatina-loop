import { useEffect, useState } from 'react'

export default function ProfileAvatar({ profile, name, className = '' }) {
  const displayName = profile?.display_name || name || 'Student'
  const url = profile?.avatar_url || ''
  const [failed, setFailed] = useState(false)

  useEffect(() => { setFailed(false) }, [url])

  const classes = `profile-avatar ${className}`.trim()
  if (url && !failed) {
    return <img
      className={classes}
      src={url}
      alt={`${displayName}'s profile picture`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  }

  return <span className={`${classes} profile-avatar-fallback`} aria-label={`${displayName}'s profile`} title={displayName}>
    {(displayName.trim()[0] || 'S').toUpperCase()}
  </span>
}
