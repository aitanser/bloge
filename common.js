/* ============================================
   全局核心逻辑
   ============================================ */
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 微后端探测
window.MICRO_BACKEND_API = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? window.location.origin : '';

async function loadJSON(url) {
    try {
        // 静态文件不走代理
        if (url.includes('index')) {
            const r = await fetch(url, { cache: 'no-cache' });
            return r.ok ? await r.json() : { articles: [], cards: [], files: [] };
        }
        // 走微后端配置
        if (window.MICRO_BACKEND_API && url.startsWith('data/')) {
            const name = url.replace('data/', '').replace('.json', '');
            const r = await fetch(window.MICRO_BACKEND_API + '/api/data/' + name);
            if (r.ok) return await r.json();
        }
        const r = await fetch(url, { cache: 'no-cache' });
        return r.ok ? await r.json() : [];
    } catch (e) { return []; }
}

// 解析 Markdown
async function loadMarkdownArticle(url) {
    try {
        const r = await fetch(url); if (!r.ok) return null;
        const text = await r.text();
        const lines = text.split('\n');
        if (lines[0].trim() === '---') {
            const end = lines.indexOf('---', 1);
            const meta = {};
            for (let i = 1; i < end; i++) {
                const [k, ...v] = lines[i].split(':');
                if (k) meta[k.trim()] = v.join(':').trim().replace(/^["']|["']$/g, '');
            }
            return { meta, content: lines.slice(end + 1).join('\n') };
        }
        return { meta: { title: '无标题' }, content: text };
    } catch (e) { return null; }
}

// 挂载头尾
async function loadLayout() {
    try {
        const [hr, fr] = await Promise.all([fetch('header.html'), fetch('footer.html')]);
        if (hr.ok) document.body.insertAdjacentHTML('afterbegin', await hr.text());
        if (fr.ok) document.body.insertAdjacentHTML('beforeend', await fr.text());
        markActiveNav();
        // 导航“更多”下拉
        (function bindMoreMenu() {
            const moreBtn = document.getElementById('moreMenuBtn');
            const morePanel = document.getElementById('moreMenuPanel');
            if (!moreBtn || !morePanel) return;
            moreBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                morePanel.classList.toggle('show');
            };
            document.addEventListener('click', (e) => {
                if (!moreBtn.contains(e.target) && !morePanel.contains(e.target)) {
                    morePanel.classList.remove('show');
                }
            });
        })();
        initThemeTools();
        initPlayer();
    } catch (e) { console.warn('Layout load failed'); }
}

function markActiveNav() {
    const file = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(el => {
        if (el.getAttribute('href') === file) el.classList.add('active');
    });
}

// 初始化主题与颜色选择器
function initThemeTools() {
    const themeBtn = document.getElementById('themeQuickBtn');
    if (themeBtn) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        
        themeBtn.onclick = () => {
            const cur = document.documentElement.getAttribute('data-theme');
            const next = cur === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            themeBtn.innerHTML = next === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
            
            // 同步 iframe
            const p = document.getElementById('playerIframe');
            if (p && p.contentWindow) p.contentWindow.postMessage({ type: 'themeChange', theme: next }, '*');
        };
    }

    const colorBtn = document.getElementById('colorQuickBtn');
    if (colorBtn) {
        colorBtn.onclick = (e) => {
            e.stopPropagation();
            let panel = document.getElementById('colorPickerPanel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'colorPickerPanel';
                panel.style.cssText = 'position:fixed; top:60px; right:120px; background:var(--bg-card); border:1px solid var(--border-light); padding:10px; border-radius:12px; display:flex; gap:10px; z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.1);';
                const colors = ['default', 'purple', 'mint', 'sunset', 'sakura'];
                const hex = { default: '#06b6d4', purple: '#a855f7', mint: '#10b981', sunset: '#f97316', sakura: '#f472b6' };
                panel.innerHTML = colors.map(c => '<div onclick="window.changeColor(\'' + c + '\')" style="width:24px;height:24px;border-radius:50%;background:' + hex[c] + ';cursor:pointer;"></div>').join('');
                document.body.appendChild(panel);
            }
            panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        };
    }
}

window.changeColor = (color) => {
    document.documentElement.setAttribute('data-color-theme', color);
    localStorage.setItem('colorTheme', color);
    document.getElementById('colorPickerPanel').style.display = 'none';
    
    // 同步 iframe
    const p = document.getElementById('playerIframe');
    if (p && p.contentWindow) p.contentWindow.postMessage({ type: 'colorChange', color }, '*');
};

// 初始化播放器
function initPlayer() {
    const btn = document.getElementById('playerToggleBtn');
    const p = document.getElementById('floatingPlayer');
    const f = document.getElementById('playerIframe');
    const closeBtn = document.getElementById('winCloseBtn');
    const titlebar = p ? p.querySelector('.player-titlebar') : null;
    
    if (!btn || !p || !f) return;

    btn.onclick = (e) => {
        e.preventDefault();
        const isVisible = p.style.visibility === 'visible';
        if (!isVisible) {
            if (!f.src || f.src === 'about:blank' || f.src.endsWith('/about:blank')) f.src = 'Vocaloidplayer.html';
            p.style.left = (window.innerWidth - 780) / 2 + 'px';
            p.style.top = (window.innerHeight - 480) / 2 + 'px';
            p.style.opacity = '1';
            p.style.visibility = 'visible';
        } else {
            p.style.opacity = '0';
            p.style.visibility = 'hidden';
        }
    };

    if (closeBtn) closeBtn.onclick = () => { p.style.opacity = '0'; p.style.visibility = 'hidden'; };

    if (titlebar) {
        let isDragging = false, startX, startY, initL, initT;
        titlebar.onmousedown = (e) => {
            if (e.target.closest('.win-btn')) return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            initL = p.offsetLeft; initT = p.offsetTop;
            titlebar.style.cursor = 'grabbing';
        };
        document.onmousemove = (e) => {
            if (!isDragging) return;
            p.style.left = (initL + e.clientX - startX) + 'px';
            p.style.top = (initT + e.clientY - startY) + 'px';
        };
        document.onmouseup = () => { isDragging = false; titlebar.style.cursor = 'grab'; };
    }
}

