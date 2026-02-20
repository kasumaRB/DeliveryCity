
import React, { useState, useEffect, useRef } from 'react';
import { UserAddress } from '../types';
import { MapPin, AlertCircle, Crosshair, Loader, X, Hash } from 'lucide-react';
import { reverseGeocodeDetails, loadGoogleMaps } from '../services/mapsService';

declare var google: any;

interface AddressModalProps {
  onClose: () => void;
  onSave: (address: Omit<UserAddress, 'id'>) => void;
  initialAddress?: UserAddress | null;
  title?: string;
  saveButtonLabel?: string;
}

const APIACAS_CENTER = { lat: -9.5422, lng: -57.4486 };

export const AddressModal: React.FC<AddressModalProps> = ({ onClose, onSave, initialAddress, title = "Selecionar Endereço", saveButtonLabel = "Salvar Endereço" }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapInstance = useRef<any>(null);
  const isMapReady = useRef(false);

  // Estados dos campos de endereço
  const [addrLabel, setAddrLabel] = useState(initialAddress?.label || 'Casa'); 
  const [addrZip, setAddrZip] = useState(initialAddress?.zipCode || '');
  const [addrStreet, setAddrStreet] = useState(initialAddress?.street || '');
  const [addrNumber, setAddrNumber] = useState(initialAddress?.number || '');
  const [addrNeighborhood, setAddrNeighborhood] = useState(initialAddress?.neighborhood || '');
  const [addrCity, setAddrCity] = useState(initialAddress?.city || 'Apiacás'); 
  const [addrState, setAddrState] = useState(initialAddress?.state || 'MT');
  const [addrComplement, setAddrComplement] = useState(initialAddress?.complement || '');
  const [addrReference, setAddrReference] = useState(initialAddress?.reference || ''); 
  const [addrCoords, setAddrCoords] = useState<{lat: number, lng: number} | undefined>(initialAddress?.coords);
  
  const [isLoadingInitial, setIsLoadingInitial] = useState(!initialAddress);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isMapDragging, setIsMapDragging] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
        await initMap();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const getCurrentPosition = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject("Geolocation not supported");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const initMap = async () => {
      try {
          await loadGoogleMaps();
          if (!mapRef.current) return;
          if (typeof google === 'undefined' || !google.maps) {
              setMapError("Erro ao carregar serviços de mapa.");
              return;
          }

          let startLocation = addrCoords || APIACAS_CENTER;
          let initialZoom = 17;

          if (!initialAddress && !addrCoords) {
            try {
              const gpsPos = await getCurrentPosition();
              startLocation = gpsPos;
            } catch (e) {
              startLocation = APIACAS_CENTER;
              initialZoom = 14; 
            }
          }

          const map = new google.maps.Map(mapRef.current, {
              center: startLocation,
              zoom: initialZoom,
              disableDefaultUI: true,
              zoomControl: false, 
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              gestureHandling: 'greedy',
              clickableIcons: false
          });

          googleMapInstance.current = map;
          isMapReady.current = true;
          setIsLoadingInitial(false);

          map.addListener('dragstart', () => {
             setIsMapDragging(true);
          });

          map.addListener('idle', () => {
              setIsMapDragging(false);
              const center = map.getCenter();
              const lat = center.lat();
              const lng = center.lng();
              
              setAddrCoords({ lat, lng });
              
              reverseGeocodeDetails(lat, lng).then(details => {
                  if (details) {
                      // Preenchimento Automático Inteligente
                      if (details.street) setAddrStreet(details.street);
                      if (details.neighborhood) setAddrNeighborhood(details.neighborhood);
                      if (details.city) setAddrCity(details.city);
                      if (details.state) setAddrState(details.state);
                      if (details.zipCode) setAddrZip(details.zipCode);
                      
                      // Só preenche o número se for um número único real
                      if (details.number && !details.number.includes('-')) {
                         setAddrNumber(details.number);
                      }
                  }
              }).catch(err => {
                  console.error("Reverse geocode failed", err);
              });
          });

      } catch (error) {
          console.error("Error initializing map", error);
          setMapError("Não foi possível carregar o mapa.");
          setIsLoadingInitial(false);
      }
  };

  const handleUseCurrentLocation = async () => {
      setIsLoadingLocation(true);
      try {
          const pos = await getCurrentPosition();
          if (googleMapInstance.current) {
              googleMapInstance.current.panTo(pos);
              googleMapInstance.current.setZoom(18);
          }
      } catch (error) {
          console.error("Geolocation failed:", error);
          alert("Não conseguimos obter sua localização exata.");
      } finally {
          setIsLoadingLocation(false);
      }
  };

  const handleConfirm = () => {
      if (!addrStreet.trim()) {
          alert("Por favor, informe a rua.");
          return;
      }

      onSave({
          label: addrLabel,
          street: addrStreet.trim(),
          number: addrNumber.trim() || 'S/N',
          neighborhood: addrNeighborhood.trim() || 'Centro',
          city: addrCity,
          state: addrState,
          zipCode: addrZip,
          complement: addrComplement,
          reference: addrReference,
          coords: addrCoords || APIACAS_CENTER
      });
  };

  return (
      <div className="fixed inset-0 z-[70] bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm">
          <div className="bg-white w-full md:max-w-xl md:rounded-[2.5rem] rounded-t-[3rem] p-6 h-[92vh] md:h-auto overflow-y-auto no-scrollbar animate-in slide-in-from-bottom duration-300 relative shadow-2xl">
              
              <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="font-black text-xl text-gray-900 tracking-tight">{title}</h2>
                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">{addrCity}, {addrState}</p>
                  </div>
                  <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"><X size={20}/></button>
              </div>

              <div className="space-y-5 pb-6">
                    {/* ÁREA DO MAPA */}
                    <div className="relative w-full h-64 bg-gray-100 rounded-3xl overflow-hidden shadow-inner border border-gray-100 group">
                        {isLoadingInitial && (
                            <div className="absolute inset-0 z-30 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center p-4">
                                <Loader className="animate-spin text-orange-600" size={32}/>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Localizando...</p>
                            </div>
                        )}

                        {mapError ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gray-50">
                                <AlertCircle className="text-gray-300 mb-2" size={40}/>
                                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">{mapError}</p>
                            </div>
                        ) : (
                            <div ref={mapRef} className="w-full h-full" />
                        )}
                        
                        {!mapError && !isLoadingInitial && (
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none pb-[34px]">
                                    <MapPin size={40} className={`drop-shadow-lg transition-all duration-300 ${isMapDragging ? 'text-orange-500 -translate-y-2' : 'text-orange-600'}`} />
                                    <div className={`w-3 h-1.5 bg-black/30 rounded-full mx-auto mt-[-5px] blur-[1px] transition-all duration-300 ${isMapDragging ? 'scale-75 opacity-30' : 'scale-100 opacity-100'}`}></div>
                            </div>
                        )}

                        <button 
                            onClick={handleUseCurrentLocation}
                            className="absolute bottom-4 right-4 bg-white p-3 rounded-2xl shadow-xl text-orange-600 hover:bg-orange-50 transition z-20 flex items-center justify-center border border-gray-50"
                        >
                            {isLoadingLocation ? <Loader className="animate-spin" size={20} /> : <Crosshair size={20} />}
                        </button>
                    </div>
                    
                    <p className="text-center text-[9px] text-gray-400 font-black uppercase tracking-widest">
                        {isMapDragging ? 'Solte para definir' : 'Arraste o mapa para ajustar o pino'}
                    </p>

                    {/* CAMPOS DE FORMULÁRIO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rua / Avenida</label>
                            <input value={addrStreet} onChange={e => setAddrStreet(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-orange-200" placeholder="Nome da rua" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Número</label>
                                <input value={addrNumber} onChange={e => setAddrNumber(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-orange-200" placeholder="S/N" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">CEP (Sugerido)</label>
                                <input value={addrZip} onChange={e => setAddrZip(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-orange-200" placeholder="00000-000" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Bairro</label>
                            <input value={addrNeighborhood} onChange={e => setAddrNeighborhood(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-orange-200" placeholder="Ex: Centro" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Referência</label>
                            <input value={addrReference} onChange={e => setAddrReference(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-sm outline-none focus:bg-white focus:border-orange-200" placeholder="Ex: Próximo à praça" />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                            <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition">Cancelar</button>
                            <button onClick={handleConfirm} className="flex-1 bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition shadow-xl shadow-orange-100">{saveButtonLabel}</button>
                    </div>
              </div>
          </div>
      </div>
  );
};
