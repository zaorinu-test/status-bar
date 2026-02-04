/**
 * Dynamic Status Banner System - Smart Reading Edition (High Visibility)
 */
(function() {
    if (window.__STATUS_BANNER_RUNNING__) return;
    window.__STATUS_BANNER_RUNNING__ = true;

    const self = document.querySelector('script[data-status-bar]');
    const JSON_URL = self ? self.getAttribute('data-status-bar') : 'data.json';

    const CONFIG = {
        BASE_DELAY: 3000,
        READING_SPEED: 180,
        TRANSITION_DURATION: 600,
        STORAGE_KEY: 'app_banner_system',
        BANNER_COLOR: '#FFF2C6',
        BAR_HEIGHT: '35px',
        MIN_WIDTH_SAFE: 600,
        CENTER_BREAKPOINT: 2500,
        POLLING_INTERVAL: 60000
    };

    let state = {
        alerts: [],
        index: 0,
        timer: null,
        refreshTimer: null,
        lock: false
    };

    const getHash = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString(36);
    };

    const getReadingTime = (text) => {
        const words = text.trim().split(/\s+/).length;
        const readingMs = (words / CONFIG.READING_SPEED) * 60 * 1000;
        return Math.max(CONFIG.BASE_DELAY, readingMs + 2000); 
    };

    const store = {
        get: () => {
            try {
                return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || { cache: [], dismissed: {} };
            } catch (e) { return { cache: [], dismissed: {} }; }
        },
        save: (data) => localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data))
    };

    function cleanup() {
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
    }

    function injectStyles() {
        if (document.getElementById('status-styles')) return;
        const style = document.createElement('style');
        style.id = 'status-styles';
        style.textContent = `
            #status-bar {
                position: fixed; top: 0; left: 0; width: 100%; height: ${CONFIG.BAR_HEIGHT};
                z-index: 10000; overflow: hidden;
                background-color: ${CONFIG.BANNER_COLOR};
                transition: transform 0.6s cubic-bezier(0.65, 0, 0.35, 1);
                display: none; transform: translateY(-100%);
            }
            @media (min-width: ${CONFIG.MIN_WIDTH_SAFE}px) {
                #status-bar.is-visible { display: block; transform: translateY(0); }
            }
            #status-link {
                display: flex; align-items: center; justify-content: flex-start;
                width: 100%; height: 100%; padding: 0 30px; box-sizing: border-box;
                color: #000000 !important; text-decoration: none !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 13.5px; 
                font-weight: 500; 
                letter-spacing: 0.02em;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
                transition: background 0.3s;
            }
            @media (min-width: ${CONFIG.CENTER_BREAKPOINT}px) {
                #status-link { justify-content: center; padding: 0 20px; }
            }
            #status-content { display: flex; align-items: center; gap: 10px; will-change: transform, opacity; }
            #status-link:hover .status-text { text-decoration: underline; }
            
            .exit-down { animation: exitDown ${CONFIG.TRANSITION_DURATION}ms forwards cubic-bezier(0.65, 0, 0.35, 1); }
            .enter-top { animation: enterTop ${CONFIG.TRANSITION_DURATION}ms forwards cubic-bezier(0.65, 0, 0.35, 1); }
            
            @keyframes exitDown { 
                0% { transform: translateY(0); opacity: 1; filter: blur(0px); }
                100% { transform: translateY(8px); opacity: 0; filter: blur(2px); }
            }
            @keyframes enterTop { 
                0% { transform: translateY(-8px); opacity: 0; filter: blur(2px); }
                100% { transform: translateY(0); opacity: 1; filter: blur(0px); }
            }
            
            .status-arrow-svg { 
                width: 14px; height: 14px; flex-shrink: 0; transition: transform 0.4s;
            }
            #status-link:hover .status-arrow-svg { transform: translateX(5px); }
        `;
        document.head.appendChild(style);
    }

    function scheduleNext() {
        cleanup();
        if (state.alerts.length <= 1) return;
        const currentMsg = state.alerts[state.index].msg;
        const displayTime = getReadingTime(currentMsg);
        state.timer = setTimeout(() => {
            if (!state.lock) {
                state.index = (state.index + 1) % state.alerts.length;
                updateUI();
            }
        }, displayTime);
    }

    async function updateUI() {
        const bar = document.getElementById('status-bar');
        const link = document.getElementById('status-link');
        const box = document.getElementById('status-content');
        if (!bar || !link || !box || state.alerts.length === 0 || state.lock) return;

        const current = state.alerts[state.index];
        const applyData = () => {
            link.href = current.link || '#';
            box.innerHTML = `
                <span class="status-text">${current.msg}</span>
                <svg class="status-arrow-svg" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.6 1.27L16.6 5.77L12.6 10.27" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M1.6 5.77H16.6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            link.onclick = () => {
                if (current.dismissable) {
                    const disk = store.get();
                    disk.dismissed[current.id] = Date.now();
                    store.save(disk);
                }
            };
        };

        if (state.alerts.length > 1 && box.textContent.trim() !== "") {
            state.lock = true;
            box.className = 'exit-down';
            setTimeout(() => {
                applyData();
                box.className = 'enter-top';
                setTimeout(() => { 
                    box.className = ''; 
                    state.lock = false; 
                    scheduleNext();
                }, CONFIG.TRANSITION_DURATION);
            }, CONFIG.TRANSITION_DURATION * 0.7);
        } else {
            applyData();
            bar.classList.add('is-visible');
            scheduleNext();
        }
    }

    async function init(isUpdate = false) {
        if (!isUpdate) cleanup();
        const disk = store.get();
        let data = disk.cache || [];

        const fetchData = async () => {
            try {
                const resp = await fetch(`${JSON_URL}?t=${Date.now()}`);
                if (!resp.ok) return;
                const freshData = await resp.json();
                if (JSON.stringify(freshData) !== JSON.stringify(data)) {
                    disk.cache = freshData;
                    store.save(disk);
                    init(true);
                }
            } catch (e) { console.error("Banner fetch failed", e); }
        };

        state.alerts = data.filter(item => {
            if (!item.active) return false;
            item.id = getHash(item.msg);
            return !disk.dismissed[item.id];
        });

        let bar = document.getElementById('status-bar');
        if (state.alerts.length === 0) {
            if (bar) {
                bar.classList.remove('is-visible');
                setTimeout(() => bar.remove(), 600);
            }
            if (!isUpdate) fetchData();
            return;
        }

        if (!bar) {
            injectStyles();
            bar = document.createElement('div');
            bar.id = 'status-bar';
            bar.innerHTML = '<a id="status-link" target="_blank" rel="noopener"><div id="status-content"></div></a>';
            if (document.body) document.body.prepend(bar);
        }

        updateUI();
        if (!isUpdate) fetchData();
    }

    if (document.body) init();
    else window.addEventListener('DOMContentLoaded', () => init(), { once: true });
    
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => init(true), CONFIG.POLLING_INTERVAL);
})();