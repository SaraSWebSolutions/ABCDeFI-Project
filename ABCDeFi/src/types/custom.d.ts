declare module '@env' {
  export const BASE_URL: string;
  export const API_TIMEOUT: string;
}

declare module '@react-native-async-storage/async-storage' {
  interface AsyncStorageStatic {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
  }

  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}

declare module '@abcdefi/oneq-unified-manifest' { const manifest: unknown; export default manifest; }
declare module '@abcdefi/oneq-root-manifest' { const manifest: unknown; export default manifest; }
declare module '@abcdefi/oneq-ico-manifest' { const manifest: unknown; export default manifest; }
declare module '@abcdefi/oneq-lending-manifest' { const manifest: unknown; export default manifest; }
declare module '@abcdefi/oneq-legion-manifest' { const manifest: unknown; export default manifest; }
declare module '@abcdefi/oneq-franchise-manifest' { const manifest: unknown; export default manifest; }
declare module '@abcdefi/oneq-marketplace10A-manifest' { const manifest: unknown; export default manifest; }
declare module '@abcdefi/oneq-marketplace10B-manifest' { const manifest: unknown; export default manifest; }
