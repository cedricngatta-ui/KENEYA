'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Shield, ChevronLeft, Fingerprint, Activity, User, Phone, CheckCircle2, Volume2, Mic } from 'lucide-react';
import Link from 'next/link';
import BioScanner from '@/components/dashboard/BioScanner';
import { saveReport } from '@/lib/reports';
import { extractContact } from '@/lib/voice';
import { useLanguage } from '@/components/providers/LanguageProvider';

export default function TriagePage() {
    const { t, setUserLanguage } = useLanguage();
    const [step, setStep] = useState<
        'intro' | 'greeting_vocal' | 'listening_lang' | 'lang' |
        'listening_contact' | 'scanning' | 'processing_ai' | 'result_vocal' | 'success'
    >('intro');

    const [patientInfo, setPatientInfo] = useState({ name: '', phone: '' });
    const [hospitalRecommendation, setHospitalRecommendation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [vitalsData, setVitalsData] = useState<{ heartRate: number, temperature: number, respiratoryRate: number } | null>(null);
    const [diagnosisData, setDiagnosisData] = useState<any>(null);

    const recognitionRef = useRef<any>(null);
    const transcriptRef = useRef('');
    // Android coupe/relance le micro : on garde le texte déjà dit et on sait si une session est active
    const shouldListenRef = useRef(false);
    const committedRef = useRef('');
    const activeRef = useRef(false);
    const finalizeRef = useRef<(() => void) | null>(null);
    const [transcript, setTranscript] = useState('');
    const [isRecording, setIsRecording] = useState(false);

    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
    const stepRef = useRef(step);

    // Arrêt propre du TTS en quittant la page
    useEffect(() => {
        return () => window.speechSynthesis.cancel();
    }, []);

    // Sollicitation GPS précoce avec instruction vocale pour analphabètes
    const requestGPS = async () => {
        setGpsStatus('requesting');
        const msg = t('gps_request');

        // On parle d'abord
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = 'fr-FR';
        let gpsStarted = false;
        const askPosition = () => {
            if (gpsStarted) return;
            gpsStarted = true;
            if (!navigator.geolocation) {
                setGpsStatus('denied');
                setStep('listening_contact');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setGpsStatus('granted');
                    // Notification vocale de succès
                    speakText("Merci. Commençons le recueil de vos informations.", 'listening_contact');
                },
                (err) => {
                    setGpsStatus('denied');
                    speakText("D'accord. Commençons.", 'listening_contact');
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        };
        // Secours : certains navigateurs ne déclenchent jamais onend
        setTimeout(askPosition, Math.max(8000, msg.length * 150));
        utterance.onend = askPosition;
        utterance.onerror = askPosition;
        window.speechSynthesis.speak(utterance);
    };

    // ==========================================
    // TTS (Text To Speech)
    // ==========================================
    const speakText = async (text: string, nextStep: any) => {
        stopListening();
        window.speechSynthesis.cancel();

        const cleanText = text.replace(/[*_#`]/g, '').trim();
        const maxDuration = Math.max(8000, cleanText.length * 150);
        let safetyTimeout: any;

        let advanced = false;
        const advance = () => {
            if (advanced) return;
            advanced = true;
            clearTimeout(safetyTimeout);
            if (typeof nextStep === 'function') nextStep();
            else setStep(nextStep);
        };

        safetyTimeout = setTimeout(advance, maxDuration);

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'fr-FR';
        (window as any).currentUtterance = utterance;
        utterance.onend = advance;
        utterance.onerror = advance;

        window.speechSynthesis.speak(utterance);
    };

    // ==========================================
    // LOGIQUE GEOGRAPHIQUE
    // ==========================================
    const HOSPITAL_CENTERS = [
        { id: 1, name: 'CHU de Treichville (Sud)', lat: 5.301, lng: -4.004 },
        { id: 2, name: 'CHU de Yopougon (Ouest)', lat: 5.340, lng: -4.068 },
        { id: 3, name: 'CHU de Cocody (Est)', lat: 5.348, lng: -3.988 },
        { id: 4, name: 'Hôpital Général Abobo (Nord)', lat: 5.421, lng: -4.015 }
    ];

    const getNearestHospital = (lat: number, lng: number) => {
        let nearest = HOSPITAL_CENTERS[0];
        let minDistance = Math.sqrt(Math.pow(lat - nearest.lat, 2) + Math.pow(lng - nearest.lng, 2));

        HOSPITAL_CENTERS.forEach(center => {
            const dist = Math.sqrt(Math.pow(lat - center.lat, 2) + Math.pow(lng - center.lng, 2));
            if (dist < minDistance) {
                minDistance = dist;
                nearest = center;
            }
        });
        return nearest.name;
    };

    // ==========================================
    // STT (Speech To Text)
    // ==========================================
    const startListening = useCallback(() => {
        window.speechSynthesis.cancel();

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            speakText("Votre navigateur ne permet pas la reconnaissance vocale. Veuillez ouvrir Keneya avec Google Chrome.", 'intro');
            return;
        }

        // Nouvelle question : transcription vide
        if ((window as any).silenceTimer) clearTimeout((window as any).silenceTimer);
        transcriptRef.current = '';
        committedRef.current = '';
        setTranscript('');
        shouldListenRef.current = true;

        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onerror = (event: any) => {
            console.error('Triage Speech Recognition Error:', event.error);
            setIsRecording(false);
        };

        recognition.onstart = () => { activeRef.current = true; setIsRecording(true); };
        recognition.onresult = (e: any) => {
            let session = '';
            if (/Android/i.test(navigator.userAgent)) {
                // Chrome Android répète le texte dans chaque résultat : le dernier contient toute la phrase
                session = e.results[e.results.length - 1][0].transcript;
            } else {
                for (let i = 0; i < e.results.length; i++) session += e.results[i][0].transcript;
            }
            const current = `${committedRef.current} ${session}`.trim();
            setTranscript(current);
            transcriptRef.current = current;

            // Langue reconnue : on enchaîne sans attendre
            if (stepRef.current === 'listening_lang' && /(^|\s)(1|un|2|deux|3|trois|4|quatre|fran[cç]ais|dioula|jula|baoul[eé]|b[eé]t[eé])(\s|$)/i.test(current)) {
                finishAnswer();
                return;
            }

            // Pause détection : l'utilisateur a arrêté de parler
            if (current.trim().length > 0) {
                if ((window as any).silenceTimer) clearTimeout((window as any).silenceTimer);
                (window as any).silenceTimer = setTimeout(() => finishAnswer(), 2500);
            }
        };

        // Repose la question et relance l'écoute (setStep sur la même étape ne relancerait rien)
        const reAsk = (msg: string) => speakText(msg, () => startListening());

        let finalized = false;
        const finalize = () => {
            if (finalized || recognitionRef.current !== recognition) return;
            finalized = true;
            finalizeRef.current = null;

            const finalTranscript = transcriptRef.current.trim().toLowerCase();
            if (!finalTranscript) {
                reAsk("Je n'ai rien entendu. Pouvez-vous répéter, puis appuyer sur le micro ?");
                return;
            }

            const currentStep = stepRef.current;

            if (currentStep === 'listening_lang') {
                const isFr = ['1', 'un', 'francais', 'français', 'france'].some(w => finalTranscript.includes(w));
                const isDioula = ['2', 'deux', 'dioula', 'jula'].some(w => finalTranscript.includes(w));
                const isBaoule = ['3', 'trois', 'baoule', 'baoulé'].some(w => finalTranscript.includes(w));
                const isBete = ['4', 'quatre', 'bété', 'bete'].some(w => finalTranscript.includes(w));

                if (isFr) setUserLanguage('fr');
                else if (isDioula) setUserLanguage('dioula');
                else if (isBaoule) setUserLanguage('baoule');
                else if (isBete) setUserLanguage('bete');
                else setUserLanguage('fr'); // Français par défaut si incompréhension
                setStep('lang');
                return;
            }

            // Extraction et validation stricte (10 chiffres)
            const contact = extractContact(finalTranscript);
            if (!contact) {
                // Relance vocale si pas de numéro valide
                reAsk("Pardon, je n'ai pas bien saisi votre numéro. Il doit comporter 10 chiffres. Pouvez-vous me le répéter ?");
                return;
            }

            const { name, phone } = contact;
            setPatientInfo({ name, phone });

            // On progresse automatiquement
            const confirmMsg = `Merci ${name}. J'ai bien noté votre numéro. Commençons le scan biométrique pour vos constantes.`;
            speakText(confirmMsg, 'scanning');
        };

        recognition.onend = () => {
            activeRef.current = false;
            setIsRecording(false);
            if (recognitionRef.current !== recognition) return; // session abandonnée
            // Le système coupe le micro après un silence : on relance en gardant le texte
            if (shouldListenRef.current) {
                committedRef.current = transcriptRef.current;
                try {
                    recognition.start();
                    return;
                } catch (e) {
                    console.error('Triage: relance du micro impossible', e);
                }
            }
            finalize();
        };

        finalizeRef.current = finalize;
        recognitionRef.current = recognition;
        recognition.start();
    }, []);

    // Arrêt sans traitement (avant que l'IA parle) : on détache la session
    const stopListening = () => {
        shouldListenRef.current = false;
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        finalizeRef.current = null;
        if (recognition) {
            try { recognition.stop(); } catch { /* déjà arrêtée */ }
        }
        setIsRecording(false);
    };

    // Fin de réponse (bouton micro ou silence) : on traite ce qui a été dit
    const finishAnswer = () => {
        shouldListenRef.current = false;
        if ((window as any).silenceTimer) clearTimeout((window as any).silenceTimer);
        const recognition = recognitionRef.current;
        const wasActive = activeRef.current;
        if (recognition && wasActive) {
            try { recognition.stop(); } catch { /* déjà arrêtée */ }
        }
        // Si le système avait déjà coupé le micro, onend ne viendra pas : on traite directement
        // On mémorise la session de CETTE réponse : la question suivante aura déjà remplacé finalizeRef
        const pending = finalizeRef.current;
        setTimeout(() => pending?.(), wasActive ? 1500 : 0);
        setIsRecording(false);
    };

    // ==========================================
    // CYCLE DE VIE VOCAL
    // ==========================================
    useEffect(() => {
        stepRef.current = step;
        if (step === 'greeting_vocal') {
            speakText("Bonjour. Choississez votre langue. Si c'est Français dites 1. Si c'est Dioula dites 2. Si c'est Baoulé dites 3. Si c'est Bété dites 4.", 'listening_lang');
        } else if (step === 'listening_lang') {
            startListening();
        } else if (step === 'lang') {
            requestGPS();
        } else if (step === 'listening_contact') {
            startListening();
        } else if (step === 'result_vocal' && diagnosisData) {
            const hospitalInfo = hospitalRecommendation ? `Rendez-vous immédiatement au ${hospitalRecommendation}, c'est le plus proche de vous.` : "";
            const msg = diagnosisData.diagnosis === 'danger'
                ? `Attention ${patientInfo.name}, vos constantes sont critiques. Il y a une suspicion de ${diagnosisData.suspectedIllness}. ${hospitalInfo} Un agent de santé a été alerté.`
                : diagnosisData.diagnosis === 'warning'
                    ? `${patientInfo.name}, vos constantes montrent des signes à surveiller, peut-être ${diagnosisData.suspectedIllness}. Consultez ${hospitalRecommendation ? 'le ' + hospitalRecommendation : 'un centre de santé'} dans les 24 heures.`
                    : `Merci ${patientInfo.name}, vos constantes ont été analysées. Elles ne montrent pas de signe de maladie grave.`;
            speakText(msg, 'success');
        }
    }, [step, diagnosisData, hospitalRecommendation]);

    const handleScanComplete = async (vitals: { heartRate: number, temperature: number, respiratoryRate: number }) => {
        setVitalsData(vitals);
        setStep('processing_ai');

        try {
            // Création d'un prompt virtuel pour le backend de Triage existant
            let virtualSymptom = "triage capteur. ";
            if (vitals.temperature >= 38.5) virtualSymptom += " forte fièvre";
            if (vitals.respiratoryRate >= 25) virtualSymptom += " mal à respirer étouffe";
            if (vitals.heartRate >= 110) virtualSymptom += " coeur rapide";

            // Si tout est ok
            if (vitals.temperature < 38.5 && vitals.heartRate < 90 && vitals.respiratoryRate < 20) {
                virtualSymptom += " tout va bien";
            }

            const res = await fetch('/api/triage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: virtualSymptom })
            });
            if (!res.ok) throw new Error(`Triage HTTP ${res.status}`);
            const data = await res.json();
            setDiagnosisData(data);

            const saveTriageReport = async () => {
                const currentCoords = coords;

                // Détermination de l'hôpital si on a la position
                if (currentCoords) {
                    const nearest = getNearestHospital(currentCoords.lat, currentCoords.lng);
                    setHospitalRecommendation(nearest);
                }

                const payload: any = {
                    patient_name: patientInfo.name || 'Anonyme',
                    patient_phone: patientInfo.phone,
                    symptoms: [data.syndrome || 'inconnu'],
                    symptoms_text: `Triage par capteurs. FC: ${vitals.heartRate} bpm | Resp: ${vitals.respiratoryRate} rpm | Temp: ${vitals.temperature}°C`,
                    severity: data.diagnosis === 'danger' ? 'rouge' : (data.diagnosis === 'warning' ? 'jaune' : 'vert'),
                    suspected_illness: data.suspectedIllness,
                    metadata: {
                        vitals: vitals,
                        source: 'triage_empreinte',
                        ia_reasoning: data.reasoning,
                        ...(coords && { lat: coords.lat, lng: coords.lng })
                    },
                    geo_cell: 'Abidjan-Triage'
                };
                await saveReport(payload);

                setStep('result_vocal'); // On lance l'annonce vocale du résultat
            };

            // Sauvegarde immédiate (le GPS a déjà été sollicité au début)
            saveTriageReport();
        } catch (error) {
            console.error("Erreur API Triage:", error);
            setStep('success');
        }
    };

    return (
        <div className="min-h-screen bg-keneya-navy relative flex flex-col font-sans overflow-hidden">
            {/* Background Animations */}
            <div className={`absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full blur-[100px] transition-colors duration-1000 
                ${isRecording ? 'bg-keneya-green/30 animate-pulse' : 'bg-keneya-green/10'}
                ${step === 'processing_ai' ? 'bg-slate-500/30 animate-spin' : ''}
                ${step === 'result_vocal' && diagnosisData?.diagnosis === 'danger' ? 'bg-keneya-red/40 animate-pulse' : ''}
            `} />

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 p-4 sm:p-6 z-50 flex items-center justify-between">
                {step !== 'success' && (
                    <button onClick={() => window.history.back()} className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/20 backdrop-blur-md rounded-full shadow-lg active:scale-95 transition-transform text-white">
                        <ChevronLeft size={28} />
                    </button>
                )}
                <div className="ml-auto w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/20 shadow-xl backdrop-blur-md">
                    <Shield size={24} className="text-keneya-green-light" />
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full relative z-10 max-w-lg mx-auto mt-16 text-center">

                {/* 1. INTRO */}
                {step === 'intro' && (
                    <div className="w-full animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 mx-auto text-white bg-keneya-green/20 border-4 border-keneya-green rounded-full flex items-center justify-center mb-6 shadow-xl">
                            <Fingerprint size={48} className="text-keneya-green-light animate-pulse" />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-3 leading-tight tracking-tight">Triage par<br />Empreinte Biométrique</h1>
                        <p className="text-base text-slate-400 font-medium mb-10 px-4">
                            Ce processus utilise les capteurs de votre téléphone pour évaluer rapidement vos constantes vitales sans parler.
                        </p>

                        <button onClick={() => {
                            const init = new SpeechSynthesisUtterance('');
                            window.speechSynthesis.speak(init);
                            setStep('greeting_vocal'); // On demande la langue d'abord désormais
                        }} className="px-6 py-4 w-full flex items-center justify-center gap-3 bg-keneya-green text-white text-lg font-black rounded-2xl shadow-[0_0_30px_rgba(70,131,62,0.4)] hover:bg-keneya-green-light transition-all active:scale-95">
                            <Activity size={24} /> Démarrer le Triage
                        </button>
                    </div>
                )}

                {/* 2. ETAPES VOCALES (IA PARLE) & ECOUTE CONTACT */}
                {(step === 'greeting_vocal' || step === 'listening_lang' || step === 'lang' || step === 'listening_contact' || step === 'result_vocal') && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full animate-in zoom-in-95 duration-700">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 relative animate-bounce
                            ${diagnosisData?.diagnosis === 'danger' && step === 'result_vocal' ? 'bg-keneya-red shadow-[0_0_40px_rgba(201,42,42,0.5)]' : 'bg-keneya-green shadow-[0_0_40px_rgba(70,131,62,0.5)]'}
                        `} style={{ animationDuration: '3s' }}>
                            <div className={`absolute inset-0 border-4 rounded-full animate-ping ${diagnosisData?.diagnosis === 'danger' && step === 'result_vocal' ? 'border-keneya-red-light' : 'border-keneya-green-light'}`}></div>
                            <Volume2 size={48} className="text-white relative z-10 animate-pulse" />
                        </div>
                        <h1 className="text-2xl font-black text-white text-center leading-tight mb-2 uppercase tracking-tighter">
                            KENEYA <span className={diagnosisData?.diagnosis === 'danger' && step === 'result_vocal' ? "text-keneya-red-light" : "text-keneya-green-light"}>vous parle</span>
                        </h1>
                        <p className="text-base text-slate-400 font-medium text-center italic mb-8">
                            {step === 'listening_contact' || step === 'listening_lang' ? "Je vous écoute..." : "Écoutez l'instruction..."}
                        </p>

                        {/* SECTION ECOUTE */}
                        {(step === 'listening_contact' || step === 'listening_lang') && (
                            <div className="w-full flex flex-col items-center">
                                <button onClick={finishAnswer} className="relative flex items-center justify-center w-32 h-32 rounded-full bg-keneya-green-light text-white shadow-[0_0_50px_rgba(70,131,62,0.6)] group active:scale-95">
                                    <div className="absolute inset-0 border-[4px] border-white/30 rounded-full animate-ping"></div>
                                    <Mic size={40} className="relative z-10" />
                                </button>
                                <div className="mt-8 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 w-full text-center relative overflow-hidden">
                                    <span className="text-keneya-green-light font-black text-[9px] uppercase tracking-[0.2em] block mb-3">{step === 'listening_lang' ? 'Choix de la langue' : 'Transcription Nom & Tél'}</span>
                                    <p className="text-lg text-white font-bold leading-relaxed">{transcript ? `"${transcript}"` : 'Attente de votre réponse...'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* PROCESSING IA */}
                {step === 'processing_ai' && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 border-8 border-slate-700 border-t-keneya-green rounded-full animate-spin mb-8"></div>
                        <h1 className="text-2xl font-black text-white text-center leading-tight mb-2">
                            Analyse de vos <span className="text-keneya-green">Constantes...</span>
                        </h1>
                        <p className="text-slate-500 font-medium uppercase tracking-widest text-xs">Moteur Épidémiologique actif</p>
                    </div>
                )}

                {/* 3. SCANNING (BioScanner) */}
                {step === 'scanning' && (
                    <div className="w-full animate-in zoom-in-95 duration-500">
                        <BioScanner onComplete={handleScanComplete} />
                    </div>
                )}

                {/* 4. SUCCESS */}
                {step === 'success' && (
                    <div className="w-full animate-in zoom-in-95 duration-500 flex flex-col items-center">
                        <div className="w-24 h-24 text-white rounded-full flex items-center justify-center mb-6 bg-keneya-green shadow-[0_0_40px_rgba(70,131,62,0.4)]">
                            <CheckCircle2 size={48} strokeWidth={3} />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-3 text-center">Triage Terminé</h1>
                        <p className="text-base text-slate-400 font-medium mb-10 px-4">
                            Vos constantes vitales ont été enregistrées en toute sécurité dans la base de données gouvernementale. Un agent de santé vous contactera si nécessaire.
                        </p>

                        <Link href="/" className="px-6 py-4 w-full bg-white/10 border border-white/20 text-white text-lg font-black rounded-2xl hover:bg-white/20 transition-all active:scale-95 inline-block">
                            Retour à l'accueil
                        </Link>
                    </div>
                )}

            </main>
        </div>
    );
}
