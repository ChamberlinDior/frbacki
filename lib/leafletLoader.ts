let leafletPromise: Promise<void> | null = null;

declare global {
  interface Window {
    L?: any;
  }
}

function ensureStylesheet(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-leaflet-css="true"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.dataset.leafletCss = 'true';
  document.head.appendChild(link);
}

function ensureCustomStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('style[data-tpe-map-styles="true"]')) return;

  const style = document.createElement('style');
  style.dataset.tpeMapStyles = 'true';
  style.textContent = `
    /* Popups premium */
    .leaflet-popup-content-wrapper {
      padding: 0 !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1) !important;
      border: 1px solid #D7E3F2 !important;
      overflow: hidden !important;
    }
    .leaflet-popup-content {
      margin: 0 !important;
      line-height: 1.5 !important;
    }
    .leaflet-popup-tip {
      background: #12324A !important;
    }
    .leaflet-popup-close-button {
      color: rgba(255,255,255,0.7) !important;
      font-size: 18px !important;
      top: 8px !important;
      right: 10px !important;
      z-index: 1 !important;
    }
    .leaflet-popup-close-button:hover {
      color: #ffffff !important;
    }

    /* Controles de zoom plus sobres */
    .leaflet-control-zoom {
      border: 1px solid #D7E3F2 !important;
      border-radius: 10px !important;
      overflow: hidden !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
    }
    .leaflet-control-zoom a {
      background: #ffffff !important;
      color: #12324A !important;
      font-size: 16px !important;
      line-height: 26px !important;
      width: 28px !important;
      height: 28px !important;
      border-bottom: 1px solid #D7E3F2 !important;
    }
    .leaflet-control-zoom a:last-child {
      border-bottom: none !important;
    }
    .leaflet-control-zoom a:hover {
      background: #EEF5FF !important;
      color: #1F6FE5 !important;
    }

    /* Attribution plus discrete */
    .leaflet-control-attribution {
      font-size: 9px !important;
      background: rgba(255,255,255,0.75) !important;
      color: #9AB0C4 !important;
      border-radius: 4px 0 0 0 !important;
    }
    .leaflet-control-attribution a {
      color: #72879A !important;
    }

    /* Icones markers — pas de fond Leaflet par defaut */
    .leaflet-div-icon {
      background: transparent !important;
      border: none !important;
    }
  `;
  document.head.appendChild(style);
}

export function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  if (window.L) {
    ensureStylesheet();
    ensureCustomStyles();
    return Promise.resolve();
  }

  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<void>((resolve, reject) => {
    ensureStylesheet();

    const existing = document.querySelector('script[data-leaflet-js="true"]');
    if (existing) {
      const timer = window.setInterval(() => {
        if (window.L) {
          window.clearInterval(timer);
          ensureCustomStyles();
          resolve();
        }
      }, 25);
      window.setTimeout(() => {
        window.clearInterval(timer);
        if (!window.L) {
          reject(new Error('Leaflet n\'a pas pu être initialisé.'));
        }
      }, 5000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.defer = true;
    script.dataset.leafletJs = 'true';
    script.onload = () => {
      ensureCustomStyles();
      resolve();
    };
    script.onerror = () => reject(new Error('Leaflet n\'a pas pu être chargé.'));
    document.head.appendChild(script);
  });

  return leafletPromise;
}
