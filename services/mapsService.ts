// =====================================================================
// mapsService.ts — OpenStreetMap + Nominatim (GRATUITO, sem API key)
// Substitui completamente o Google Maps sem custo algum
// =====================================================================

export interface DistanceResult {
  distanceText: string;
  distanceValue: number; // metros
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

// ── Haversine: distância em linha reta (em km) ─────────────────────
export function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Geocoding: endereço → coordenadas (Nominatim) ──────────────────
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=br`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'DeliveryCity/1.0' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    return null;
  } catch {
    return null;
  }
};

// ── Reverse Geocoding: coordenadas → endereço (Nominatim) ──────────
export const reverseGeocodeDetails = async (lat: number, lng: number): Promise<GeocodedAddress> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'DeliveryCity/1.0' } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const addr = data?.address || {};

    return {
      street:       addr.road || addr.pedestrian || addr.footway || '',
      number:       addr.house_number || '',
      neighborhood: addr.suburb || addr.neighbourhood || addr.quarter || '',
      city:         addr.city || addr.town || addr.village || addr.municipality || '',
      state:        addr.state || '',
      zipCode:      addr.postcode || '',
      fullAddress:  data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  } catch {
    return {
      street: '', number: '', neighborhood: '',
      city: '', state: '', zipCode: '',
      fullAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };
  }
};

// ── Distâncias: usa Haversine (sem API) + estimativa de tempo ──────
export const getRealDistances = async (
  _originAddress: string,
  destinations: { id: string; lat: number; lng: number }[],
  originCoords?: { lat: number; lng: number }
): Promise<Record<string, DistanceResult>> => {
  const results: Record<string, DistanceResult> = {};

  for (const dest of destinations) {
    if (originCoords) {
      const distKm = calculateHaversine(originCoords.lat, originCoords.lng, dest.lat, dest.lng);
      // Fator 1.35 para aproximar distância real de estrada vs linha reta
      const roadDistKm = distKm * 1.35;
      const durationMins = Math.ceil(roadDistKm * 3 + 5); // ~20km/h em zona urbana
      results[dest.id] = {
        distanceText: `${roadDistKm.toFixed(1)} km`,
        distanceValue: Math.round(roadDistKm * 1000),
        durationText: `${durationMins} min`,
        isFallback: false,
      };
    } else {
      results[dest.id] = {
        distanceText: '5.0 km',
        distanceValue: 5000,
        durationText: '25 min',
        isFallback: true,
      };
    }
  }

  return results;
};

// ── Autocomplete de endereços (Nominatim) ──────────────────────────
export const searchAddresses = async (query: string): Promise<Array<{
  label: string;
  lat: number;
  lng: number;
}>> => {
  if (!query || query.length < 4) return [];
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&countrycodes=br&addressdetails=1`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'DeliveryCity/1.0' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((item: any) => ({
      label: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch {
    return [];
  }
};

// ── Compatibilidade: stub vazio para loadGoogleMaps ────────────────
// Mantido para não quebrar imports existentes
export const loadGoogleMaps = async (): Promise<void> => { /* não mais necessário */ };
export const GOOGLE_MAPS_API_KEY = '';
