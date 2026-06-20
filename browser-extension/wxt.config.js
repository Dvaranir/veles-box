import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Veles Music Downloader',
    description: 'Сохраняет лайкнутые треки Яндекс Музыки в Navidrome',
    permissions: ['storage'],
    host_permissions: ['https://music.yandex.ru/*', 'https://music-backend.dvaranir.com/*'],
    browser_specific_settings: { gecko: { id: 'veles-music@dvaranir.com', strict_min_version: '121.0' } },
  },
});
