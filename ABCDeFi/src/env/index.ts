const metaEnv: Record<string, string | undefined> = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env : {};
const runtimeEnv: Record<string, string | undefined> = typeof globalThis !== 'undefined' && typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env ? (globalThis as any).process.env : {};

const getEnv = (key: string, fallback = ''): string => {
  const value = metaEnv[key] ?? runtimeEnv[key] ?? fallback;
  return value ?? fallback;
};

export const BASE_URL: string = getEnv('VITE_BASE_URL', getEnv('BASE_URL', 'http://localhost:5000'));
export const API_TIMEOUT: number = Number(getEnv('VITE_API_TIMEOUT', getEnv('API_TIMEOUT', '5000')));
export const IMAGE_URL: string = getEnv('VITE_IMAGE_URL', getEnv('IMAGE_URL', ''));
export const THIRDWEB_CLIENT_ID: string = getEnv('VITE_THIRDWEB_CLIENT_ID', getEnv('THIRDWEB_CLIENT_ID', ''));
export const GOOGLE_CLIENT_ID: string = getEnv('VITE_GOOGLE_CLIENT_ID', getEnv('GOOGLE_CLIENT_ID', ''));
