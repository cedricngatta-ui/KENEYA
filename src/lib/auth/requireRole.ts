import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export type ProRole = 'admin' | 'health_center' | 'community_agent' | 'district' | 'city_hall';

export const ALL_PRO_ROLES: ProRole[] = ['admin', 'health_center', 'community_agent', 'district', 'city_hall'];

/**
 * Vérifie que l'appelant d'une route API est connecté et possède un des rôles autorisés.
 * Le proxy n'intercepte pas /api, donc chaque route sensible doit appeler ce garde.
 */
export async function requireRole(allowed: ProRole[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { ok: false as const, response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
    }

    const { data } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    const role = (data as { role?: string } | null)?.role as ProRole | undefined;

    if (!role || !allowed.includes(role)) {
        return { ok: false as const, response: NextResponse.json({ error: 'Accès refusé' }, { status: 403 }) };
    }

    return { ok: true as const, user, role, supabase };
}
