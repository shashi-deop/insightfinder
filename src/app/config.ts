// Backend URL configuration
export const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? process.env.NEXT_PUBLIC_BACKEND_URL || 'https://your-backend-url.railway.app'
  : 'http://localhost:8000';

// API endpoints
export const API_ENDPOINTS = {
  SEARCH: `${BACKEND_URL}/search`,
  STATUS: `${BACKEND_URL}/status`,
  FILE: (filename: string) => `${BACKEND_URL}/file/${encodeURIComponent(filename)}`,
  DEBUG: `${BACKEND_URL}/debug/files`,
} as const; 