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

// ── Reverse Geocoding: coordenadas → endereço (Nominatim + ViaCEP fallback) ──
export const reverseGeocodeDetails = async (lat: number, lng: number): Promise<GeocodedAddress> => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
      { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'DeliveryCity/1.0' } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const addr = data?.address || {};

    const city  = addr.city || addr.town || addr.village || addr.municipality || '';
    const state = addr.state || '';
    let zipCode = addr.postcode || '';

    // ViaCEP fallback: se Nominatim não retornou CEP mas temos cidade, busca o CEP da cidade
    if (!zipCode && city && state) {
      try {
        const stateMap: Record<string, string> = {
          'Mato Grosso': 'MT', 'São Paulo': 'SP', 'Rio de Janeiro': 'RJ',
          'Minas Gerais': 'MG', 'Bahia': 'BA', 'Paraná': 'PR',
          'Rio Grande do Sul': 'RS', 'Pernambuco': 'PE', 'Ceará': 'CE',
          'Goiás': 'GO', 'Pará': 'PA', 'Maranhão': 'MA', 'Amazonas': 'AM',
          'Espírito Santo': 'ES', 'Mato Grosso do Sul': 'MS', 'Tocantins': 'TO',
          'Rondônia': 'RO', 'Acre': 'AC', 'Amapá': 'AP', 'Roraima': 'RR',
          'Piauí': 'PI', 'Paraíba': 'PB', 'Alagoas': 'AL', 'Sergipe': 'SE',
          'Rio Grande do Norte': 'RN', 'Distrito Federal': 'DF', 'Santa Catarina': 'SC',
        };
        const uf = stateMap[state] || state.slice(0, 2).toUpperCase();
        const cityEncoded = encodeURIComponent(city);
        const viacepRes = await fetch(
          `https://viacep.com.br/ws/${uf}/${cityEncoded}/x/json/`,
        );
        if (viacepRes.ok) {
          const entries = await viacepRes.json();
          if (Array.isArray(entries) && entries.length > 0 && !entries[0].erro) {
            zipCode = entries[0].cep || '';
          }
        }
      } catch { /* fallback silencioso */ }
    }

    return {
      street:       addr.road || addr.pedestrian || addr.footway || '',
      number:       addr.house_number || '',
      neighborhood: addr.suburb || addr.neighbourhood || addr.quarter || '',
      city,
      state,
      zipCode,
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
      // Fator 1.4 para aproximar distância real de rua vs linha reta (cidades de interior)
      const roadDistKm = distKm * 1.4;
      const durationMins = Math.ceil(roadDistKm * 2.4 + 3); // ~25km/h em zona urbana + 3 min margem
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

// ── ViaCEP: CEP → endereço completo (gratuito, sem API key) ───────
export const lookupCEP = async (cep: string): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
} | null> => {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      street:       data.logradouro || '',
      neighborhood: data.bairro     || '',
      city:         data.localidade || '',
      state:        data.uf         || '',
      zipCode:      `${digits.slice(0, 5)}-${digits.slice(5)}`,
    };
  } catch {
    return null;
  }
};

// ── Compatibilidade: stub vazio para loadGoogleMaps ────────────────
// Mantido para não quebrar imports existentes
export const loadGoogleMaps = async (): Promise<void> => { /* não mais necessário */ };
export const GOOGLE_MAPS_API_KEY = '';
