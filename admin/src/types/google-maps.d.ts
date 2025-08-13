declare global {
  interface Window {
    google: any;
  }
}

declare namespace google.maps {
  class Map {
    constructor(mapDiv: Element, opts?: any);
  }
  class Marker {
    constructor(opts?: any);
    setMap(map: Map | null): void;
  }
  class Circle {
    constructor(opts?: any);
    setMap(map: Map | null): void;
  }
  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }
  class Geocoder {
    constructor();
    geocode(request: any, callback: Function): void;
  }
  namespace places {
    class Autocomplete {
      constructor(inputField: Element, opts?: any);
      addListener(eventName: string, handler: Function): any;
      getPlace(): any;
    }
  }
  namespace event {
    function addListener(instance: any, eventName: string, handler: Function): any;
    function clearInstanceListeners(instance: any): void;
  }
  interface GeocoderAddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
  }
  enum GeocoderStatus {
    OK = 'OK'
  }
}

export {};
