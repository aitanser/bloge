/**
 * 鸿渚の灵质空间 - 纯净稳定后端
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = 'hongzhu123';
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'application/javascript', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.gif':'image/gif', '.ico':'image/x-icon', '.mp3':'audio/mpeg', '.md':'text/markdown; charset=utf-8' };

process.on('uncaughtException', e => console.error('防崩拦截:', e.message));

const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
    const pathname = decodeURIComponent(reqUrl.pathname);

    // 强制补全无后缀请求
    if (!path.extname(pathname) && pathname !== '/' && pathname !== '') {
        res.writeHead(301, { 'Location': pathname + '.html' });
        res.end();
        return;
    }


    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // API: 读写数据
    if (pathname.startsWith('/api/data/')) {
        const name = pathname.replace('/api/data/', '');
        const dataPath = path.join(__dirname, 'data', name + '.json');
        if (req.method === 'GET') {
            fs.readFile(dataPath, 'utf8', (err, data) => {
                if (err) { res.writeHead(404); res.end('Not found'); return; }
                res.writeHead(200, {'Content-Type':'application/json'}); res.end(data);
            });
        } else if (req.method === 'POST') {
            if (req.headers['authorization'] !== ADMIN_TOKEN) { res.writeHead(401); res.end(); return; }
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => { fs.writeFile(dataPath, body, 'utf8', () => { res.writeHead(200); res.end('OK'); }); });
        }
        return;
    }

    // API: B站代理
    if (pathname === '/api/bili') {
        const target = reqUrl.searchParams.get('url');
        if (!target) { res.writeHead(400); res.end(); return; }
        const client = target.startsWith('https') ? https : http;
        client.get(target, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://space.bilibili.com/', 'Cookie': 'buvid3=infoc;' } }, proxyRes => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        }).on('error', () => { res.writeHead(500); res.end(); });
        return;
    }

    // API: 扫描本地音乐
    if (pathname === '/api/songs') {
        const dir = path.join(__dirname, 'Vocaloid');
        if (!fs.existsSync(dir)) { res.writeHead(200); res.end('[]'); return; }
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp3'));
        const songs = files.map(f => ({ name: f.replace('.mp3', '') }));
        res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(songs)); return;
    }

    // 静态服务 (支持音频 Range 与补全后缀)
    let filePath = path.join(__dirname, pathname.replace(/^\//, ''));
    if (pathname === '/' || pathname === '') filePath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(filePath) && !path.extname(filePath)) { if (fs.existsSync(filePath + '.html')) filePath += '.html'; }

    fs.stat(filePath, (err, stat) => {
        if (err || stat.isDirectory()) { res.writeHead(404); res.end('404'); return; }
        
        let ext = path.extname(filePath).toLowerCase();
        let mime = MIME[ext] || 'text/plain';
        
        // 开发防缓存
        if (['.html', '.js', '.css', '.json', '.md'].includes(ext)) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        }
        
        const range = req.headers.range;
        if (range && mime.startsWith('audio/')) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunksize = (end - start) + 1;
            res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': chunksize, 'Content-Type': mime });
            fs.createReadStream(filePath, { start, end }).on('error',()=>{}).pipe(res);
        } else {
            res.writeHead(200, { 'Content-Type': mime, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
            fs.createReadStream(filePath).on('error',()=>{}).pipe(res);
        }
    });
});
server.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    
    // 终端美化输出
    console.log('\x1b[36m%s\x1b[0m', '=============================================');
    console.log('\x1b[32m%s\x1b[0m', '   🚀 鸿渚の灵质空间 - 微后端已启动');
    console.log('\x1b[36m%s\x1b[0m', '=============================================');
    console.log('   🌐 前台首页: \x1b[4m%s\x1b[0m', url);
    console.log('   ⚙️  管理后台: \x1b[4m%s\x1b[0m', url + '/admin.html');
    console.log('   🔑 修改令牌: \x1b[33m%s\x1b[0m', 'hongzhu123');
    console.log('\x1b[36m%s\x1b[0m', '=============================================\n');

    // 2. 自动打开浏览器（指向首页，而不是后台）
    const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
    const { exec } = require('child_process');
    
    // 延迟 500ms 打开，确保服务完全就绪
    setTimeout(() => {
        exec(`${startCmd} ${url}`, (err) => {
            if (err) console.log('⚠️  自动打开浏览器失败，请手动点击上面的链接。');
        });
    }, 500);
});
