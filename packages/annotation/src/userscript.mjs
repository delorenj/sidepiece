import { mountSidepiece } from './ui.mjs';
// Exact-origin allowlist, default off. Deliberately no automatic overlay.
let origins;
try { origins = JSON.parse(localStorage.getItem('sidepiece:allowed-origins') || '[]'); } catch { origins = []; }
if (Array.isArray(origins) && origins.includes(location.origin)) {
  const button = document.createElement('button');
  button.textContent = 'Sidepiece'; button.setAttribute('aria-label', 'Open Sidepiece annotations');
  button.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:2147483647;background:#182232;color:white;padding:8px;border:1px solid #8095af;border-radius:6px;cursor:pointer';
  button.onclick = () => { mountSidepiece(); button.remove(); };
  document.documentElement.append(button);
}
