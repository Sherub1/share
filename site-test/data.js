if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.querySelector('.theme-toggle').textContent = '☀️';
} else {
    document.documentElement.setAttribute('data-theme', 'light');
    document.querySelector('.theme-toggle').textContent = '🌙';
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (e.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.querySelector('.theme-toggle').textContent = '☀️';
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        document.querySelector('.theme-toggle').textContent = '🌙';
    }
});

const menuToggle = document.querySelector('.menu-toggle');
const navMenu = document.querySelector('.nav-menu');

menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

const themeToggle = document.querySelector('.theme-toggle');
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeToggle.textContent = '🌙';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
    }
});

let map, userLngLat, accuracyCircle;
let ipData;

function getBrowser() {
    const userAgent = navigator.userAgent;
    if (/Chrome/.test(userAgent) && !/Edg/.test(userAgent)) return 'Chrome';
    if (/Firefox/.test(userAgent)) return 'Firefox';
    if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) return 'Safari';
    if (/Edg/.test(userAgent)) return 'Edge';
    if (/Trident/.test(userAgent) || /MSIE/.test(userAgent)) return 'Internet Explorer';
    return 'Inconnu';
}

function getOS() {
    const userAgent = navigator.userAgent;
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Mac OS/.test(userAgent)) return 'Mac OS';
    if (/Linux/.test(userAgent) && !/Android/.test(userAgent)) return 'Linux';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
    return 'Inconnu';
}

function getGPU() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'Non supporté';
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
        const fullRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        const match = fullRenderer.match(/ANGLE \([^,]+,\s*([^,]+),/);
        if (match) {
            return match[1].replace(/ Direct3D.*$/, '').trim();
        }
        return fullRenderer;
    }
    return 'Non disponible';
}

function loadConnectionInfo() {
    const deviceInfo = document.getElementById('deviceinfo');
    const ipInfo = document.getElementById('ipinfo');
    const vpnInfo = document.getElementById('vpninfo');
    const coords = document.getElementById('coords');
    const trackers = document.getElementById('trackers');
    const profil = document.getElementById('profil');

    deviceInfo.innerHTML = `Votre appareil est équipé d’un navigateur <strong>${getBrowser()}</strong> et fonctionne sous système <strong>${getOS()}</strong>. Votre écran a une résolution de <strong>${screen.width} x ${screen.height}</strong> pixels. Votre machine a une puissance de calcul de <strong>${navigator.hardwareConcurrency || 'un nombre inconnu de'} cœurs</strong>, plus une carte graphique <strong>${getGPU()}</strong>.`;
    deviceInfo.classList.remove('loading');

    fetch('https://ipapi.co/json/')
        .then((res) => res.json())
        .then((data) => {
            ipData = data;
            if (!data.error) {
                const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const ipTimezone = data.timezone || 'Non disponible';
                const vpnSuspect = (browserTimezone !== ipTimezone && ipTimezone !== 'Non disponible') ? 'Oui, avec une protection VPN' : 'Non, sans protection supplémentaire';
                ipInfo.innerHTML = `L'origine de votre connection est en <strong>${data.country_name}</strong>. Votre fournisseur d'accès internet est <strong>${data.org}</strong>.`;
                vpnInfo.innerHTML = `Utilisez vous une protection VPN ? <strong>${vpnSuspect}</strong>.`;
                requestGeolocationConsent();
            } else {
                ipInfo.innerHTML = 'Impossible de déterminer votre emplacement actuel.';
                vpnInfo.innerHTML = 'Impossible de vérifier une protection VPN.';
                coords.textContent = 'La position reste indéterminée.';
                document.getElementById('map').textContent = 'La carte n\'est pas disponible.';
            }
            ipInfo.classList.remove('loading');
            vpnInfo.classList.remove('loading');
        })
        .catch(() => {
            ipInfo.innerHTML = 'Impossible de déterminer votre emplacement actuel.';
            vpnInfo.innerHTML = 'Impossible de vérifier une protection VPN.';
            coords.textContent = 'La position reste indéterminée.';
            document.getElementById('map').textContent = 'La carte n\'est pas disponible.';
            ipInfo.classList.remove('loading');
            vpnInfo.classList.remove('loading');
        });

    const trackersList = [
        { name: 'Google Analytics', url: 'https://www.google-analytics.com/analytics.js', category: 'publicité' },
        { name: 'Facebook Pixel', url: 'https://connect.facebook.net/en_US/fbevents.js', category: 'réseaux sociaux' },
        { name: 'Hotjar', url: 'https://static.hotjar.com/c/hotjar-', category: 'comportemental' },
        { name: 'Matomo', url: 'https://cdn.matomo.cloud', category: 'analytique' },
    ];

    let detectedTrackers = [];
    trackersList.forEach((t) => {
        const script = document.createElement('script');
        script.src = t.url;
        script.onload = () => detectedTrackers.push({ name: t.name, category: t.category });
        script.onerror = () => { };
        document.body.appendChild(script);
    });

    setTimeout(() => {
        const trackersText = detectedTrackers.length > 0
            ? `Des outils comme <strong>${detectedTrackers.map(t => t.name).join(', ')}</strong> suivent votre activité.`
            : 'Aucun outil de suivi détecté, votre trace est discrète.';
        trackers.innerHTML = trackersText;
        trackers.classList.remove('loading');

        if (detectedTrackers.length === 0) {
            profil.innerHTML = 'Votre profil reste confidentiel grâce à une possible protection.';
        } else {
            const categories = [...new Set(detectedTrackers.map((t) => t.category))];
            let description = 'Ces outils ont établi un profil basé sur :<br>';
            if (categories.includes('publicité')) description += '- Vos préférences publicitaires.<br>';
            if (categories.includes('réseaux sociaux')) description += '- Votre activité sur les réseaux sociaux.<br>';
            if (categories.includes('comportemental')) description += '- Vos actions sur ce site.<br>';
            if (categories.includes('analytique')) description += '- Des statistiques de vos visites.<br>';
            profil.innerHTML = description.trim();
        }
        profil.classList.remove('loading');
    }, 2500);
}

