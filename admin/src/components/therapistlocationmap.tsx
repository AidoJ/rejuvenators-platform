import React, { useEffect, useRef, useState } from 'react';
import { Card, Spin } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';

interface TherapistLocationMapProps {
  latitude?: number;
  longitude?: number;
  address?: string;
  serviceRadius?: number; // in kilometers
  showRadius?: boolean;
  height?: number;
  apiKey?: string;
}

const TherapistLocationMap: React.FC<TherapistLocationMapProps> = ({
  latitude,
  longitude,
  address,
  serviceRadius = 20,
  showRadius = true,
  height = 250,
  apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyBSFcQHl262KbU3H7-N6AdzEj-VO-wRASI'
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (latitude && longitude) {
      loadMap();
    } else {
      setLoading(false);
    }
  }, [latitude, longitude, serviceRadius, showRadius]);

  const loadMap = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if Google Maps is already loaded
      if (!window.google?.maps) {
        await loadGoogleMapsAPI();
      }

      if (mapRef.current && latitude && longitude) {
        initializeMap();
      }
    } catch (err) {
      console.error('Error loading map:', err);
      setError('Failed to load map');
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleMapsAPI = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }

      const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
      if (existingScript) {
        // Wait for existing script to load
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps API'));
      
      document.head.appendChild(script);
    });
  };

  const initializeMap = () => {
    if (!mapRef.current || !latitude || !longitude) return;

    const center = new google.maps.LatLng(latitude, longitude);

    // Create map
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center: center,
      zoom: 13,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    // Add marker
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    markerRef.current = new google.maps.Marker({
      position: center,
      map: mapInstanceRef.current,
      title: address || 'Therapist Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: '#1890ff',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    });

    // Add service radius circle
    if (showRadius && serviceRadius > 0) {
      if (circleRef.current) {
        circleRef.current.setMap(null);
      }

      circleRef.current = new google.maps.Circle({
        strokeColor: '#1890ff',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: '#1890ff',
        fillOpacity: 0.15,
        map: mapInstanceRef.current,
        center: center,
        radius: serviceRadius * 1000 // Convert km to meters
      });

      // Adjust zoom to fit circle
      const bounds = circleRef.current.getBounds();
      if (bounds) {
        mapInstanceRef.current.fitBounds(bounds);
        
        // Ensure minimum zoom level
        const listener = google.maps.event.addListener(mapInstanceRef.current, 'zoom_changed', () => {
          if (mapInstanceRef.current!.getZoom()! > 15) {
            mapInstanceRef.current!.setZoom(15);
          }
          google.maps.event.removeListener(listener);
        });
      }
    }
  };

  const cleanup = () => {
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }
    mapInstanceRef.current = null;
  };

  useEffect(() => {
    return cleanup;
  }, []);

  if (!latitude || !longitude) {
    return (
      <Card size="small" style={{ height }}>
        <div 
          style={{ 
            height: height - 48, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#8c8c8c',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <EnvironmentOutlined style={{ fontSize: 24 }} />
          <span>Enter and select an address to see location preview</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card size="small" style={{ height }}>
        <div 
          style={{ 
            height: height - 48, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#ff4d4f',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <EnvironmentOutlined style={{ fontSize: 24 }} />
          <span>{error}</span>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      size="small" 
      style={{ height }}
      title={
        <div style={{ fontSize: '14px', fontWeight: 'normal' }}>
          📍 Location Preview {showRadius && serviceRadius > 0 && `• ${serviceRadius}km service radius`}
        </div>
      }
    >
      <div style={{ position: 'relative', height: height - 48 }}>
        {loading && (
          <div 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 1
            }}
          >
            <Spin size="large" />
          </div>
        )}
        <div 
          ref={mapRef} 
          style={{ 
            width: '100%', 
            height: '100%',
            borderRadius: '6px'
          }} 
        />
      </div>
    </Card>
  );
};

export default TherapistLocationMap;
