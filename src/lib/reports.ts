import { createClient } from '@/lib/supabase/client';

const DEMO_STORAGE_KEY = 'keneya_demo_reports';

/**
 * Vrai si une vraie instance Supabase est configurée.
 * Sans Supabase, l'app tourne en mode démo (signalements gardés dans le navigateur).
 */
export function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return !!url && !!key && !url.includes('placeholder') && !url.includes('your_supabase');
}

/**
 * Enregistre un signalement. Ne lève jamais d'erreur : un échec de sauvegarde
 * ne doit pas bloquer le parcours vocal du citoyen.
 */
export async function saveReport(payload: Record<string, unknown>): Promise<void> {
    if (!isSupabaseConfigured()) {
        try {
            const existing = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || '[]');
            existing.push({ ...payload, created_at: new Date().toISOString() });
            localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(existing.slice(-50)));
        } catch {
            // Stockage indisponible (navigation privée...) : on ignore en démo
        }
        return;
    }

    try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('reports') as any).insert(payload);
        if (error) console.error('Enregistrement du signalement échoué:', error);
    } catch (err) {
        console.error('Enregistrement du signalement échoué:', err);
    }
}
