import { getSupabase } from '../../utils/supabase';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    await supabase
        .from('user_integrations')
        .delete()
        .eq('user_id', user.id)
        .eq('provider', 'garmin');

    res.status(200).json({ success: true });
}
