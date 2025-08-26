// src/registerSW.js
import { Workbox } from 'workbox-window';

export function registerSW() {
  if ('serviceWorker' in navigator) {
    const PUBLIC_URL = process.env.PUBLIC_URL; // CRA ビルド時に正しいサブフォルダが入る
    const wb = new Workbox(`${PUBLIC_URL}/sw.js`);

    // SW がアクティブ化されたとき
    wb.addEventListener('activated', (event) => {
      if (!event.isUpdate) {
        console.log('Service Worker activated for the first time');
      } else {
        console.log('Service Worker updated');
        // 更新後は即リロードして最新ファイルを反映
        window.location.reload();
      }
    });

    // 新しい SW が waiting 状態になったら skipWaiting を送信
    wb.addEventListener('waiting', (event) => {
      console.log('New SW waiting, sending SKIP_WAITING');
      wb.messageSW({ type: 'SKIP_WAITING' });
    });

    // エラーや更新をログ
    wb.addEventListener('redundant', () => {
      console.log('The installed service worker became redundant.');
    });

    wb.addEventListener('installed', (event) => {
      if (event.isUpdate) {
        console.log('A new version of the service worker has been installed.');
      }
    });

    // SW 登録
    wb.register();
  }
}
