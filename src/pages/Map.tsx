import { MapContainer, TileLayer, Marker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon, type LatLngExpression } from 'leaflet';
import { Filter, Layers } from 'lucide-react';

// Fix for Leaflet default icon issues in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = new Icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Markers data
const markers = [
  { id: 1, pos: [51.505, -0.09] as LatLngExpression, title: "Central Bridge", status: "Good", type: "Bridge" },
  { id: 2, pos: [51.51, -0.1] as LatLngExpression, title: "North Highway", status: "Critical", type: "Road" },
  { id: 3, pos: [51.51, -0.08] as LatLngExpression, title: "City Hospital", status: "Good", type: "Facility" },
  { id: 4, pos: [51.49, -0.08] as LatLngExpression, title: "Power Station", status: "Fair", type: "Utility" },
  { id: 5, pos: [51.505, -0.12] as LatLngExpression, title: "West End Road", status: "Good", type: "Road" },
];

const MapView = () => {
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-white">Geospatial Intelligence</h1>
           <p className="text-slate-400">Real-time asset tracking and status map</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-[#112240] border border-[#233554] rounded-lg text-slate-300 hover:text-white text-sm">
            <Layers size={16} />
            Layers
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-[#112240] border border-[#233554] rounded-lg text-slate-300 hover:text-white text-sm">
            <Filter size={16} />
            Filters
          </button>
        </div>
      </div>

      <div className="flex-1 rounded-2xl overflow-hidden border border-[#233554] relative z-0 shadow-2xl">
        <MapContainer 
          center={[51.505, -0.09] as LatLngExpression} 
          zoom={13} 
          scrollWheelZoom={true} 
          style={{ height: '100%', width: '100%', background: '#0a192f' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {markers.map((marker) => (
            <Marker key={marker.id} position={marker.pos} icon={DefaultIcon}>
              <Popup className="custom-popup">
                <div className="p-1">
                  <h3 className="font-bold text-slate-800">{marker.title}</h3>
                  <p className="text-sm text-slate-600">{marker.type}</p>
                  <div className={`mt-2 text-xs font-bold px-2 py-1 rounded inline-block ${
                    marker.status === 'Critical' ? 'bg-red-100 text-red-600' : 
                    marker.status === 'Fair' ? 'bg-amber-100 text-amber-600' : 
                    'bg-emerald-100 text-emerald-600'
                  }`}>
                    {marker.status}
                  </div>
                </div>
              </Popup>
              <LeafletTooltip direction="top" offset={[0, -20]} opacity={1}>
                {marker.title}
              </LeafletTooltip>
            </Marker>
          ))}
        </MapContainer>

        {/* Floating Controls Overlay */}
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
          <div className="bg-[#112240]/90 backdrop-blur p-4 rounded-xl border border-[#233554] shadow-xl w-64">
            <h4 className="text-white font-semibold mb-3 text-sm">Map Legend</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Good Condition</span>
                <span className="font-mono">65%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500"></div> Maintenance</span>
                <span className="font-mono">25%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div> Critical</span>
                <span className="font-mono">10%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 z-[400]">
           <div className="bg-[#112240]/90 backdrop-blur px-4 py-2 rounded-lg border border-[#233554] text-xs text-slate-400">
              Live Feed • Updated 2s ago
           </div>
        </div>
      </div>
    </div>
  );
};

export default MapView;
