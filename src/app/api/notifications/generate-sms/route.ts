import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { patientName, gender, symptoms, severity, hospitalName, language } = body;

        // Simulation de génération IA par templates dynamiques
        // En production, on pourrait appeler un modèle LLM ici.

        const title = gender === 'M' ? 'Mr' : (gender === 'F' ? 'Mme' : '');
        const name = patientName || 'Patient';
        const greeting = `Bonjour ${title} ${name}, ici l'équipe Keneya Santé.`;

        let message = "";

        if (severity === 'rouge') {
            message = `${greeting} Vos symptômes (${symptoms}) indiquent une urgence. Un médecin du ${hospitalName || 'CHU'} vous attend immédiatement. Ne restez pas seul. Une équipe mobile est en route.`;
        } else if (severity === 'jaune') {
            message = `${greeting} Suite à vos symptômes de ${symptoms}, nous vous recommandons une consultation au ${hospitalName || 'centre de santé'} dans les 6 heures. Surveillez votre température.`;
        } else {
            message = `${greeting} Vos symptômes semblent stables. Reposez-vous et hydratez-vous. En cas de doute, rappelez le service ou rendez-vous au ${hospitalName || 'centre de santé'}.`;
        }

        return NextResponse.json({ message });

    } catch (error) {
        console.error("Erreur génération SMS IA:", error);
        return NextResponse.json({ error: "Erreur génération" }, { status: 500 });
    }
}
