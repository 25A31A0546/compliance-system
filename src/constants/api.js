/**
 * src/constants/api.js
 *
 * Centralized API configuration for the Legal Metrology Inspection Engine.
 * Update API_HOST with your machine's local Wi-Fi / Ethernet IP address.
 */

export const API_HOST = '192.168.0.112';
export const API_PORT = '8000';
export const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;

export const INSPECTION_API_URL = `${API_BASE_URL}/api/v1/inspect`;
export const SYNC_ENDPOINT = `${API_BASE_URL}/api/v1/inspections`;
export const HEALTH_ENDPOINT = `${API_BASE_URL}/api/v1/inspect`;
