export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextResponse } from 'next/server';

// TOKEN à configurer via les variables d'environnement
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Logique de base pour répondre aux messages
        if (body.message) {
            const chatId = body.message.chat.id;
            const text = body.message.text;
            const voice = body.message.voice;

            if (text === '/start') {
                await sendTelegramMessage(chatId, "Bôni (Bonjour) ! Je suis Keneya, votre assistant santé intelligent d'Abidjan. 🇨🇮\n\nEnvoyez-moi un message vocal pour décrire vos symptômes ou cliquez sur le lien ci-dessous pour un signalement complet avec mesures biométriques :\n\n🔗 https://alerte-sante-abidjan.vercel.app/signaler");
            } else if (voice) {
                await sendTelegramMessage(chatId, "J'ai bien reçu votre message vocal. Je l'analyse immédiatement avec mon intelligence médicale... 🩺");
                // TODO: Intégrer Whisper/Gemini pour transcrire et Claude pour le triage
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Telegram Webhook Error:", error);
        return NextResponse.json({ ok: false, error: "Webhook process failed" }, { status: 500 });
    }
}

async function sendTelegramMessage(chatId: number, text: string) {
    if (!TELEGRAM_TOKEN) return;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        })
    });
}
