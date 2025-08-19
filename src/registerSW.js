// src/registerSW.js
import { Workbox } from 'workbox-window';

export function registerSW() {
  if ('serviceWorker' in navigator) {
    const PUBLIC_URL = process.env.PUBLIC_URL; // CRA ビルド時に正しいサブフォルダが入る
    const wb = new Workbox(`${PUBLIC_URL}/sw.js`);

    wb.addEventListener('activated', () => console.log('SW activated'));
    wb.register();
  }
}
