
// LEIA A CHAVE DE UMA VARIÁVEL DE AMBIENTE SEGURA
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

declare var google: any;

let isScriptLoaded = false;
let isMapsBroken = false;
let mapsLoadPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    console.error("Google Maps API Authentication Failed. Verifique sua chave e as permissões no Console do Google Cloud.");
    isMapsBroken = true;
  };
  (window as any).initGoogleMapsCallback = () => {
      isScriptLoaded = true;
  };
}

export const loadGoogleMaps = (): Promise<void> => {
  // Se já estiver carregando, retorna o mesmo promise
  if (mapsLoadPromise) {
    return mapsLoadPromise;
  }

  return mapsLoadPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
        const errorMessage = "Chave da API do Google Maps não foi encontrada. Crie um arquivo .env.local e adicione VITE_GOOGLE_MAPS_API_KEY.";
        console.error(errorMessage);
        isMapsBroken = true;
        mapsLoadPromise = null;
        reject(errorMessage);
        return;
    }

    if (isMapsBroken) {
        mapsLoadPromise = null;
        reject("Maps API previously failed authentication");
        return;
    }

    if (isScriptLoaded && typeof google !== 'undefined' && google.maps) {
      resolve();
      return;
    }

    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        let checkInterval = setInterval(() => {
            if (typeof google !== 'undefined' && google.maps) {
                clearInterval(checkInterval);
                isScriptLoaded = true;
                mapsLoadPromise = null;
                resolve();
            }
        }, 100);
        return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places&callback=initGoogleMapsCallback&loading=async`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // O callback initGoogleMapsCallback vai definir isScriptLoaded
    };
    script.onerror = (err) => {
        console.error("Erro ao carregar Google Maps script:", err);
        isMapsBroken = true;
        mapsLoadPromise = null;
        reject(err);
    };
    document.head.appendChild(script);
  });
};

export interface DistanceResult {
    distanceText: string;
    distanceValue: number;
    durationText: string;
    isFallback: boolean;
}

export interface GeocodedAddress {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    fullAddress: string;
}

export function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

export const reverseGeocodeDetails = async (lat: number, lng: number): Promise<GeocodedAddress> => {
    try {
        await loadGoogleMaps();
        if (typeof google === 'undefined' || !google.maps || !google.maps.Geocoder) {
            throw new Error("Geocoder API not loaded");
        }

        const geocoder = new google.maps.Geocoder();
        return new Promise((resolve, reject) => {
            geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
                if (status === 'OK' && results[0]) {
                    const components = results[0].address_components;
                    const getComponent = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || '';
                    let street = getComponent('route') || getComponent('intersection');
                    if (!street && results[0].formatted_address) {
                        street = results[0].formatted_address.split(',')[0];
                    }

                    resolve({
                        street: street || '',
                        number: getComponent('street_number'),
                        neighborhood: getComponent('sublocality') || getComponent('sublocality_level_1') || getComponent('neighborhood'),
                        city: getComponent('administrative_area_level_2') || getComponent('locality'),
                        state: getComponent('administrative_area_level_1'),
                        zipCode: getComponent('postal_code'),
                        fullAddress: results[0].formatted_address
                    });
                } else {
                    reject(status);
                }
            });
        });
    } catch (e) {
        console.error("Reverse geocode failed", e)
        return {
            street: '', number: '', neighborhood: '', city: 'Apiacás', state: 'MT', zipCode: '',
            fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        };
    }
};

export const getRealDistances = async (
  originAddress: string,
  destinations: { id: string; lat: number; lng: number }[],
  originCoords?: { lat: number; lng: number }
): Promise<Record<string, DistanceResult>> => {
  const generateFallback = () => {
      const fallbackResults: Record<string, DistanceResult> = {};
      destinations.forEach(dest => {
          if (originCoords) {
              const distKm = calculateHaversine(originCoords.lat, originCoords.lng, dest.lat, dest.lng);
              const durationMins = Math.ceil(distKm * 2 + 10); 
              fallbackResults[dest.id] = { distanceText: `${distKm.toFixed(1)} km`, distanceValue: Math.round(distKm * 1000), durationText: `${durationMins} min`, isFallback: true };
          } else {
              fallbackResults[dest.id] = { distanceText: '5.0 km', distanceValue: 5000, durationText: '30 min', isFallback: true };
          }
      });
      return fallbackResults;
  };

  try {
      await loadGoogleMaps();
      if (typeof google === 'undefined' || !google.maps || !google.maps.DistanceMatrixService) {
          return generateFallback();
      }
      const service = new google.maps.DistanceMatrixService();
      const origin = originCoords ? { lat: originCoords.lat, lng: originCoords.lng } : originAddress;
      const destCoords = destinations.map(d => ({ lat: d.lat, lng: d.lng }));
      return new Promise((resolve) => {
        service.getDistanceMatrix({ origins: [origin], destinations: destCoords, travelMode: google.maps.TravelMode.DRIVING, unitSystem: google.maps.UnitSystem.METRIC },
          (response: any, status: any) => {
            const results: Record<string, DistanceResult> = {};
            if (status === 'OK' && response) {
              const rows = response.rows[0];
              if (rows) {
                 rows.elements.forEach((element: any, index: number) => {
                     const storeId = destinations[index].id;
                     if (element.status === 'OK') {
                         results[storeId] = { distanceText: element.distance.text, distanceValue: element.distance.value, durationText: element.duration.text, isFallback: false };
                     } else if (originCoords) {
                         const distKm = calculateHaversine(originCoords.lat, originCoords.lng, destinations[index].lat, destinations[index].lng);
                         results[storeId] = { distanceText: `${distKm.toFixed(1)} km`, distanceValue: Math.round(distKm * 1000), durationText: `${Math.ceil(distKm * 2 + 10)} min`, isFallback: true };
                     }
                 });
              }
              resolve(results);
            } else {
                resolve(generateFallback());
            }
          }
        );
      });
  } catch (error) {
      return generateFallback();
  }
};
