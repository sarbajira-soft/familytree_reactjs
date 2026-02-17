import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if (typeof window !== 'undefined') {

    const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)

  const meta = document.querySelector('meta[name="viewport"]')
  if (meta && isMobile) {
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
    )
  }


  // Disable blocking native dialogs across the app.
  window.alert = () => {}
  window.confirm = () => true
  window.prompt = () => null
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)
