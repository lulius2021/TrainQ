import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const clientId = process.env.GARMIN_CLIENT_ID;
    const redirectUri = process.env.GARMIN_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return res.status(500).json({ error: 'Missing Garmin Config' });
    }

    // Extract user ID from Authorization header before starting OAuth flow
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Cryptographically secure state token for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Store state in HttpOnly cookie (10 min TTL)
    res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=600`);

    // NOTE: Garmin Connect uses OAuth 1.0a. A real implementation requires:
    // 1. Request a request_token from connectapi.garmin.com/oauth-service/oauth/request_token
    // 2. Redirect user to connect.garmin.com/oauthConfirm?oauth_token=<request_token>
    // The state param below is for CSRF; pass it via the oauth_callback URL as a query param.
    const callbackWithState = `${redirectUri}?state=${state}`;
    const url = new URL('https://connect.garmin.com/oauthConfirm');
    url.searchParams.set('oauth_callback', callbackWithState);

    return res.redirect(url.toString());
}
