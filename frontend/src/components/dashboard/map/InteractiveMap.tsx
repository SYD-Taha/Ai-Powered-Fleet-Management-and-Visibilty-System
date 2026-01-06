import { useEffect, useRef, useState, createContext, useContext } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface InteractiveMapProps {
  isDayMode: boolean;
  children?: React.ReactNode;
}

const MapContext = createContext<maplibregl.Map | null>(null);

export const useMap = () => useContext(MapContext);

export const InteractiveMap = ({ isDayMode, children }: InteractiveMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map with performance optimizations
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19 // Reduced max zoom for better performance
          }
        ]
      },
      center: [67.0039, 24.8615], // Karachi center [lng, lat]
      zoom: 11,
      // Performance optimizations
      renderWorldCopies: false, // Don't render multiple world copies
      maxTileCacheSize: 50, // Increase tile cache
      fadeDuration: 0, // Disable fade for faster rendering
      preserveDrawingBuffer: false, // Better performance
    });

    // Optimize tile loading and prevent blur
    map.current.on('load', () => {
      setMapLoaded(true);
      
      if (map.current) {
        map.current.setMaxTileCacheSize(50);
        // Improve rendering quality
        map.current.getCanvas().style.imageRendering = 'crisp-edges';
      }
    });

    // Prevent blur on zoom/pan by using crisp rendering
    map.current.on('zoomstart', () => {
      if (map.current) {
        map.current.getCanvas().style.imageRendering = 'crisp-edges';
      }
    });

    map.current.on('zoomend', () => {
      if (map.current) {
        map.current.getCanvas().style.imageRendering = 'auto';
      }
    });

    // Cleanup
    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map style based on day/night mode
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // For now, we'll use the same OSM tiles for both modes
    // In the future, you could switch to different tile sources for dark mode
    // For example, using a dark theme tile server
  }, [isDayMode, mapLoaded]);

  return (
    <div ref={mapContainer} className="absolute inset-0 w-full h-full">
      <MapContext.Provider value={map.current}>
        {mapLoaded && children}
      </MapContext.Provider>
    </div>
  );
};

