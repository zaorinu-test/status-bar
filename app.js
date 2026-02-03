/**
 * Dynamic Status Banner System - Compact Unified Edition
 */

const CONFIG = {
    URL: 'data.json',
    CACHE_DURATION: 10 * 60 * 1000, // 10 minutes
    ROTATION_SPEED: 5000, 
    STORAGE_KEY: 'app_banner_system' // Unified JSON Storage
};

const COLORS = {
    danger: '#d32f2f',
    warning: '#fbc02d',
    info: '#0033cc',
    default: '#333333'
};

let activeAlerts = [];
let currentIndex = 0;
let rotationInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchStatus();
    setInterval(fetchStatus, 60000); 
});

/**
 * Unified Storage Management
 * Structure: { lastFetch: 0, cache: [], dismissed: [] }
 */
function getStorage() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    return raw ? JSON.parse(raw) : { lastFetch: 0, cache: [], dismissed: [] };
}

function updateStorage(newData) {
    const current = getStorage();
    const updated = { ...current, ...newData };
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(updated));
}

async function fetchStatus() {
    const now = Date.now();
    const state = getStorage();
    let data = [];

    // Cache logic: Check if 10 mins passed
    if (state.cache.length > 0 && (now - state.lastFetch < CONFIG.CACHE_DURATION)) {
        data = state.cache;
    } else {
        try {
            const response = await fetch(`${CONFIG.URL}?t=${now}`);
            if (!response.ok) throw new Error();
            data = await response.json();
            
            // Update unified storage with new cache and time
            updateStorage({ cache: data, lastFetch: now });
        } catch (e) {
            data = state.cache || [];
        }
    }

    // Filter active and not dismissed
    activeAlerts = data
        .filter(item => item.active && !state.dismissed.includes(item.id))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    handleBanner();
}

function handleBanner() {
    let banner = document.getElementById('status-bar');

    if (activeAlerts.length === 0) {
        if (banner) banner.remove();
        return;
    }

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'status-bar';
        // Thinner bar (32px)
        banner.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 32px;
            z-index: 10000; display: flex; align-items: center; justify-content: center;
            color: #ffffff; font-family: 'Inter', system-ui, sans-serif;
            font-size: 13px; font-weight: 500; cursor: pointer;
            transition: background-color 0.5s ease;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        `;

        const content = document.createElement('div');
        content.id = 'status-content';
        content.style.transition = 'opacity 0.4s ease';
        
        banner.appendChild(content);
        document.body.prepend(banner);
        
        startRotation();
    }

    updateUI();
}

function updateUI() {
    const banner = document.getElementById('status-bar');
    const content = document.getElementById('status-content');
    if (!banner || !content || activeAlerts.length === 0) return;

    const current = activeAlerts[currentIndex];

    const render = () => {
        banner.style.backgroundColor = COLORS[current.level] || COLORS.default;
        content.innerHTML = `${current.msg} <span style="margin-left:5px; opacity:0.7">→</span>`;
        
        banner.onclick = (e) => {
            // If user clicks the bar, open link if exists
            if (current.link) window.open(current.link, '_blank');
        };
    };

    if (activeAlerts.length === 1) {
        render();
        content.style.opacity = '1';
    } else {
        content.style.opacity = '0';
        setTimeout(() => {
            render();
            content.style.opacity = '1';
        }, 400);
    }
}

function startRotation() {
    if (rotationInterval) clearInterval(rotationInterval);
    rotationInterval = setInterval(() => {
        if (activeAlerts.length > 1) {
            currentIndex = (currentIndex + 1) % activeAlerts.length;
            updateUI();
        }
    }, CONFIG.ROTATION_SPEED);
}