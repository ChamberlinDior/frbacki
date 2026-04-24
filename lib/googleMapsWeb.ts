declare global {
  interface Window {
    google?: any;
  }
}

let googleMapsPromise: Promise<any> | null = null;

export function hasGoogleMapsKey() {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
}

export function loadGoogleMapsWeb() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      reject(new Error('MISSING_API_KEY'));
      return;
    }

    const existing = document.querySelector('script[data-google-maps="true"]') as
      | HTMLScriptElement
      | null;

    if (existing) {
      existing.addEventListener('load', () => resolve(window.google?.maps ?? null), {
        once: true,
      });
      existing.addEventListener('error', () => reject(new Error('GOOGLE_MAPS_LOAD_FAILED')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = 'true';
    script.onload = () => resolve(window.google?.maps ?? null);
    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('GOOGLE_MAPS_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
