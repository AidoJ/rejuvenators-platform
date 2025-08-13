declare global {
  interface Window {
    google: typeof google;
  }
}

declare namespace google.maps {
  // Add any specific Google Maps types you need
}
