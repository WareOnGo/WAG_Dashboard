// Application constants
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://u3yrpp3726.ap-south-1.awsapprunner.com/api';

// Debug logging (remove in production)
console.log('API_BASE_URL:', API_BASE_URL);
console.log('VITE_API_BASE_URL env var:', import.meta.env.VITE_API_BASE_URL);
console.log('Current window location:', window.location.href);