function loadTurfAndInit(lng, lat, accuracy, isFallback = false) {
    const turfScript = document.createElement('script');
    turfScript.src = 'https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js';
    turfScript.onload = () => initMap(lng, lat, accuracy, isFallback);
    document.head.appendChild(turfScript);
}

function initMap(lng, lat, accuracy, isFallback) {
    userLngLat = [lng, lat];
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://tiles.basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: userLngLat,
        zoom: window.innerWidth <= 768 ? 10 : 13,
    });

    new maplibregl.Marker()
        .setLngLat(userLngLat)
        .setPopup(
            new maplibregl.Popup().setText(isFallback ? `Position approximative (± ${accuracy} m) basée sur votre IP` : `Votre position (± ${accuracy} m)`)
        )
        .addTo(map);

    map.on('load', () => {
        if (map.getSource('accuracyCircle')) {
            map.removeLayer('accuracyCircleFill');
            map.removeSource('accuracyCircle');
        }
        const options = { steps: 64, units: 'meters' };
        const circle = turf.circle(userLngLat, accuracy, options);
        map.addSource('accuracyCircle', {
            type: 'geojson',
            data: circle,
        });
        map.addLayer({
            id: 'accuracyCircleFill',
            type: 'fill',
            source: 'accuracyCircle',
            layout: {},
            paint: {
                'fill-color': '#007bff',
                'fill-opacity': 0.2,
            },
        });
    });

    document.getElementById('coords').textContent = `Vous êtes localisé à Longitude: ${lng.toFixed(6)}, Latitude: ${lat.toFixed(6)}${isFallback ? ' (estimation approximative basée sur votre IP)' : ''}.`;
}

function requestGeolocationConsent() {
    if (confirm('Nous souhaitons accéder à votre position pour personnaliser votre expérience. Souhaitez-vous autoriser la géolocalisation ?')) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const latitude = pos.coords.latitude;
                    const longitude = pos.coords.longitude;
                    const accuracy = pos.coords.accuracy;
                    loadTurfAndInit(longitude, latitude, accuracy, false);
                },
                (err) => {
                    if (ipData && ipData.latitude && ipData.longitude) {
                        const approxAccuracy = 10000;
                        loadTurfAndInit(ipData.longitude, ipData.latitude, approxAccuracy, true);
                    } else {
                        document.getElementById('coords').textContent = 'Impossible de déterminer votre position.';
                        document.getElementById('map').textContent = 'La carte n\'est pas disponible.';
                    }
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else {
            if (ipData && ipData.latitude && ipData.longitude) {
                const approxAccuracy = 10000;
                loadTurfAndInit(ipData.longitude, ipData.latitude, approxAccuracy, true);
            } else {
                document.getElementById('coords').textContent = 'Impossible de déterminer votre position.';
                document.getElementById('map').textContent = 'La carte n\'est pas disponible.';
            }
        }
    } else {
        // Utilisation du fallback avec données IP en cas de refus
        if (ipData && ipData.latitude && ipData.longitude) {
            const approxAccuracy = 10000;
            loadTurfAndInit(ipData.longitude, ipData.latitude, approxAccuracy, true);
        } else {
            document.getElementById('coords').textContent = 'Impossible de déterminer votre position.';
            document.getElementById('map').textContent = 'La carte n\'est pas disponible.';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadConnectionInfo();
});
