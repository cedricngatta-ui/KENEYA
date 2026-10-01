import { NextResponse } from 'next/server';
import { requireRole, ALL_PRO_ROLES } from '@/lib/auth/requireRole';


export async function POST(req: Request) {
    try {
        const auth = await requireRole(ALL_PRO_ROLES);
        if (!auth.ok) return auth.response;

        const body = await req.json();
        const { zone } = body;
        const epidemy: string = typeof body.epidemy === 'string' ? body.epidemy : '';
        const lower = epidemy.toLowerCase();

        // Limitation à ~160 caractères (Taille standard d'un SMS)
        let message = `INFO KENEYA: Alerte ${epidemy || 'sanitaire'} signalée - ${!zone || zone === 'all' ? 'Abidjan' : zone}. `;

        if (lower.includes('dengue')) {
            message += "Risque sévère. Détruisez les gîtes larvaires (eaux stagnantes) et consultez le centre de santé le plus proche en cas de forte fièvre.";
        } else if (lower.includes('méningite') || lower.includes('meningite')) {
            message += "Extrêmement contagieux. Evitez la promiscuité. Raideur de la nuque, vomissements ou fièvre? RDV urgent à l'hôpital.";
        } else if (lower.includes('choléra') || lower.includes('cholera')) {
            message += "Danger de contamination liée à l'eau. Lavez-vous les mains au savon et buvez uniquement de l'eau traitée/bouillie.";
        } else if (lower.includes('covid')) {
            message += "Nouveau pic détecté. Port du masque recommandé dans les lieux clos. Toux/fièvre: isolez-vous et consultez.";
        } else {
            message += "Vigilance requise. Appliquez les mesures barrières d'hygiène et rapprochez-vous d'un agent de santé au besoin.";
        }

        // Bloquer strictement à 170 caractères
        if (message.length > 170) {
            // On coupe proprement en ajoutant des points de suspension
            message = message.substring(0, 167) + "...";
        }

        return NextResponse.json({ message });

    } catch (error) {
        console.error("Erreur génération message d'alerte IA:", error);
        return NextResponse.json({ error: "Erreur lors de la génération" }, { status: 500 });
    }
}
