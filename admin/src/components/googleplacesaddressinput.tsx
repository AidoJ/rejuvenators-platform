import React, { useEffect, useRef, useState } from 'react';
import { Input, message } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';

/// <reference path="../types/google-maps.d.ts" />

interface AddressData {
  formatted_address: string;
  components: {
    streetNumber?: string;
    streetName?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countryCode?: string;
  };
  geometry: {
    lat: number;
    lng: number;
  };
  place_id: string;
}

interface GooglePlacesAddressInputProps {
  value?: string;
  onChange?: (value: string) => void;
  onAddressSelect?: (addressData: AddressData) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const GooglePlacesAddressInput: React.FC<GooglePlacesAddressInputProps> = ({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Enter address...",
  disabled = false,
  style
}) => {
  const inputRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inputRef.current || disabled) return;

    const initializeAutocomplete = () => {
      try {
        if (!(window as any).google?.maps?.places) {
          setTimeout(initializeAutocomplete, 100);
          return;
        }

        const autocomplete = new (window as any).google.maps.places.Autocomplete(
          inputRef.current.input,
          {
            types: ['address'],
            componentRestrictions: { country: 'AU' },
            fields: ['address_components', 'formatted_address', 'geometry', 'place_id']
          }
        );

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (!place.geometry) {
            message.error('Invalid address selected');
            return;
          }

          const addressData = parseAddressComponents(place);
          onChange?.(place.formatted_address);
          onAddressSelect?.(addressData);
        });

        autocompleteRef.current = autocomplete;
      } catch (error) {
        console.error('Error initializing Google Places:', error);
      }
    };

    // Load Google Maps API if not already loaded
    if (!(window as any).google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.onload = initializeAutocomplete;
      document.head.appendChild(script);
    } else {
      initializeAutocomplete();
    }

    return () => {
      if (autocompleteRef.current && (window as any).google?.maps?.event) {
        (window as any).google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [disabled, onChange, onAddressSelect]);

  const parseAddressComponents = (place: any): AddressData => {
    const components: any = {};
    
    if (place.address_components) {
      place.address_components.forEach((component: any) => {
        const types = component.types;
        
        if (types.includes('street_number')) {
          components.streetNumber = component.long_name;
        }
        if (types.includes('route')) {
          components.streetName = component.long_name;
        }
        if (types.includes('locality')) {
          components.city = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          components.state = component.short_name;
        }
        if (types.includes('postal_code')) {
          components.postcode = component.long_name;
        }
        if (types.includes('country')) {
          components.country = component.long_name;
          components.countryCode = component.short_name;
        }
      });
    }

    return {
      formatted_address: place.formatted_address,
      components,
      geometry: {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      },
      place_id: place.place_id
    };
  };

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      prefix={<EnvironmentOutlined />}
      loading={loading}
    />
  );
};

export default GooglePlacesAddressInput;
