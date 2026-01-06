import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { createRoot, Root } from 'react-dom/client';
import { useMap } from './InteractiveMap';

interface MapMarkerProps {
  latitude: number;
  longitude: number;
  children: React.ReactNode;
  anchor?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export const MapMarker = ({ latitude, longitude, children, anchor = 'center' }: MapMarkerProps) => {
  const map = useMap();
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const rootRef = useRef<Root | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!map) return;

    // Create container for marker
    const el = document.createElement('div');
    el.className = 'map-marker-container';
    containerRef.current = el;

    // Create React root and render children
    const root = createRoot(el);
    root.render(<>{children}</>);
    rootRef.current = root;

    // Create MapLibre marker
    const marker = new maplibregl.Marker({
      element: el,
      anchor: anchor,
    })
      .setLngLat([longitude, latitude])
      .addTo(map);

    markerRef.current = marker;

    // Cleanup
    return () => {
      marker.remove();
      if (rootRef.current) {
        rootRef.current.unmount();
      }
    };
  }, [map, anchor]);

  // Update marker position when coordinates change
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat([longitude, latitude]);
    }
  }, [latitude, longitude]);

  // Update marker content when children change
  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.render(<>{children}</>);
    }
  }, [children]);

  return null;
};

