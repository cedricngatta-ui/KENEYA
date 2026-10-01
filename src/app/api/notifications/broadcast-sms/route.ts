import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/sms';
import { requireRole, ALL_PRO_ROLES } from '@/lib/auth/requireRole';


export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALL_PRO_ROLES);
        if (!auth.ok) return auth.response;

        const body = await req.json();
        const { zone, message, specificNumbers } = body;

        if (!message || (!zone && !specificNumbers)) {
            return NextResponse.json({ error: "Message ou cible manquants." }, { status: 400 });
        }

        const supabase = await createClient();

        let targetPhones: string[] = [];

        if (typeof specificNumbers === 'string' && specificNumbers.trim() !== '') {
            // Bypass Base de Données : on utilise les numéros saisis par le frontend
            targetPhones = specificNumbers
                .split(',')
                .map((n: string) => n.trim().replace(/\D/g, '')) // On nettoie les espaces et caractères non-digit
                .filter((n: string) => n.length >= 8); // Longueur minimale d'un numéro pour éviter les vide

            console.log(`[Bypass BDD] Envoi ciblé manuel aux numéros: ${targetPhones}`);
        } else {
            // Fonctionnement normal : récupération DB
            let query = supabase.from('reports').select('patient_phone, geo_cell').not('patient_phone', 'is', null);
            const { data: reports, error: reportsError } = await query;

            if (reportsError) {
                console.error("Erreur Supabase:", reportsError);
                return NextResponse.json({ error: "Erreur BDD" }, { status: 500 });
            }

            const phoneSet = new Set<string>();

            if (reports) {
                reports.forEach((r: any) => {
                    const z = (r.geo_cell || 'Inconnu').replace('Abidjan-', '');
                    if (zone === 'all' || z === zone) {
                        if (r.patient_phone && r.patient_phone.length >= 8) {
                            phoneSet.add(r.patient_phone);
                        }
                    }
                });
            }

            targetPhones = Array.from(phoneSet);
            console.log(`Préparation de l'envoi de SMS à ${targetPhones.length} numéros pour la zone ${zone}`);
        }

        let errorCount = 0;
        let successCount = 0;

        // 3. Boucle d'envoi
        for (const phone of targetPhones) {
            let personalizedMessage = message;

            // Personnalisation spéciale pour Mr Marc (le numéro de test)
            if (phone === '0104617601' || phone === '+2250104617601' || phone === '2250104617601') {
                personalizedMessage = `Bonjour Mr Marc. ${message}`;
            }

            // On utilise la fonction partagée qui gère très bien HSMS.CI 
            const result = await sendSMS(phone, personalizedMessage);
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
                console.error(`Echec d'envoi au ${phone}:`, result.error);
            }
        }

        // 4. Trace dans la base de données
        await (supabase as any).from('broadcasts').insert({
            channel: 'sms',
            zone: zone,
            message: message,
            sent_by: auth.user.id,
        });

        return NextResponse.json({
            success: true,
            sent: successCount,
            failed: errorCount,
            totalTargets: targetPhones.length
        });

    } catch (error) {
        console.error("Erreur API broadcast SMS :", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
