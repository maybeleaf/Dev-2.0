import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fonts are bundled locally (no third-party requests). The accessibility fonts
// only download when someone switches to them.
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import '@fontsource-variable/dm-sans/index.css'
import '@fontsource-variable/dm-sans/wght-italic.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/opendyslexic/400.css'
import '@fontsource/opendyslexic/700.css'

import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/shell.css'

import App from './App.jsx'

// Last, so print rules win over page styles loaded by the routes.
import './styles/print.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
