import React, { useEffect, useRef, useState } from 'react';
import { Card, Spin, Alert } from 'antd';

/// <reference path="../types/google-maps.d.ts" />

interface TherapistLocationMapProps {
  address?: string;
  latitude?: number;
  longitude?: number;
  serviceRadius?: number;
  height?: number;
  showRadius?: boolean;
  style?: React.CSSProperties;
}

const TherapistLocationMap: React.FC<TherapistLocationMapProps> = ({
  address,
  latitude,
  longitude,
  serviceRadius = 50,
  height = 400,
  showRadius = true,
  style
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const initializeMap = () => {
      try {
        if (!(window as any).google?.maps) {
          setTimeout(initializeMap, 100);
          return;
        }

        // Default to Melbourne if no coordinates provided
        const defaultLat = latitude || -37.8136;
        const defaultLng = longitude || 144.9631;

        const map = new (window as any).google.maps.Map(mapRef.current, {
          zoom: 12,
          center: { lat: defaultLat, lng: defaultLng },
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        mapInstanceRef.current = map;

        // Add marker if coordinates provided
        if (latitude && longitude) {
          updateMapLocation(latitude, longitude);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to load map');
        setLoading(false);
      }
    };

    // Load Google Maps API if not already loaded
    if (!(window as any).google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.onload = initializeMap;
      script.onerror = () => {
        setError('Failed to load Google Maps');
        setLoading(false);
      };
      document.head.appendChild(script);
    } else {
      initializeMap();
    }
  }, []);

  useEffect(() => {
    if (latitude && longitude && mapInstanceRef.current) {
      updateMapLocation(latitude, longitude);
    }
  }, [latitude, longitude, serviceRadius, showRadius]);

  const updateMapLocation = (lat: number, lng: number) => {
    if (!mapInstanceRef.current) return;

    const google = (window as any).google;
    const position = new google.maps.LatLng(lat, lng);

    // Update map center
    mapInstanceRef.current.setCenter(position);
    mapInstanceRef.current.setZoom(13);

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }

    // Add new marker
    markerRef.current = new google.maps.Marker({
      position: position,
      map: mapInstanceRef.current,
      title: address || 'Therapist Location',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="14" fill="#1890ff" stroke="white" stroke-width="2"/>
            <circle cx="16" cy="16" r="6" fill="white"/>
          </svg>
        `),
        scaledSize: new google.maps.Size(32, 32),
        anchor: new google.maps.Point(16, 16)
      }
    });

    // Remove existing circle
    if (circleRef.current) {
      circleRef.current.setMap(null);
    }

    // Add service radius circle if enabled
    if (showRadius && serviceRadius > 0) {
      circleRef.current = new google.maps.Circle({
        map: mapInstanceRef.current,
        center: position,
        radius: serviceRadius * 1000, // Convert km to meters
        fillColor: '#1890ff',
        fillOpacity: 0.1,
        strokeColor: '#1890ff',
        strokeOpacity: 0.3,
        strokeWeight: 2
      });

      // Adjust zoom to fit circle
      const bounds = new google.maps.LatLngBounds();
      const radiusInDegrees = serviceRadius / 111; // Rough conversion
      bounds.extend(new google.maps.LatLng(lat + radiusInDegrees, lng + radiusInDegrees));
      bounds.extend(new google.maps.LatLng(lat - radiusInDegrees, lng - radiusInDegrees));
      mapInstanceRef.current.fitBounds(bounds);
    }
  };

  if (error) {
    return (
      <Alert
        message="Map Error"
        description={error}
        type="error"
        style={{ height, ...style }}
      />
    );
  }

  return (
    <Card style={style}>
      <div style={{ position: 'relative', height }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.8)',
            zIndex: 1
          }}>
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
