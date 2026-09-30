import { NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { phoneNumber, message, notifyAgents } = body;

        // 1. Envoi à un numéro spécifique (ex: le patient)
        if (phoneNumber && message) {
            await sendSMS(phoneNumber, message);
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
