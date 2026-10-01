import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { createClient } from '@/lib/supabase/server';
import { requireRole, ALL_PRO_ROLES } from '@/lib/auth/requireRole';


export async function POST(request: Request) {
    try {
        const auth = await requireRole(ALL_PRO_ROLES);
        if (!auth.ok) return auth.response;

        const body = await request.json();
        const { phoneNumber, message, notifyAgents } = body;

        // 1. Envoi à un numéro spécifique (ex: le patient)
        if (phoneNumber && message) {
            const result = await sendSMS(phoneNumber, message);
            if (!result.success) {
                return NextResponse.json({ error: "Échec d'envoi du SMS au patient." }, { status: 502 });
            }
        }

        // 2. Envoi aux agents sélectionnés (Admins et Agents de terrain)
        if (notifyAgents && message) {
            const supabase = await createClient();
            const { data: agents } = await supabase
                .from('users')
                .select('phone')
                .in('role', ['admin', 'community_agent', 'health_center']) as { data: { phone: string | null }[] | null };

            if (agents && agents.length > 0) {
                // Envoi asynchrone à tous les agents trouvés
                const alertMessage = `ALERTE SYSTÈME : ${message}`;
                await Promise.all(
                    agents
                        .filter(a => a.phone)
                        .map(a => sendSMS(a.phone!, alertMessage))
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur API Route SMS:", error);
        return NextResponse.json(
            { error: "Erreur interne du serveur lors de l'envoi du SMS." },
            { status: 500 }
        );
    }
}
