import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ims': {
        target: 'https://ims.ritchennai.edu.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ims/, ''),
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // 1. Rewrite Location header to keep redirects pointing to the local proxy
            const location = proxyRes.headers['location'];
            if (location) {
              let rewrittenLocation = location;
              
              // If redirecting to the absolute target URL, swap with local proxy URL
              if (rewrittenLocation.includes('ims.ritchennai.edu.in')) {
                rewrittenLocation = rewrittenLocation.replace(/https:\/\/ims\.ritchennai\.edu\.in/gi, 'http://localhost:5173/ims');
              } else if (rewrittenLocation.startsWith('/')) {
                // If it is a relative redirect, prepend /ims to route it through proxy
                rewrittenLocation = '/ims' + rewrittenLocation;
              }
              
              proxyRes.headers['location'] = rewrittenLocation;
            }

            // 2. Tweak cookies to allow them on HTTP localhost without domain restrictions
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map((cookie) =>
                cookie
                  .replace(/Secure/gi, '')
                  .replace(/samesite=none/gi, 'SameSite=Lax')
                  .replace(/domain=[^;]+/gi, '')
              );
            }
          });
        }
      }
    }
  }
})
