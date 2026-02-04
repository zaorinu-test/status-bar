/**
 * Dynamic Status Banner System - Desktop Only Edition
 */
(function() {
    if (window.__STATUS_BANNER_RUNNING__) return;
    
    const CONFIG = {
        BASE_DELAY: 5000, // Minimum time (ms) to show each message
        READING_SPEED: 180, // Average reading speed in words per minute
        TRANSITION_DURATION: 600, // Duration of the transition animations in ms
        STORAGE_KEY: 'app_banner_system', // Key for localStorage
        BANNER_COLOR: '#FFF2C6', // Background color of the banner
        POLLING_INTERVAL: 60000, // How often to check for new messages (ms)
        CACHE_TTL: 30 * 60 * 1000, // How long to cache messages before re-fetching (ms), in this case, 30 minutes
        MOBILE_BREAKPOINT: 600 // The bar will be completely disabled on screens narrower than this width
    };

    // Immediately exit if on a mobile device to save resources, and add a CSS rule as a backup to ensure it's hidden on small screens. This way, even if the script is loaded, it won't display or consume resources unnecessarily on mobile devices.
    if (window.innerWidth < CONFIG.MOBILE_BREAKPOINT) return;
    window.__STATUS_BANNER_RUNNING__ = true;

    const self = document.querySelector('script[data-status-bar]');
    const JSON_URL = self ? self.getAttribute('data-status-bar') : 'data.json';

    let state = { alerts: [], index: 0, timer: null, lock: false };

    const store = {
        get: () => JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || { cache: [], dismissed: {}, lastFetch: 0 },
        save: (data) => localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data))
    };

    // Simple hash function to generate a unique ID for each message based on its content. This allows us to track dismissed messages without needing a backend ID.
    const getHash = (s) => [...s].reduce((h, c) => (h << 5) - h + c.charCodeAt(0) | 0, 0).toString(36);
    const getReadingTime = (t) => Math.max(CONFIG.BASE_DELAY, ((t.split(/\s+/).length / CONFIG.READING_SPEED) * 60000) + 2000);

    function injectStyles() {
        if (document.getElementById('status-styles')) return;
        const style = document.createElement('style');
        style.id = 'status-styles';
        style.textContent = `
            #status-bar { 
                position: fixed; top: 0; left: 0; width: 100%; height: 35px; z-index: 10000; 
                background: ${CONFIG.BANNER_COLOR}; transition: transform .6s cubic-bezier(.65,0,.35,1); 
                display: none; transform: translateY(-100%); overflow: hidden;
                display: flex; align-items: center; justify-content: flex-start; 
            }
            
            /* Hide on mobile devices */
            @media (max-width: ${CONFIG.MOBILE_BREAKPOINT - 1}px) {
                #status-bar { display: none !important; }
            }
            
            #status-bar.is-visible { display: flex; transform: translateY(0); }
            
            #status-link { 
                display: inline-flex; align-items: center; height: 100%; padding: 0 30px;
                color: #000 !important; text-decoration: none !important; 
                font: 500 13.5px sans-serif; cursor: pointer;
            }
            
            #status-content { display: flex; align-items: center; gap: 10px; transition: all .6s; }
            .exit-down { transform: translateY(8px); opacity: 0; }
            .enter-top { transform: translateY(-8px); opacity: 0; }
            
            .status-arrow-svg { width: 14px; transition: transform .4s; flex-shrink: 0; }
            #status-link:hover .status-text { text-decoration: underline; }
            #status-link:hover .status-arrow-svg { transform: translateX(5px); }
        `;
        document.head.appendChild(style);
    }

    async function updateUI() {
        const bar = document.getElementById('status-bar');
        const box = document.getElementById('status-content');
        const link = document.getElementById('status-link');
        
        if (!state.alerts.length || window.innerWidth < CONFIG.MOBILE_BREAKPOINT) {
            return bar?.classList.remove('is-visible');
        }

        if (state.lock || !box) return;
        const current = state.alerts[state.index % state.alerts.length];
        
        const apply = () => {
            link.href = current.link || '#';
            box.innerHTML = `<span class="status-text"></span>
                <svg class="status-arrow-svg" viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M12.6 1.27L16.6 5.77L12.6 10.27M1.6 5.77H16.6"/>
                </svg>`;
            box.querySelector('.status-text').textContent = current.msg.slice(0, 200);
            link.onclick = () => {
                if (current.dismissable) {
                    const d = store.get(); d.dismissed[current.id] = Date.now(); store.save(d);
                }
            };
        };

        if (bar.classList.contains('is-visible') && state.alerts.length > 1) {
            state.lock = true;
            box.classList.add('exit-down');
            setTimeout(() => {
                apply();
                box.className = 'enter-top';
                setTimeout(() => { box.className = ''; state.lock = false; rotate(); }, 50);
            }, CONFIG.TRANSITION_DURATION);
        } else {
            apply();
            bar.classList.add('is-visible');
            rotate();
        }
    }

    function rotate() {
        clearTimeout(state.timer);
        if (state.alerts.length > 1) {
            state.timer = setTimeout(() => {
                state.index++;
                updateUI();
            }, getReadingTime(state.alerts[state.index % state.alerts.length].msg));
        }
    }

    async function sync(forceFetch = false) {
        if (window.innerWidth < CONFIG.MOBILE_BREAKPOINT) return;

        const disk = store.get();
        const shouldFetch = forceFetch || (Date.now() - disk.lastFetch > CONFIG.CACHE_TTL);

        const process = (data) => {
            const filtered = data.filter(i => i.active && !disk.dismissed[(i.id = getHash(i.msg))]);
            if (JSON.stringify(filtered) !== JSON.stringify(state.alerts)) {
                state.alerts = filtered;
                state.index = 0;
                if (state.alerts.length && !document.getElementById('status-bar')) {
                    injectStyles();
                    document.body.insertAdjacentHTML('afterbegin', 
                        '<div id="status-bar"><a id="status-link" target="_blank" rel="noopener"><div id="status-content"></div></a></div>'
                    );
                }
                updateUI();
            }
        };

        process(disk.cache);

        if (shouldFetch) {
            try {
                const r = await fetch(`${JSON_URL}?t=${Date.now()}`);
                if (r.ok) {
                    const fresh = await r.json();
                    disk.cache = fresh;
                    disk.lastFetch = Date.now();
                    store.save(disk);
                    process(fresh);
                }
            } catch (e) { console.error("Banner sync failed", e); }
        }
    }

    const start = () => {
        sync();
        setInterval(() => sync(true), CONFIG.POLLING_INTERVAL);
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
})();