// 启动


/* ================= 统一卡片渲染 ================= */
function renderContentCard(item, kind) {
    var meta = item.meta || {};
    var cls = kind === 'article' ? 'article-card' : (kind === 'card' ? 'card-item' : 'file-item');
    var tagsHtml = '';
    if (Array.isArray(meta.tags)) {
        for (var i = 0; i < meta.tags.length; i++) {
            tagsHtml += '<span class="tag-badge">#' + escapeHtml(meta.tags[i]) + '</span>';
        }
    }
    var html = '<div class="' + cls + '" data-title="' + escapeHtml(meta.title || '') + '" data-date="' + escapeHtml(meta.date||'') + '" data-content="' + encodeURIComponent(item.content || '') + '">';
    // 注意这里：完全删除了内联的 color 属性
    html += '<div class="card-date" style="font-size:0.8rem; margin-bottom:0.5rem;">' + escapeHtml(meta.date || '') + '</div>';
    html += '<h3 class="card-title" style="font-size:1.2rem; font-weight:700; margin-bottom:0.5rem;">' + escapeHtml(meta.title || '无标题') + '</h3>';
    html += '<p class="card-desc" style="font-size:0.9rem; line-height:1.5; margin-bottom:1rem;">' + escapeHtml(meta.summary || '') + '</p>';
    html += '<div>' + tagsHtml + '</div>';
    html += '</div>';
    return html;
}

/* ================= 多语言系统 ================= */
let currentLang = localStorage.getItem('lang') || 'zh';
const SHORT_LANG = { zh: '中', en: 'EN', ja: '日', ko: '한' };

async function loadLanguage(lang) {
    try {
        const res = await fetch(`lang/${lang}.json`);
        const dict = await res.json();
        
        // 遍历页面上所有带有 data-i18n 的元素
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                if (el.tagName === 'INPUT') el.placeholder = dict[key];
                else el.textContent = dict[key];
            }
        });

        // 更新按钮显示
        const langBtn = document.getElementById('langQuickBtn');
        if (langBtn) langBtn.textContent = SHORT_LANG[lang] || '中';
        
        localStorage.setItem('lang', lang);
        currentLang = lang;
        document.documentElement.lang = lang;
    } catch (e) {
        console.warn('多语言加载失败', e);
    }
}



document.addEventListener('DOMContentLoaded', () => {
    document.body.setAttribute('data-glass', 'true');
    document.body.setAttribute('data-glass', 'true');
    document.documentElement.style.setProperty('--glass-alpha', (localStorage.getItem('hz_glass_alpha') || 65) / 100);
    
    // 启动时先加载布局，再加载语言
    loadLayout().then(() => {
        loadLanguage(currentLang);
    });

    // 给语言按钮绑定点击
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('#langQuickBtn')) {
            showLangMenu(e.target.closest('#langQuickBtn'));
        }
    });
});

/* ================= 语言选择菜单 ================= */
function showLangMenu(btn) {
    let panel = document.getElementById('langMenuPanel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'langMenuPanel';
        // 样式完美复刻调色盘
        panel.style.cssText = 'position:fixed; top:60px; right:60px; background:var(--bg-card); border:1px solid var(--border-light); padding:8px; border-radius:12px; display:flex; flex-direction:column; gap:4px; z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.1); min-width:100px;';
        
        const langs = [
            { code: 'zh', name: '中文' },
            { code: 'en', name: 'English' },
            { code: 'ja', name: '日本語' },
            { code: 'ko', name: '한국어' }
        ];

        let html = '';
        langs.forEach(l => {
            html += '<div class="lang-item" onclick="selectLanguage(\'' + l.code + '\')" style="padding:8px 12px; font-size:0.85rem; border-radius:6px; cursor:pointer; color:var(--text-title); transition:background 0.2s;" onmouseover="this.style.background=\'rgba(6,182,212,0.1)\'; this.style.color=\'var(--primary-500)\';" onmouseout="this.style.background=\'transparent\'; this.style.color=\'var(--text-title)\';" data-code="' + l.code + '">' + l.name + '</div>';
        });
        
        panel.innerHTML = html;
        document.body.appendChild(panel);
    }

    // 切换显示状态
    const isHidden = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = isHidden ? 'flex' : 'none';

    // 点击外部关闭
    setTimeout(() => {
        const closeMenu = (e) => {
            if (!panel.contains(e.target) && !btn.contains(e.target)) {
                panel.style.display = 'none';
                document.removeEventListener('click', closeMenu);
            }
        };
        document.addEventListener('click', closeMenu);
    }, 10);
}

window.selectLanguage = function(lang) {
    loadLanguage(lang);
    const panel = document.getElementById('langMenuPanel');
    if (panel) panel.style.display = 'none';
};
