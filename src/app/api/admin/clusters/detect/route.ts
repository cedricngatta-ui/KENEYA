import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST() {
    try {
        const supabaseAdmin = getSupabaseAdmin();
        // 1. Récupération du seuil de configuration
        const { data: configData } = await supabaseAdmin
            .from('system_config')
            .select('value')
            .eq('key', 'alert_threshold')
            .single();

        const threshold = configData ? parseInt((configData as any).value) : 5;

        // 2. Récupération des rapports des dernières 48 heures
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

        const { data: reports, error: reportsError } = await supabaseAdmin
            .from('reports')
            .select('geo_cell, symptoms, created_at')
            .gte('created_at', fortyEightHoursAgo);

        if (reportsError) throw reportsError;
        if (!reports || reports.length === 0) {
            return NextResponse.json({ message: 'Aucun signalement récent à analyser.', analyzed: 0, clustersCreated: 0 });
        }

        // 3. Logique de Clustering : Groupement par ZONE et SYNDROME
        // Structure : { "Abobo": { "Fièvre": count, "Digestif": count } }
        const clustersMap: Record<string, Record<string, number>> = {};

        reports.forEach(report => {
            const zone = report.geo_cell || 'Inconnue';
            const symptoms = Array.isArray(report.symptoms) ? report.symptoms : [report.symptoms];

            if (!clustersMap[zone]) clustersMap[zone] = {};

            symptoms.forEach((s: any) => {
                if (typeof s === 'string') {
                    clustersMap[zone][s] = (clustersMap[zone][s] || 0) + 1;
                }
            });
        });

        // 4. Identification et Upsert des Clusters critiques
        let clustersCreated = 0;
        const results = [];

        for (const [zone, syndromes] of Object.entries(clustersMap)) {
            for (const [syndrome, count] of Object.entries(syndromes)) {
                if (count >= threshold) {
                    // Vérifier si un cluster actif existe déjà
                    const { data: existingCluster } = await supabaseAdmin
                        .from('clusters')
                        .select('id')
                        .eq('geo_cell', zone)
                        .eq('syndrome', syndrome)
                        .eq('status', 'active')
                        .single();

                    if (existingCluster) {
                        // Update score
                        await supabaseAdmin
                            .from('clusters')
                            .update({
                                score: count,
                                updated_at: new Date().toISOString(),
                                time_window: 'Dernières 48h'
                            })
                            .eq('id', existingCluster.id);
                    } else {
                        // Création
                        await supabaseAdmin
                            .from('clusters')
                            .insert({
                                geo_cell: zone,
                                syndrome: syndrome,
                                score: count,
                                status: 'active',
                                time_window: 'Dernières 48h'
                            });
                        clustersCreated++;
                    }
                    results.push({ zone, syndrome, count });
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Analyse terminée avec succès.',
            analyzedCount: reports.length,
            clustersCreated,
            foundCriticity: results.length,
            details: results
        });

    } catch (error: any) {
        console.error('Clustering Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
