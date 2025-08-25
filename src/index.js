import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// あなたが作った registerSW を import
import { registerSW } from './registerSW';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// CRA の serviceWorkerRegistration は使わない
// serviceWorkerRegistration.unregister();

// 代わりに Workbox を登録
registerSW();

reportWebVitals();
