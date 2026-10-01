import { NextResponse } from 'next/server';


export async function POST(req: Request) {
    try {
        const { text, voiceId = 'pNInz6obpgnuM07kgL4L' } = await req.json(); // Adam voice by default

        // Limite la taille pour éviter les abus de quota ElevenLabs
        if (typeof text !== 'string' || !text.trim() || text.length > 1000) {
            return NextResponse.json({ error: "Texte invalide (1 à 1000 caractères)" }, { status: 400 });
        }
        if (typeof voiceId !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(voiceId)) {
            return NextResponse.json({ error: "voiceId invalide" }, { status: 400 });
        }

        const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

        if (!ELEVENLABS_API_KEY) {
            return NextResponse.json({ error: "API Key missing" }, { status: 500 });
        }

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("ElevenLabs Error:", response.status, error);
            throw new Error('ElevenLabs API failed');
        }

        const arrayBuffer = await response.arrayBuffer();

        return new Response(arrayBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
            },
        });

    } catch (error) {
        console.error("TTS Route Error:", error);
        return NextResponse.json({ error: "Failed to generate speech" }, { status: 500 });
    }
}
