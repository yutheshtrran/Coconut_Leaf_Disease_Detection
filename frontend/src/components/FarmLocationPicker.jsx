import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Loader2 } from 'lucide-react';

// Fix broken default marker icons in Vite builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Handles map clicks and reports {lat, lng} to parent
function ClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// Flies to a given [lat, lon] position when it changes
function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 1.2 });
  }, [map, position]);
  return null;
}

async function nominatimReverse(lat, lon) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const d = await r.json();
    return d.display_name || '';
  } catch {
    return '';
  }
}

const FarmLocationPicker = ({ value, onChange, detectedGps }) => {
  const initPos = value?.lat != null ? [value.lat, value.lon] : null;
  const [position, setPosition] = useState(initPos);
  const [address,  setAddress]  = useState(value?.address || '');
  const [geocoding, setGeocoding] = useState(false);
  const debounceRef = useRef(null);

  const applyPosition = useCallback(async (lat, lon) => {
    const pos = [lat, lon];
    setPosition(pos);
    setAddress('');
    setGeocoding(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const addr = await nominatimReverse(lat, lon);
      setAddress(addr);
      setGeocoding(false);
      onChange({ lat, lon, address: addr });
    }, 400);
  }, [onChange]);

  // Sync external value changes (e.g. parent sets it programmatically)
  useEffect(() => {
    if (value?.lat != null && value?.lon != null) {
      setPosition([value.lat, value.lon]);
      if (value.address !== undefined) setAddress(value.address);
    }
  }, [value?.lat, value?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = useCallback(({ lat, lng }) => {
    applyPosition(lat, lng);
  }, [applyPosition]);

  const handleUseDetected = () => {
    if (detectedGps) applyPosition(detectedGps.lat, detectedGps.lon);
  };

  return (
    <div className="space-y-2">
      {detectedGps && (
        <button
          type="button"
          onClick={handleUseDetected}
          className="flex items-center gap-2 text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition w-full"
        >
          <Navigation size={13} className="shrink-0" />
          <span>Use GPS extracted from video — {detectedGps.lat.toFixed(5)}°N, {detectedGps.lon.toFixed(5)}°E</span>
        </button>
      )}

      <div
        className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600"
        style={{ height: 240 }}
      >
        <MapContainer
          center={position || [7.8731, 80.7718]}
          zoom={position ? 15 : 7}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onMapClick={handleMapClick} />
          {position && <FlyTo position={position} />}
          {position && (
            <Marker
              position={position}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  applyPosition(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex items-start gap-2 min-h-[20px]">
        <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
        {position ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
            {position[0].toFixed(6)}°N, {position[1].toFixed(6)}°E
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">Click the map to pin the farm location</span>
        )}
        {geocoding && (
          <Loader2 size={12} className="ml-auto animate-spin text-blue-500 shrink-0" />
        )}
      </div>

      {address && !geocoding && (
        <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-2.5 py-1.5 leading-relaxed">
          {address}
        </p>
      )}
    </div>
  );
};

export default FarmLocationPicker;
