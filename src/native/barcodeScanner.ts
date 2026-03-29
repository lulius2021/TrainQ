import { Capacitor, registerPlugin } from "@capacitor/core";

interface BarcodePluginInterface {
  scan(): Promise<{ barcode: string | null }>;
}

const BarcodePlugin = registerPlugin<BarcodePluginInterface>("BarcodePlugin");

const isNativeIOS =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

/**
 * Scan a barcode using the native camera (iOS only).
 * Returns the scanned barcode string, or null if cancelled/unavailable.
 */
export async function scanBarcode(): Promise<string | null> {
  if (!isNativeIOS) return null;

  try {
    const result = await BarcodePlugin.scan();
    return result.barcode ?? null;
  } catch {
    return null;
  }
}
