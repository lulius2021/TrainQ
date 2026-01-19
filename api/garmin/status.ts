import { getSupabase } from '../../utils/supabase';

export default async function handler(req: any, res: any) {
    // Check user authentication
    // secure this endpoint!
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate JWT (Supabase)
    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { data } = await supabase
        .from('user_integrations')
        .select('provider')
        .eq('user_id', user.id)
        .eq('provider', 'garmin')
        .single();

    res.status(200).json({ connected: !!data });
}
