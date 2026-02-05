import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useState, useEffect } from "react";

// Fix default marker icon issue in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Example coconut farm data around Kurunegala
const farms = [
  {
    id: 1,
    name: "Kurunegala Coconut Estate",
    lat: 7.4863,
    lng: 80.3623,
    status: "healthy",
  },
  {
    id: 2,
    name: "Mawathagama Coconut Farm",
    lat: 7.5170,
    lng: 80.3530,
    status: "warning",
  },
  {
    id: 3,
    name: "Nikaweratiya Coconut Plantation",
    lat: 7.6660,
    lng: 80.2900,
    status: "critical",
  },
];

// Marker colors by status
const markerColor = {
  healthy: "green",
  warning: "orange",
  critical: "red",
};

// Component to auto-fit map bounds
const FitBounds = ({ locations }) => {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;
    const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [locations, map]);

  return null;
};

const FarmMap = () => {
  const [selectedFarm, setSelectedFarm] = useState(null);

  return (
    <MapContainer
      center={[7.556, 80.335]} // temporary center, will auto-fit bounds
      zoom={12}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Free vegetation-friendly ESRI map */}
      <TileLayer
        attribution="Tiles © Esri"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
      />

      {farms.map((farm) => (
        <Marker
          key={farm.id}
          position={[farm.lat, farm.lng]}
          eventHandlers={{
            click: () => setSelectedFarm(farm),
          }}
          icon={L.divIcon({
            className: "custom-marker",
            html: `<div style="
              background:${markerColor[farm.status]};
              width:14px;
              height:14px;
              border-radius:50%;
              border:2px solid white;
              box-shadow:0 0 4px rgba(0,0,0,.4);
            "></div>`,
          })}
        />
      ))}

      {selectedFarm && (
        <Popup
          position={[selectedFarm.lat, selectedFarm.lng]}
          onClose={() => setSelectedFarm(null)}
        >
          <div className="text-sm">
            <p className="font-semibold">{selectedFarm.name}</p>
            <p className="mt-1 capitalize">
              Status:{" "}
              <span
                style={{
                  color: markerColor[selectedFarm.status],
                  fontWeight: 600,
                }}
              >
                {selectedFarm.status}
              </span>
            </p>
          </div>
        </Popup>
      )}

      {/* Auto-fit map bounds to show all farms */}
      <FitBounds locations={farms} />
    </MapContainer>
  );
};

export default FarmMap;
