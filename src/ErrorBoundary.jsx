import React from 'react'

/** Shows a useful fallback instead of leaving the entire app blank after a React render error. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Keep the diagnostic in the browser console so it can be copied for debugging.
    console.error('Karatina Loop render error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ maxWidth: 680, margin: '12vh auto', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#17261f' }}>
          <p style={{ color: '#1f6a4c', fontWeight: 700, letterSpacing: 1 }}>KARATINA LOOP</p>
          <h1 style={{ fontSize: 32, lineHeight: 1.2 }}>The page could not load.</h1>
          <p>The app encountered an error while displaying the page. Refresh once. If the problem continues, open your browser’s Developer Tools → Console and share the red error message with the developer.</p>
          <button onClick={() => window.location.reload()} style={{ padding: '11px 16px', border: 0, borderRadius: 8, background: '#1f6a4c', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Reload page</button>
        </main>
      )
    }
    return this.props.children
  }
}
