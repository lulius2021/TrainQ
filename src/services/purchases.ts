// src/services/purchases.ts
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE, type Product, type Transaction } from "@capgo/native-purchases";
import { setActiveSession } from "../utils/session";

export type SubscriptionPlan = "monthly" | "yearly";

const MONTHLY_ID = import.meta.env.VITE_IAP_MONTHLY_ID || "trainq.pro.monthly";
const YEARLY_ID = import.meta.env.VITE_IAP_YEARLY_ID || "trainq.pro.yearly";

const ANDROID_MONTHLY_PLAN_ID = import.meta.env.VITE_IAP_ANDROID_MONTHLY_PLAN_ID;
const ANDROID_YEARLY_PLAN_ID = import.meta.env.VITE_IAP_ANDROID_YEARLY_PLAN_ID;

const SUB_IDS = [MONTHLY_ID, YEARLY_ID].filter(Boolean);

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function isActiveSubscription(tx: Transaction): boolean {
  if (tx.productType !== "subs") return false;
  if (!SUB_IDS.includes(tx.productIdentifier)) return false;

  if (typeof tx.isActive === "boolean") return tx.isActive;
  if (typeof tx.purchaseState === "string") {
    const state = tx.purchaseState.toLowerCase();
    return state === "1" || state === "purchased";
  }

  return false;
}

export async function isBillingSupported(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    return !!isBillingSupported;
  } catch {
    return false;
  }
}

export async function getSubscriptionProducts(): Promise<Product[]> {
  if (!isNative()) return [];
  if (!SUB_IDS.length) return [];
  const supported = await isBillingSupported();
  if (!supported) return [];

  const { products } = await NativePurchases.getProducts({
    productIdentifiers: SUB_IDS,
    productType: PURCHASE_TYPE.SUBS,
  });

  return products ?? [];
}

export async function purchaseSubscription(plan: SubscriptionPlan): Promise<Transaction> {
  if (!isNative()) {
    throw new Error("In-App-Käufe sind nur auf Geräten verfügbar.");
  }

  const supported = await isBillingSupported();
  if (!supported) throw new Error("Billing wird auf diesem Gerät nicht unterstützt.");

  const productIdentifier = plan === "yearly" ? YEARLY_ID : MONTHLY_ID;
  if (!productIdentifier) throw new Error("Produkt-ID fehlt. Bitte Store-IDs konfigurieren.");

  const platform = Capacitor.getPlatform();
  const planIdentifier =
    platform === "android"
      ? plan === "yearly"
        ? ANDROID_YEARLY_PLAN_ID
        : ANDROID_MONTHLY_PLAN_ID
      : undefined;

  return NativePurchases.purchaseProduct({
    productIdentifier,
    planIdentifier,
    productType: PURCHASE_TYPE.SUBS,
    quantity: 1,
  });
}

export async function refreshProStatus(): Promise<boolean> {
  if (!isNative()) return false;
  const supported = await isBillingSupported();
  if (!supported) return false;

  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
  });

  return (purchases ?? []).some((tx) => isActiveSubscription(tx));
}

export async function restorePurchases(): Promise<boolean> {
  if (!isNative()) return false;
  const supported = await isBillingSupported();
  if (!supported) return false;

  await NativePurchases.restorePurchases();
  return refreshProStatus();
}

export async function syncProToSession(user: { id: string; email?: string }): Promise<boolean> {
  const isPro = await refreshProStatus();
  setActiveSession({ userId: user.id, isPro, email: user.email });
  return isPro;
}
