/**
 * Laptop detection server; HOST may be its Wi-Fi or Tailscale IPv4 address.
 */
export const DETECTION_SERVER_HOST = '100.116.96.67';
export const DETECTION_SERVER_PORT = 8765;
export const DETECTION_SERVER_URL = `http://${DETECTION_SERVER_HOST}:${DETECTION_SERVER_PORT}`;

export const FRAME_UPLOAD_INTERVAL_MS = 700;
