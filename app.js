/**
 * Dynamic Status Banner System - Left-Aligned & Animated
 */

const CONFIG = {
    URL: 'data.json',
    CACHE_DURATION: 10 * 60 * 1000, 
    CLEANUP_THRESHOLD: 7 * 24 * 60 * 60 * 1000, 
    ROTATION_SPEED: 10000, 
    STORAGE_KEY: 'app_banner_system'
};

const COLORS = {
    danger: '#d32f2f',
    warning: '#fbc02d',
    info: '#0033cc',
    default: '#333333'
};

let state = { activeAlerts: [], currentIndex: 0, rotationInterval: null };

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();

async function init() {
    await fetchStatus();
    startRotation();
    setInterval(fetchStatus, 60000); 
}

const store = {
    get: () => JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || { lastFetch: 0, cache: [], dismissed: {} },
    save: (data) => localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ ...store.get(), ...data }))
};

function cleanDismissedCache(dismissedMap) {
    const now = Date.now();
    const cleaned = {};
    let changed = false;
    for (const [id, timestamp] of Object.entries(dismissedMap)) {
        if (now - timestamp < CONFIG.CLEANUP_THRESHOLD) cleaned[id] = timestamp;
        else changed = true;
    }
    return { cleaned, changed };
}

async function fetchStatus() {
    const now = Date.now();
    const disk = store.get();
    let data = [];

    const { cleaned, changed } = cleanDismissedCache(disk.dismissed);
    if (changed) store.save({ dismissed: cleaned });

    if (disk.cache.length > 0 && (now - disk.lastFetch < CONFIG.CACHE_DURATION)) {
        data = disk.cache;
    } else {
        try {
            const response = await fetch(`${CONFIG.URL}?t=${now}`);
            if (!response.ok) throw new Error();
            data = await response.json();
            store.save({ cache: data, lastFetch: now });
        } catch (e) {
            data = disk.cache || [];
        }
    }

    state.activeAlerts = data
        .filter(item => item.active && !cleaned[item.id.toString()])
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    renderManager();
}

function renderManager() {
    let banner = document.getElementById('status-bar');
    if (state.activeAlerts.length === 0) {
        if (banner) banner.remove();
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'status-bar';
        // Changed to flex-start and added padding-left for the "gap"
        banner.style.cssText = `
            position: fixed; top: -40px; left: 0; width: 100%; height: 32px;
            z-index: 10000; display: flex; align-items: center; justify-content: flex-start;
            padding: 0 20px; box-sizing: border-box;
            color: #ffffff; font-family: 'Inter', system-ui, sans-serif;
            font-size: 13px; font-weight: 500; cursor: pointer;
            transition: background-color 0.5s ease, top 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            text-decoration: none;
        `;

        banner.onmouseenter = () => banner.style.textDecoration = 'underline';
        banner.onmouseleave = () => banner.style.textDecoration = 'none';

        const content = document.createElement('div');
        content.id = 'status-content';
        content.style.transition = 'opacity 0.4s ease';
        
        banner.appendChild(content);
        document.body.prepend(banner);

        // Slide Down Trigger
        setTimeout(() => banner.style.top = '0', 100);
    }
    updateContent();
}

function updateContent() {
    const banner = document.getElementById('status-bar');
    const content = document.getElementById('status-content');
    if (!banner || !content || state.activeAlerts.length === 0) return;

    const current = state.activeAlerts[state.currentIndex];

    const apply = () => {
        banner.style.backgroundColor = COLORS[current.level] || COLORS.default;
        content.innerHTML = `${current.msg} <span style="margin-left:5px; opacity:0.7">→</span>`;
        banner.onclick = () => {
            if (current.link) {
                window.open(current.link, '_blank');
                if (current.dismissable) dismiss(current.id);
            }
        };
    };

    if (state.activeAlerts.length === 1) {
        apply();
        content.style.opacity = '1';
    } else {
        content.style.opacity = '0';
        setTimeout(() => {
            apply();
            content.style.opacity = '1';
        }, 400);
    }
}

function dismiss(id) {
    const disk = store.get();
    disk.dismissed[id.toString()] = Date.now();
    store.save({ dismissed: disk.dismissed });
    fetchStatus(); 
}

function startRotation() {
    if (state.rotationInterval) clearInterval(state.rotationInterval);
    state.rotationInterval = setInterval(() => {
        if (state.activeAlerts.length > 1) {
            state.currentIndex = (state.currentIndex + 1) % state.activeAlerts.length;
            updateContent();
        }
    }, CONFIG.ROTATION_SPEED);
}