import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Workbox 用の SW 登録関数
import { registerSW } from './registerSW';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Workbox SW を登録して更新を即時反映
registerSW({
  onRegistered: (registration) => {
    console.log('Service Worker registered:', registration);

    // 新しい SW が見つかったら即座に skipWaiting
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    registration.addEventListener('updatefound', () => {
      const newSW = registration.installing;
      if (newSW) {
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            newSW.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });
  },
  onNeedRefresh: () => {
    console.log('New content is available; please refresh.');
    // 必要ならここで自動リロードも可能
    window.location.reload();
  },
  onOfflineReady: () => {
    console.log('App is ready to work offline.');
  },
});

reportWebVitals();
