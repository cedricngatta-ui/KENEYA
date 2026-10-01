import { NextResponse } from 'next/server';
import { OfficialDataService } from '@/services/OfficialDataService';
import { createClient } from '@supabase/supabase-js';


// Maladies par défaut (mêmes que supabase/create_diseases_table.sql).
// Utilisées en mode démo sans Supabase, ou si la table est vide / non lisible (RLS).
const DEFAULT_DISEASES = [
    { name: 'Urgence vitale', keywords: ['respirer', 'étouffe', 'inconscient', 'évanoui', 'convulsion'], severity_level: 'rouge' },
    { name: 'Choléra', keywords: ['digestif', 'diarrhée', 'eau de riz', 'vomissement', 'vomis', 'déshydratation', 'soif'], severity_level: 'rouge' },
    { name: 'Mpox / Variole', keywords: ['eruptif', 'bouton', 'éruption', 'peau', 'rash', 'rougeole', 'ganglion'], severity_level: 'rouge' },
    { name: 'Fièvre Lassa', keywords: ['saigne', 'sang', 'fièvre forte', 'yeux rouges'], severity_level: 'rouge' },
    { name: 'Méningite', keywords: ['nuque', 'raideur'], severity_level: 'rouge' },
    { name: 'Paludisme Sévère', keywords: ['palu', 'moustique', 'chaud', 'grelotte', 'frisson', 'anémie'], severity_level: 'jaune' },
    { name: 'Dengue', keywords: ['douleur', 'articulation', 'fièvre', 'tête'], severity_level: 'jaune' },
    { name: 'Infection respiratoire', keywords: ['toux', 'tousse', 'rhume', 'gorge'], severity_level: 'jaune' },
];

// Minuscules sans accents : "fievre" (envoyé par /signaler) doit matcher "fièvre"
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Type attendu du Frontend
interface TriageRequest {
    transcript: string; // Ce que l'utilisateur a dit (ex: "J'ai mal à la tête et je vomis du sang")
    language?: string;  // Langue détectée ou choisie (ex: "fr-FR" ou "dioula")
}

interface TriageResponse {
    diagnosis: 'safe' | 'warning' | 'danger'; // Vert, Jaune, Rouge
    syndrome: 'digestif' | 'moustiques' | 'hemorragique' | 'respiratoire' | 'neurologique' | 'rash' | 'unknown';
    suspectedIllness: string;
    confidence: number;
    reasoning: string;
    instructions: string[];
    targetHospital?: string;
    officialAlertMatch?: any; // Information sur une alerte officielle correspondante
}

export async function POST(req: Request) {
    try {
        const body: TriageRequest = await req.json();
        if (typeof body?.transcript !== 'string' || !body.transcript.trim()) {
            return NextResponse.json({ error: 'Description des symptômes requise.' }, { status: 400 });
        }
        const text = normalize(body.transcript);

        // 1. Detection du syndrome et de la gravité selon les mots-clés de la Base de Données
        let syndrome: TriageResponse['syndrome'] = 'unknown';
        let diagnosis: TriageResponse['diagnosis'] = 'safe';
        let illness = "Alarme non identifiée";
        let reasoning = "Symptômes non spécifiques nécessitant une évaluation standard.";
        let instructions: string[] = ["Reposez-vous et hydratez-vous.", "Consultez si les symptômes persistent après 48h."];
        let hospital = undefined;

        // Récupération dynamique depuis la BDD si configurée
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        let dbDiseases: any[] | null = null;

        if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
            try {
                const supabase = createClient(supabaseUrl, supabaseAnonKey);
                const { data } = await supabase.from('diseases').select('*');
                dbDiseases = data;
            } catch (err) {
                console.warn("DB diseases fetch skipped:", err);
            }
        }

        const diseases = dbDiseases && dbDiseases.length > 0 ? dbDiseases : DEFAULT_DISEASES;
        // Trie par sévérité pour que les urgences ROUGES priment
        const sortedDiseases = [...diseases].sort((a: any, b: any) => {
            if (a.severity_level === 'rouge' && b.severity_level !== 'rouge') return -1;
            if (b.severity_level === 'rouge' && a.severity_level !== 'rouge') return 1;
            return 0;
        });

        for (const disease of sortedDiseases) {
            const keywords: string[] = Array.isArray(disease.keywords) ? disease.keywords : [];
            // Cherche si un des mots clés de la maladie est dans la transcription
            const hasMatch = keywords.some((keyword: string) => text.includes(normalize(keyword)));

            if (hasMatch) {
                illness = disease.name;
                syndrome = 'unknown'; // Pourrait être enrichi dans la DB

                if (disease.severity_level === 'rouge') {
                    diagnosis = 'danger';
                    reasoning = `Détection d'un mot-clé critique associé à : ${disease.name}.`;
                    instructions = ["URGENCE ABSOLUE : Rendez-vous à l'hôpital immédiatement", "Évitez les contacts étroits"];
                } else if (disease.severity_level === 'jaune') {
                    diagnosis = 'warning';
                    reasoning = `Symptôme suspect correspondant à : ${disease.name}.`;
                    instructions = ["Consultez un centre de santé dans les 24h", "Surveillez l'évolution"];
                } else {
                    diagnosis = 'safe';
                    instructions = ["Repos recommandé"];
                }

                break; // On s'arrête à la maladie la plus grave trouvée
            }
        }

        // 2. Comparaison avec les sources officielles (MSHPCMU / INHP)
        const zoneSimulee = "Abidjan"; // En production, utiliser la géolocalisation
        const officialMatch = await OfficialDataService.checkAlertMatch(illness, zoneSimulee);

        let confidence = 0.90;
        if (officialMatch) {
            confidence = 0.98; // On augmente la confiance car le ministère signale déjà cela
            reasoning += ` MATCH OFFICIEL : Cette zone est sous alerte ${officialMatch.source} pour ${officialMatch.disease}.`;
        }

        const mockResponse: TriageResponse = {
            diagnosis,
            syndrome,
            suspectedIllness: illness,
            confidence,
            reasoning: reasoning || `Classification basée sur les symptômes : ${syndrome}.`,
            instructions,
            targetHospital: hospital,
            officialAlertMatch: officialMatch
        };

        return NextResponse.json(mockResponse);

    } catch (error) {
        console.error("Erreur Triage API:", error);
        return NextResponse.json(
            { error: "Erreur lors de l'analyse IA du symptôme." },
            { status: 500 }
        );
    }
}
