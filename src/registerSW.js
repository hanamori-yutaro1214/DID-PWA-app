// src/registerSW.js
import { Workbox } from 'workbox-window';

export function registerSW() {
  if ('serviceWorker' in navigator) {
    const wb = new Workbox('/sw.js');
    wb.addEventListener('activated', () => console.log('SW activated'));
    wb.register();
  }
}
