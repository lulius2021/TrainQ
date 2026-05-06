import { getSupabase } from '../../utils/supabase';

// Parses a single cookie value from the Cookie header
function parseCookie(cookieHeader: string, name: string): string | undefined {
    return cookieHeader
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith(`${name}=`))
        ?.split('=')[1];
}

export default async function handler(req: any, res: any) {
    const { oauth_verifier, oauth_token, state: receivedState } = req.query;

    if (!oauth_verifier || !oauth_token) {
        return res.status(400).json({ error: 'Missing oauth_verifier or oauth_token' });
    }

    // Validate CSRF state parameter against HttpOnly cookie
    const cookieHeader = req.headers.cookie || '';
    const expectedState = parseCookie(cookieHeader, 'oauth_state');

    if (!expectedState || !receivedState || expectedState !== receivedState) {
        return res.status(403).json({ error: 'Invalid state parameter – possible CSRF attack' });
    }

    // Clear the state cookie immediately after validation
    res.setHeader('Set-Cookie', 'oauth_state=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');

    // Extract user from Authorization header / Supabase session
    // The frontend must pass the user's JWT when initiating the OAuth flow.
    // Since serverless callbacks can't carry browser cookies from another origin,
    // the recommended pattern is to store a {state -> userId} mapping server-side
    // (e.g. Supabase DB or KV store) during the auth.ts step and look it up here.
    // This stub returns an error until that mapping is implemented.
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized – user session required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabase();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
        return res.status(401).json({ error: 'Invalid or expired user token' });
    }

    try {
        // NOTE: Real Garmin OAuth 1.0a token exchange requires 'oauth-1.0a' library.
        // Replace exchangeToken with a proper implementation before going to production.
        const tokens = await exchangeToken(String(oauth_verifier), String(oauth_token));

        const { error: upsertError } = await supabase.from('user_integrations').upsert({
            user_id: user.id,
            provider: 'garmin',
            access_token: tokens.oauth_token,
            token_secret: tokens.oauth_token_secret,
            updated_at: new Date()
        });

        if (upsertError) {
            console.error('Failed to store Garmin tokens:', upsertError);
            return res.redirect('/?settings=integrations&status=error');
        }

        res.redirect('/?settings=integrations&status=success');

    } catch (error) {
        console.error(error);
        res.redirect('/?settings=integrations&status=error');
    }
}

// Stub: replace with real OAuth 1.0a exchange via 'oauth-1.0a' package
async function exchangeToken(_oauthVerifier: string, _oauthToken: string) {
    throw new Error('Garmin OAuth token exchange is not yet implemented');
    // Return shape: { oauth_token: string; oauth_token_secret: string }
}
