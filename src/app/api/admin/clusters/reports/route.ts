import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: Request) {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { searchParams } = new URL(req.url);
        const zone = searchParams.get('zone');
        const syndrome = searchParams.get('syndrome');

        if (!zone || !syndrome) {
            return NextResponse.json({ error: 'Zone et Syndrome requis' }, { status: 400 });
        }

        // Récupération des rapports des dernières 72 heures pour ce cluster
        const slidingWindow = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

        const { data: reports, error } = await supabaseAdmin
            .from('reports')
            .select('id, patient_name, patient_phone, symptoms, created_at, severity, suspected_illness')
            .eq('geo_cell', zone)
            .contains('symptoms', [syndrome])
            .gte('created_at', slidingWindow)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({
            success: true,
            count: reports?.length || 0,
            reports: reports || []
        });

    } catch (error: any) {
        console.error('Error fetching cluster reports:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
