import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { zone, epidemy } = body;

        // Limitation à ~160 caractères (Taille standard d'un SMS)
        let message = `INFO KENEYA: Alerte ${epidemy || 'sanitaire'} signalée - ${zone === 'all' ? 'Abidjan' : zone}. `;

        if (epidemy.toLowerCase().includes('dengue')) {
            message += "Risque sévère. Détruisez les gîtes larvaires (eaux stagnantes) et consultez le centre de santé le plus proche en cas de forte fièvre.";
        } else if (epidemy.toLowerCase().includes('méningite') || epidemy.toLowerCase().includes('meningite')) {
            message += "Extrêmement contagieux. Evitez la promiscuité. Raideur de la nuque, vomissements ou fièvre? RDV urgent à l'hôpital.";
        } else if (epidemy.toLowerCase().includes('choléra') || epidemy.toLowerCase().includes('cholera')) {
            message += "Danger de contamination liée à l'eau. Lavez-vous les mains au savon et buvez uniquement de l'eau traitée/bouillie.";
        } else if (epidemy.toLowerCase().includes('covid')) {
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
