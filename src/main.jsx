import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

if (typeof window !== 'undefined') {
  // Disable blocking native dialogs across the app.
  window.alert = () => {}
  window.confirm = () => true
  window.prompt = () => null
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)
