// Cache-busting entry point for the trail-alignment fix.
// Import the patched app-v4 under a new URL so browsers cannot reuse the pre-fix module.
import './app-v4.js?v=ptolemy-trail-align-20260819-0020';
