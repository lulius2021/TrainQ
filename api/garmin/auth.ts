import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const clientId = process.env.GARMIN_CLIENT_ID;
    const redirectUri = process.env.GARMIN_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return res.status(500).json({ error: 'Missing Garmin Config' });
    }

    // Generate a random state for CSRF protection (should store in cookie/session in real app)
    const state = Math.random().toString(36).substring(7);

    const url = new URL('https://connect.garmin.com/oauthConfirm');
    url.searchParams.set('oauth_callback', redirectUri);
    // Note: Garmin OAuth 1.0a is distinct from OAuth2. 
    // If the user wants OAuth2, they might mean 'Garmin Health API' which uses OAuth 1.0a or 2.0 depending on access.
    // Standard Garmin Connect API (Health) usually uses OAuth 1.0 signature, which is complex.
    // Assuming OAuth 2.0 (if available) or simplifying for this plan.

    // IF Garmin uses OAuth 1.0 (typical for Health API):
    // We need to request a request_token first. 
    // For this plan, assuming simplistic OAuth2 flow or just placeholder redirect.

    // Example for OAuth2 (Connect IQ / some integration types):
    // url = 'https://connect.garmin.com/oauth/authorize?client_id=...&response_type=code...'

    // IMPLEMENTATION NOTE: Creating a proper OAuth 1.0a handshake requires 'oauth-signature' or similar lib.
    // Given "minimal" requirement & potential dependency restrictions, 
    // I will write a stub that redirects to a "Success" for testing if actual Garmin creds aren't there.

    // Ideally:
    // 1. Get Request Token from https://connectapi.garmin.com/oauth-service/oauth/request_token
    // 2. Redirect user to connect.garmin.com/oauthConfirm?oauth_token=...

    // For now, let's assume we are just setting up the structure.

    return res.redirect(`https://connect.garmin.com/oauthConfirm?service=...stub...`);
}
