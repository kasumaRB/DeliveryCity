import React, { useEffect, useRef } from 'react';

interface DriverTrackingMapProps {
  driverLoc: { lat: number; lng: number } | null;
  destCoords: { lat: number; lng: number } | null;
}

export const DriverTrackingMap: React.FC<DriverTrackingMapProps> = ({ driverLoc, destCoords }) => {
  const mapRef        = useRef<HTMLDivElement>(null);
  const leafletMap    = useRef<any>(null);
  const driverMarker  = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const initialized   = useRef(false);

  // ── Inicializa o mapa uma única vez ────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const center = driverLoc || destCoords || { lat: -9.5422, lng: -57.4486 };

    (async () => {
      if (!mapRef.current || (mapRef.current as any)._leaflet_id) return;

      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Controle de zoom discreto
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // ── Marcador de destino (pin padrão) ─────────────────────────────────
      if (destCoords) {
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        destMarkerRef.current = L.marker([destCoords.lat, destCoords.lng])
          .bindPopup('Seu endereço')
          .addTo(map);
      }

      // ── Bolinha azul pulsante do entregador ──────────────────────────────
      if (driverLoc) {
        const driverIcon = L.divIcon({
          html: '<div class="dc-driver-dot"></div>',
          className: '',
          iconSize:   [20, 20],
          iconAnchor: [10, 10],
        });
        driverMarker.current = L.marker([driverLoc.lat, driverLoc.lng], { icon: driverIcon }).addTo(map);
      }

      // Ajusta o zoom para mostrar ambos os pontos
      if (driverLoc && destCoords) {
        try {
          map.fitBounds(
            [[driverLoc.lat, driverLoc.lng], [destCoords.lat, destCoords.lng]],
            { padding: [40, 40], maxZoom: 16 }
          );
        } catch { /* silencioso */ }
      }

      leafletMap.current = map;
    })();

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current  = null;
        driverMarker.current  = null;
        destMarkerRef.current = null;
      }
      initialized.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Atualiza posição do entregador quando chega nova localização ───────────
  useEffect(() => {
    if (!driverLoc) return;

    if (!leafletMap.current) return;

    if (driverMarker.current) {
      // Move o marcador existente suavemente
      driverMarker.current.setLatLng([driverLoc.lat, driverLoc.lng]);
    } else {
      // Cria o marcador pela primeira vez (pode chegar após a inicialização do mapa)
      (async () => {
        const L = (await import('leaflet')).default;
        const driverIcon = L.divIcon({
          html: '<div class="dc-driver-dot"></div>',
          className: '',
          iconSize:   [20, 20],
          iconAnchor: [10, 10],
        });
        driverMarker.current = L.marker([driverLoc.lat, driverLoc.lng], { icon: driverIcon })
          .addTo(leafletMap.current);

        // Se temos os dois pontos agora, ajusta bounds
        if (destCoords) {
          try {
            leafletMap.current.fitBounds(
              [[driverLoc.lat, driverLoc.lng], [destCoords.lat, destCoords.lng]],
              { padding: [40, 40], maxZoom: 16 }
            );
          } catch { /* silencioso */ }
        }
      })();
    }

    // Pan suave para acompanhar o entregador
    leafletMap.current.panTo([driverLoc.lat, driverLoc.lng], { animate: true, duration: 0.8 });
  }, [driverLoc]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Estilo da bolinha azul pulsante — inserido inline para não precisar de arquivo CSS separado */}
      <style>{`
        .dc-driver-dot {
          width: 18px;
          height: 18px;
          background: #3b82f6;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
          animation: dc-pulse 1.8s ease-out infinite;
        }
        @keyframes dc-pulse {
          0%   { box-shadow: 0 2px 6px rgba(0,0,0,0.35), 0 0 0 0   rgba(59,130,246,0.55); }
          70%  { box-shadow: 0 2px 6px rgba(0,0,0,0.35), 0 0 0 14px rgba(59,130,246,0);   }
          100% { box-shadow: 0 2px 6px rgba(0,0,0,0.35), 0 0 0 0   rgba(59,130,246,0);   }
        }
      `}</style>

      <div
        ref={mapRef}
        style={{
          height: '200px',
          width: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 0,
        }}
      />
    </>
  );
};
