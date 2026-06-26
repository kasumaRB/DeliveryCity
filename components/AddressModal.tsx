import React, { useState, useEffect, useRef } from 'react';
import { UserAddress } from '../types';
import { MapPin, AlertCircle, Crosshair, Loader, X } from 'lucide-react';
import { reverseGeocodeDetails, lookupCEP } from '../services/mapsService';
import { supabase } from '../lib/supabase';

interface AddressModalProps {
  onClose: () => void;
  onSave: (address: Omit<UserAddress, 'id'>) => void;
  initialAddress?: UserAddress | null;
  title?: string;
  saveButtonLabel?: string;
}

const APIACAS_CENTER = { lat: -9.5422, lng: -57.4486 };

export const AddressModal: React.FC<AddressModalProps> = ({
  onClose,
  onSave,
  initialAddress,
  title = 'Selecionar Endereço',
  saveButtonLabel = 'Salvar Endereço',
}) => {
  const mapRef        = useRef<HTMLDivElement>(null);
  const leafletMap    = useRef<any>(null);
  const leafletLib    = useRef<any>(null);
  const gpsMarker     = useRef<any>(null);
  const watchId       = useRef<number | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted     = useRef(false);
  const cityCepRef    = useRef<string>('');

  const [addrLabel]                             = useState(initialAddress?.label || 'Casa');
  const [addrZip,          setAddrZip]          = useState(initialAddress?.zipCode || '');
  const [addrStreet,       setAddrStreet]       = useState(initialAddress?.street || '');
  const [addrNumber,       setAddrNumber]       = useState(initialAddress?.number || '');
  const [addrNeighborhood, setAddrNeighborhood] = useState(initialAddress?.neighborhood || '');
  const [addrCity,         setAddrCity]         = useState(initialAddress?.city || 'Apiacás');
  const [addrState,        setAddrState]        = useState(initialAddress?.state || 'MT');
  const [addrComplement]                        = useState(initialAddress?.complement || '');
  const [addrReference,    setAddrReference]    = useState(initialAddress?.reference || '');
  const [addrCoords, setAddrCoords]             = useState<{ lat: number; lng: number } | undefined>(
    initialAddress?.coords
  );
  const [isLoadingInitial,   setIsLoadingInitial]   = useState(!initialAddress);
  const [isLoadingLocation,  setIsLoadingLocation]  = useState(false);
  const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
  const [isMapDragging,      setIsMapDragging]      = useState(false);
  const [mapError,           setMapError]           = useState<string | null>(null);
  const [isCepLoading,       setIsCepLoading]       = useState(false);
  const [zipIsFallback,      setZipIsFallback]      = useState(false);

  // Busca o CEP único da cidade (config do admin) para usar como padrão/fallback
  useEffect(() => {
    supabase.from('platform_settings').select('city_cep').maybeSingle()
      .then(({ data }) => {
        if (data?.city_cep) {
          cityCepRef.current = data.city_cep;
          // Preenche o CEP se ainda estiver vazio (endereço novo), marcando como fallback
          setAddrZip(prev => {
            if (!prev) { setZipIsFallback(true); return data.city_cep; }
            return prev;
          });
        }
      });
  }, []);

  const handleCepChange = async (raw: string) => {
    const digits    = raw.replace(/\D/g, '').slice(0, 8);
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setZipIsFallback(false);
    setAddrZip(formatted);
    if (digits.length === 8) {
      setIsCepLoading(true);
      try {
        const data = await lookupCEP(digits);
        if (data) {
          if (data.street)       setAddrStreet(data.street);
          if (data.neighborhood) setAddrNeighborhood(data.neighborhood);
          if (data.city)         setAddrCity(data.city);
          if (data.state)        setAddrState(data.state);
        }
      } finally {
        setIsCepLoading(false);
      }
    }
  };

  const getCurrentPosition = (): Promise<{ lat: number; lng: number }> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject('Geolocation not supported'); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });

  const updateGpsDot = (lat: number, lng: number) => {
    const L   = leafletLib.current;
    const map = leafletMap.current;
    if (!L || !map) return;
    if (!gpsMarker.current) {
      const icon = L.divIcon({
        html: '<div class="dc-gps-dot"></div>',
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      gpsMarker.current = L.marker([lat, lng], { icon, zIndexOffset: -100 })
        .addTo(map)
        .bindPopup('<b>Você está aqui</b>', { offset: [0, -10] });
    } else {
      gpsMarker.current.setLatLng([lat, lng]);
    }
  };

  // Injeta CSS da bolinha azul
  useEffect(() => {
    const ID = 'dc-address-modal-styles';
    if (!document.getElementById(ID)) {
      const el = document.createElement('style');
      el.id = ID;
      el.textContent =
        '.dc-gps-dot{width:18px;height:18px;background:#2563eb;border:3px solid #fff;' +
        'border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);' +
        'animation:dc-gps-pulse 2s ease-out infinite}' +
        '@keyframes dc-gps-pulse{' +
        '0%{box-shadow:0 2px 6px rgba(0,0,0,.4),0 0 0 0 rgba(37,99,235,.6)}' +
        '70%{box-shadow:0 2px 6px rgba(0,0,0,.4),0 0 0 14px rgba(37,99,235,0)}' +
        '100%{box-shadow:0 2px 6px rgba(0,0,0,.4),0 0 0 0 rgba(37,99,235,0)}}';
      document.head.appendChild(el);
    }
    return () => { document.getElementById(ID)?.remove(); };
  }, []);

  // Inicialização do mapa
  useEffect(() => {
    if (isMounted.current) return;
    isMounted.current = true;

    const initMap = async () => {
      if (!mapRef.current || (mapRef.current as any)._leaflet_id) return;
      try {
        const L = (await import('leaflet')).default;
        leafletLib.current = L;

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        let startLocation = addrCoords || APIACAS_CENTER;
        let initialZoom   = addrCoords ? 17 : 14;

        if (!initialAddress && !addrCoords) {
          try {
            startLocation = await getCurrentPosition();
            initialZoom   = 17;
          } catch {
            startLocation = APIACAS_CENTER;
            initialZoom   = 14;
          }
        }

        if (!mapRef.current || (mapRef.current as any)._leaflet_id) return;

        const map = L.map(mapRef.current, {
          center: [startLocation.lat, startLocation.lng],
          zoom: initialZoom,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: '' }).addTo(map);
        L.control.zoom({ position: 'topleft' }).addTo(map);

        leafletMap.current = map;
        setTimeout(() => { try { map.invalidateSize(); } catch { /* silencioso */ } }, 150);
        setAddrCoords({ lat: startLocation.lat, lng: startLocation.lng });
        setIsLoadingInitial(false);

        map.on('dragstart', () => {
          setIsMapDragging(true);
          setAddrStreet('');
          setAddrNeighborhood('');
          setAddrZip('');
          setAddrNumber('');
          setIsGeocodingLoading(true);
        });

        map.on('moveend', () => {
          setIsMapDragging(false);
          const center = map.getCenter();
          const lat = center.lat;
          const lng = center.lng;
          setAddrCoords({ lat, lng });

          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          debounceTimer.current = setTimeout(async () => {
            try {
              const details = await reverseGeocodeDetails(lat, lng);
              setAddrStreet(details.street || '');
              setAddrNeighborhood(details.neighborhood || '');
              if (details.city)  setAddrCity(details.city);
              if (details.state) setAddrState(details.state);
              // Usa o CEP do mapa; se não houver, cai no CEP único da cidade (config admin)
              if (details.zipCode) {
                setZipIsFallback(false);
                setAddrZip(details.zipCode);
              } else {
                setZipIsFallback(true);
                setAddrZip(cityCepRef.current || '');
              }
              if (details.number && !details.number.includes('-')) setAddrNumber(details.number);
            } catch { /* silencioso */ }
            finally { setIsGeocodingLoading(false); }
          }, 700);
        });

        // Bolinha azul GPS em tempo real
        if (navigator.geolocation) {
          updateGpsDot(startLocation.lat, startLocation.lng);
          watchId.current = navigator.geolocation.watchPosition(
            pos => updateGpsDot(pos.coords.latitude, pos.coords.longitude),
            () => { /* sem GPS — silencioso */ },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
          );
        }
      } catch (err) {
        console.error('Erro ao inicializar mapa:', err);
        setMapError('Não foi possível carregar o mapa.');
        setIsLoadingInitial(false);
      }
    };

    initMap();

    return () => {
      isMounted.current = false; // ← CRÍTICO: permite reinicializar ao reabrir o modal
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUseCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const pos = await getCurrentPosition();
      if (leafletMap.current) leafletMap.current.setView([pos.lat, pos.lng], 18);
    } catch {
      alert('Não conseguimos obter sua localização exata.');
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleConfirm = () => {
    const finalCoords = addrCoords || APIACAS_CENTER;
    const finalStreet =
      addrStreet.trim()       ||
      addrReference.trim()    ||
      addrNeighborhood.trim() ||
      `${finalCoords.lat.toFixed(5)}, ${finalCoords.lng.toFixed(5)}`;

    onSave({
      label:        addrLabel,
      street:       finalStreet,
      number:       addrNumber.trim()       || '',
      neighborhood: addrNeighborhood.trim() || '',
      city:         addrCity                || 'Apiacás',
      state:        addrState               || 'MT',
      zipCode:      addrZip,
      complement:   addrComplement,
      reference:    addrReference,
      coords:       finalCoords,
    });
  };

  const draggingCls = isMapDragging ? 'opacity-0 -translate-y-1' : 'opacity-100';
  const pinCls      = isMapDragging ? 'text-orange-400 -translate-y-4 scale-110' : 'text-orange-600';
  const shadowCls   = isMapDragging ? 'scale-50 opacity-20' : 'scale-100 opacity-80';
  const formCls     = isGeocodingLoading ? 'opacity-50 pointer-events-none' : 'opacity-100';

  // Hints de campo: visíveis apenas depois que o geocoding terminou e algum campo ficou vazio
  const showHints          = !isGeocodingLoading && !!addrCoords && !isLoadingInitial;
  const missingStreet       = showHints && !addrStreet;
  const missingNumber       = showHints && !addrNumber;
  const missingNeighborhood = showHints && !addrNeighborhood;
  const missingZip          = showHints && (!addrZip || zipIsFallback);

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white text-gray-900 w-full md:max-w-xl md:rounded-[2.5rem] rounded-t-[3rem] p-6 h-[92vh] md:h-auto overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300 relative shadow-2xl">

        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="font-black text-xl text-gray-900 tracking-tight">{title}</h2>
            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">
              {addrCity}, {addrState}
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 pb-6">

          {/* MAPA */}
          <div className="relative w-full h-64 bg-gray-100 rounded-3xl overflow-hidden shadow-inner border border-gray-100">

            {isLoadingInitial && (
              <div className="absolute inset-0 z-30 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <Loader className="animate-spin text-orange-600" size={32} />
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Localizando você...
                </p>
              </div>
            )}

            {mapError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50">
                <AlertCircle className="text-gray-300 mb-2" size={40} />
                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">{mapError}</p>
              </div>
            ) : (
              <div ref={mapRef} className="w-full h-full" />
            )}

            {/* Instrução: arraste o mapa */}
            {!mapError && !isLoadingInitial && (
              <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-[400] pointer-events-none transition-all duration-300 ${draggingCls}`}>
                <div className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap">
                  Arraste o mapa para posicionar o pino
                </div>
              </div>
            )}

            {/* Pino laranja central */}
            {!mapError && !isLoadingInitial && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none pb-[34px]">
                {!isMapDragging && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+17px)] w-10 h-10 rounded-full border-2 border-orange-400 opacity-50 animate-ping" />
                )}
                <MapPin size={44} className={`drop-shadow-xl transition-all duration-200 ${pinCls}`} />
                <div className={`w-4 h-2 bg-black/30 rounded-full mx-auto mt-[-6px] blur-[2px] transition-all duration-200 ${shadowCls}`} />
              </div>
            )}

            {/* Banner "Solte para definir" */}
            {!mapError && !isLoadingInitial && isMapDragging && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] pointer-events-none">
                <div className="bg-orange-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap shadow-lg">
                  Solte para definir o ponto
                </div>
              </div>
            )}

            {/* Legenda */}
            {!mapError && !isLoadingInitial && (
              <div className="absolute bottom-12 left-3 z-[400] pointer-events-none flex flex-col gap-1">
                <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm">
                  <div className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
                  <span className="text-[8px] font-black text-gray-600 uppercase tracking-wider">Você</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm">
                  <MapPin size={12} className="text-orange-600" />
                  <span className="text-[8px] font-black text-gray-600 uppercase tracking-wider">Entrega</span>
                </div>
              </div>
            )}

            {/* Botão GPS */}
            <button
              onClick={handleUseCurrentLocation}
              className="absolute bottom-4 right-3 bg-white p-3 rounded-2xl shadow-xl text-orange-600 hover:bg-orange-50 transition z-[400] border border-gray-100"
              title="Ir para minha localização"
            >
              {isLoadingLocation ? <Loader className="animate-spin" size={20} /> : <Crosshair size={20} />}
            </button>
          </div>

          {/* Coordenadas / status geocoding */}
          <div className="flex items-center justify-center gap-2 min-h-[18px]">
            {isGeocodingLoading ? (
              <div className="flex items-center gap-2 text-[9px] font-black text-orange-500 uppercase tracking-widest">
                <Loader size={10} className="animate-spin" />
                Buscando endereço...
              </div>
            ) : (
              <p className="text-center text-[9px] text-gray-400 font-black uppercase tracking-widest">
                {addrCoords
                  ? `Coords: ${addrCoords.lat.toFixed(5)}, ${addrCoords.lng.toFixed(5)}`
                  : 'Aguardando localização...'}
              </p>
            )}
          </div>

          {/* FORMULÁRIO */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-300 ${formCls}`}>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rua / Avenida</label>
              <input value={addrStreet} onChange={e => setAddrStreet(e.target.value)}
                className={`w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm text-gray-900 outline-none focus:bg-white transition ${missingStreet ? 'border-orange-200 focus:border-orange-400' : 'border-gray-100 focus:border-orange-200'}`}
                placeholder={isGeocodingLoading ? 'Buscando...' : 'Nome da rua'} />
              {missingStreet && (
                <p className="text-[9px] text-orange-500 font-bold ml-1">Não encontrado — preencha manualmente</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Número</label>
                <input value={addrNumber} onChange={e => setAddrNumber(e.target.value)}
                  className={`w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm text-gray-900 outline-none focus:bg-white transition ${missingNumber ? 'border-orange-200 focus:border-orange-400' : 'border-gray-100 focus:border-orange-200'}`}
                  placeholder="S/N" />
                {missingNumber && (
                  <p className="text-[9px] text-orange-500 font-bold ml-1">Digite ou "S/N"</p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  CEP {isCepLoading && <span className="text-orange-400">· buscando...</span>}
                </label>
                <input
                  value={addrZip}
                  onChange={e => handleCepChange(e.target.value)}
                  inputMode="numeric"
                  maxLength={9}
                  className={`w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm text-gray-900 outline-none focus:bg-white transition ${missingZip ? 'border-orange-200 focus:border-orange-400' : 'border-gray-100 focus:border-orange-200'}`}
                  placeholder="00000-000"
                />
                {missingZip && !isCepLoading && (
                  <p className="text-[9px] text-orange-500 font-bold ml-1">
                    {zipIsFallback
                      ? 'CEP padrão da cidade — confirme ou corrija se souber o CEP específico'
                      : 'Digite o CEP para preencher o endereço automaticamente'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-300 ${formCls}`}>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Bairro</label>
              <input value={addrNeighborhood} onChange={e => setAddrNeighborhood(e.target.value)}
                className={`w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm text-gray-900 outline-none focus:bg-white transition ${missingNeighborhood ? 'border-orange-200 focus:border-orange-400' : 'border-gray-100 focus:border-orange-200'}`}
                placeholder={isGeocodingLoading ? 'Buscando...' : 'Ex: Centro'} />
              {missingNeighborhood && (
                <p className="text-[9px] text-orange-500 font-bold ml-1">Não encontrado — preencha manualmente</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Referência</label>
              <input value={addrReference} onChange={e => setAddrReference(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm text-gray-900 outline-none focus:bg-white focus:border-orange-200 transition"
                placeholder="Ex: Próximo à praça" />
            </div>
          </div>

          {/* Aviso: área sem mapeamento algum */}
          {showHints && !addrStreet && !addrNeighborhood && (
            <p className="text-[9px] text-gray-400 font-bold text-center bg-gray-50 rounded-2xl px-4 py-3 border border-dashed border-gray-200">
              Área sem mapeamento — o ponto será salvo pelas coordenadas GPS. Preencha uma referência para o entregador.
            </p>
          )}

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition">
              Cancelar
            </button>
            <button onClick={handleConfirm}
              className="flex-1 bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition shadow-xl shadow-orange-100 active:scale-95">
              {isGeocodingLoading ? `${saveButtonLabel} ✓` : saveButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
