import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Input, message } from 'antd';
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';

interface AddressData {
  formatted_address: string;
  components: {
    streetNumber?: string;
    streetName?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
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
  onAddressSelected?: (addressData: AddressData) => void;
  onValidationChange?: (isValid: boolean, addressData?: AddressData) => void;
  placeholder?: string;
  disabled?: boolean;
  status?: '' | 'error' | 'warning';
  apiKey?: string;
}

export interface GooglePlacesAddressInputRef {
  focus: () => void;
  blur: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  getSelectedAddress: () => AddressData | null;
  isValidAddress: () => boolean;
  clear: () => void;
}

const GooglePlacesAddressInput = forwardRef<GooglePlacesAddressInputRef, GooglePlacesAddressInputProps>(
  ({ 
    value, 
    onChange, 
    onAddressSelected, 
    onValidationChange,
    placeholder = "Enter your address...",
    disabled = false,
    status,
    apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyBSFcQHl262KbU3H7-N6AdzEj-VO-wRASI'
  }, ref) => {
    const inputRef = useRef<any>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const selectedAddressRef = useRef<AddressData | null>(null);
    const isValidRef = useRef<boolean>(false);
    const loadingRef = useRef<boolean>(false);

    // Load Google Maps API
    useEffect(() => {
      const loadGoogleMaps = async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;

        try {
          // Check if Google Maps is already loaded
          if (window.google && window.google.maps && window.google.maps.places) {
            initializeAutocomplete();
            return;
          }

          // Load Google Maps API
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
          script.async = true;
          script.defer = true;
          
          script.onload = () => {
            initializeAutocomplete();
          };
          
          script.onerror = () => {
            message.error('Failed to load Google Maps API');
            loadingRef.current = false;
          };
          
          document.head.appendChild(script);
        } catch (error) {
          console.error('Error loading Google Maps:', error);
          message.error('Error loading address autocomplete');
          loadingRef.current = false;
        }
      };

      loadGoogleMaps();

      return () => {
        if (autocompleteRef.current) {
          google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      };
    }, [apiKey]);

    const initializeAutocomplete = () => {
      if (!inputRef.current?.input) return;

      try {
        autocompleteRef.current = new google.maps.places.Autocomplete(
          inputRef.current.input,
          {
            types: ['address'],
            componentRestrictions: { country: 'AU' },
            fields: ['address_components', 'formatted_address', 'geometry', 'place_id']
          }
        );

        autocompleteRef.current.addListener('place_changed', handlePlaceSelection);
        loadingRef.current = false;
      } catch (error) {
        console.error('Error initializing autocomplete:', error);
        message.error('Error setting up address autocomplete');
        loadingRef.current = false;
      }
    };

    const handlePlaceSelection = () => {
      const place = autocompleteRef.current?.getPlace();
      
      if (!place || !place.geometry) {
        isValidRef.current = false;
        selectedAddressRef.current = null;
        onValidationChange?.(false);
        message.warning('Please select a valid address from the suggestions');
        return;
      }

      // Parse address components
      const addressData: AddressData = {
        formatted_address: place.formatted_address || '',
        components: parseAddressComponents(place.address_components || []),
        geometry: {
          lat: place.geometry.location!.lat(),
          lng: place.geometry.location!.lng()
        },
        place_id: place.place_id || ''
      };

      isValidRef.current = true;
      selectedAddressRef.current = addressData;
      
      // Update form value
      onChange?.(addressData.formatted_address);
      onAddressSelected?.(addressData);
      onValidationChange?.(true, addressData);
      
      message.success('Address verified ✓');
    };

    const parseAddressComponents = (components: google.maps.GeocoderAddressComponent[]) => {
      const parsed: any = {};
      
      components.forEach(component => {
        const types = component.types;
        
        if (types.includes('street_number')) {
          parsed.streetNumber = component.long_name;
        }
        if (types.includes('route')) {
          parsed.streetName = component.long_name;
        }
        if (types.includes('locality')) {
          parsed.city = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          parsed.state = component.short_name;
        }
        if (types.includes('postal_code')) {
          parsed.postcode = component.long_name;
        }
        if (types.includes('country')) {
          parsed.country = component.long_name;
        }
      });

      return parsed;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange?.(newValue);
      
      // Reset validation when user types
      if (isValidRef.current && newValue !== selectedAddressRef.current?.formatted_address) {
        isValidRef.current = false;
        selectedAddressRef.current = null;
        onValidationChange?.(false);
      }
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      getValue: () => value || '',
      setValue: (newValue: string) => onChange?.(newValue),
      getSelectedAddress: () => selectedAddressRef.current,
      isValidAddress: () => isValidRef.current,
      clear: () => {
        onChange?.('');
        isValidRef.current = false;
        selectedAddressRef.current = null;
        onValidationChange?.(false);
      }
    }));

    // Determine input status and suffix
    const getInputStatus = () => {
      if (status) return status;
      if (value && isValidRef.current) return 'success' as any;
      if (value && !isValidRef.current) return 'warning' as any;
      return undefined;
    };

    const getSuffix = () => {
      if (value && isValidRef.current) {
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      }
      if (value && !isValidRef.current) {
        return <WarningOutlined style={{ color: '#fa8c16' }} />;
      }
      return null;
    };

    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        status={getInputStatus()}
        suffix={getSuffix()}
        autoComplete="off"
      />
    );
  }
);

GooglePlacesAddressInput.displayName = 'GooglePlacesAddressInput';

export default GooglePlacesAddressInput;
