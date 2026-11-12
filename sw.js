// 彻底放行的 Service Worker，用于清除旧缓存
self.addEventListener('install', (e) => {
    self.skipWaiting();
});
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                return caches.delete(key);
            }));
        }).then(() => self.clients.claim())
    );
});
// 直接走网络，绝不拦截任何请求，防止 503
self.addEventListener('fetch', (e) => {
    // 什么都不做，让浏览器默认处理请求
});