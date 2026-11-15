/**
 * Laptop detection server on the local Wi‑Fi.
 * Update HOST if your PC IP changes (`ipconfig`).
 */
export const DETECTION_SERVER_HOST = '192.168.1.10'; 
export const DETECTION_SERVER_PORT = 8765;
export const DETECTION_SERVER_URL = `http://${DETECTION_SERVER_HOST}:${DETECTION_SERVER_PORT}`;

export const FRAME_UPLOAD_INTERVAL_MS = 700;
