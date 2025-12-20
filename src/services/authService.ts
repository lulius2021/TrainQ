// src/service/authService.ts

export type AuthProviderId = "google" | "apple" | "facebook";

export interface AuthUser {
  id: string;
  email: string;
}

export const authService = {
  async loginWithEmail(email: string, password: string): Promise<AuthUser> {
    // TODO: Später durch echtes Backend/Firebase ersetzen
    console.log("loginWithEmail", { email, password });
    return { id: "demo-user", email };
  },

  async registerWithEmail(email: string, password: string): Promise<AuthUser> {
    console.log("registerWithEmail", { email, password });
    return { id: "demo-user", email };
  },

  async loginWithProvider(provider: AuthProviderId): Promise<AuthUser> {
    console.log("loginWithProvider", { provider });
    return { id: `demo-${provider}-user`, email: `${provider}@demo.com` };
  },

  async resetPassword(email: string): Promise<void> {
    console.log("resetPassword", { email });
  },

  async logout(): Promise<void> {
    console.log("logout");
  },
};
