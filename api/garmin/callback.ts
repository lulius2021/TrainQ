import { getSupabase } from '../../utils/supabase';

// Helper for OAuth 1.0 (stub)
// In reality, use 'oauth-1.0a' or 'passport-garmin'
async function exchangeToken(oauthVerifier: string, oauthToken: string) {
    // Stub implementation
    return {
        oauth_token: "mock_token_" + Math.random(),
        oauth_token_secret: "mock_secret_" + Math.random()
    };
}

export default async function handler(req: any, res: any) {
    const { oauth_verifier, oauth_token } = req.query;

    if (!oauth_verifier || !oauth_token) {
        return res.status(400).json({ error: 'Missing oauth_verifier or oauth_token' });
    }

    try {
        const tokens = await exchangeToken(oauth_verifier, oauth_token);

        // We need to identify the user. 
        // Ideally, the user session cookie is sent to this endpoint if on same domain.
        // Or we pass a 'state' param that contains an encrypted userId.
        // For this implementations, assume we have a way to get userId (e.g. from state).
        const userId = "stub_user_id"; // Replace with actual extraction logic

        const supabase = getSupabase();

        await supabase.from('user_integrations').upsert({
            user_id: userId,
            provider: 'garmin',
            access_token: tokens.oauth_token,
            token_secret: tokens.oauth_token_secret,
            updated_at: new Date()
        });

        // Redirect back to settings with success param
        res.redirect('/?settings=integrations&status=success');

    } catch (error) {
        console.error(error);
        res.redirect('/?settings=integrations&status=error');
    }
}
