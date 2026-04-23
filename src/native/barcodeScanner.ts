import { Capacitor, registerPlugin } from "@capacitor/core";

interface BarcodePluginInterface {
  scan(): Promise<{ barcode: string | null }>;
}

const BarcodePlugin = registerPlugin<BarcodePluginInterface>("BarcodePlugin");

/**
 * Scan a barcode using the native camera (iOS only).
 * Returns the scanned barcode string, or null if the user cancelled.
 * Throws if camera is unavailable or another error occurs.
 */
export async function scanBarcode(): Promise<string | null> {
  // Check at call-time, not module-load (Capacitor may not be ready at import)
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return null;
  }

  const result = await BarcodePlugin.scan();
  return result.barcode ?? null;
}
