'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Shield, ChevronLeft, Mic, MicOff, Check, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { saveReport } from '@/lib/reports';
import VoiceVisualizer from '@/components/ui/VoiceVisualizer';

export default function SignalerFlow() {
    const { t, setUserLanguage } = useLanguage();

    // Le flow démarre directement à 'greeting_vocal' (L'IA parle pour demander l'ethnie)
    // Le flow suit le protocole strict demandé
    // Nouveaux états pour le flow conversationnel détaillé
    const [step, setStep] = useState<
        'intro' | 'greeting_vocal' | 'listening_contact' | 'listening_lang' | 'lang' | 'ask_contact' |
        'ask_vitals' | 'measuring_vitals' |
        'ask_fever' | 'listen_fever' |
        'ask_digestive' | 'listen_digestive' |
        'ask_rash' | 'listen_rash' |
        'ask_other' | 'listen_other' |
        'processing' |
        'ask_details' | 'listen_details' |
        'result_vocal' | 'success'
    >('intro');

    // On stocke les symptômes détectés au fur et à mesure
    const [detectedSymptoms, setDetectedSymptoms] = useState<string[]>([]);
    const [patientName, setPatientName] = useState('');
    const [patientPhone, setPatientPhone] = useState('');
    const [hospitalRecommendation, setHospitalRecommendation] = useState('');

    const [transcript, setTranscript] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [diagnosis, setDiagnosis] = useState<'safe' | 'warning' | 'danger'>('safe');
    const [suspectedIllness, setSuspectedIllness] = useState('');
    const [instructions, setInstructions] = useState<string[]>([]);
    const [officialMatch, setOfficialMatch] = useState<any>(null);
    const recognitionRef = useRef<any>(null);
    const transcriptRef = useRef('');
    const shouldListenRef = useRef(false);

    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

    // S'assurer que le TTS s'arrête si l'utilisateur quitte la page
    useEffect(() => {
        return () => {
            window.speechSynthesis.cancel();
        };
    }, []);

    // Sollicitation GPS précoce avec instruction vocale pour analphabètes
    const requestGPS = async () => {
        setGpsStatus('requesting');
        const msg = t('gps_request');

        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = 'fr-FR';
        let gpsStarted = false;
        const askPosition = () => {
            if (gpsStarted) return;
            gpsStarted = true;
            if (!navigator.geolocation) {
                setGpsStatus('denied');
                setStep('ask_contact');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setGpsStatus('granted');
                    // Notification vocale de succès
                    const successMsg = new SpeechSynthesisUtterance("Merci. Je commence à vous écouter.");
                    successMsg.lang = 'fr-FR';
                    successMsg.onend = () => setStep('ask_contact');
                    window.speechSynthesis.speak(successMsg);
                },
                (err) => {
                    setGpsStatus('denied');
                    const failMsg = new SpeechSynthesisUtterance("D'accord. Je commence à vous écouter.");
                    failMsg.lang = 'fr-FR';
                    failMsg.onend = () => setStep('ask_contact');
                    window.speechSynthesis.speak(failMsg);
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
    // LOGIQUE GEOGRAPHIQUE
    // ==========================================
    const HOSPITAL_CENTERS = [
        { id: 1, name: 'CHU de Treichville (Sud)', lat: 5.301, lng: -4.004 },
        { id: 2, name: 'CHU de Yopougon (Ouest)', lat: 5.340, lng: -4.068 },
        { id: 3, name: 'CHU de Cocody (Est)', lat: 5.348, lng: -3.988 },
        { id: 4, name: 'Hôpital Général d\'Abobo (Nord)', lat: 5.421, lng: -4.015 },
        { id: 5, name: 'Hôpital Général de Marcory', lat: 5.302, lng: -3.992 },
        { id: 6, name: 'Hôpital Général de Port-Bouët', lat: 5.253, lng: -3.945 },
        { id: 7, name: 'Hôpital Général de Koumassi', lat: 5.292, lng: -3.963 },
        { id: 8, name: 'Hôpital Général d\'Adjamé', lat: 5.356, lng: -4.021 },
        { id: 9, name: 'CHU d\'Angré', lat: 5.398, lng: -3.962 },
        { id: 10, name: 'Hôpital Militaire d\'Abidjan (HMA)', lat: 5.378, lng: -4.032 }
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

    const getGeoCellFromCoords = (lat: number, lng: number) => {
        // Coordonnées ESATIC Treichville (approx)
        const esaticLat = 5.3023;
        const esaticLng = -4.0042;
        const distToEsatic = Math.sqrt(Math.pow(lat - esaticLat, 2) + Math.pow(lng - esaticLng, 2));

        // Si on est à moins de ~500m de l'ESATIC
        if (distToEsatic < 0.005) return 'ESATIC';

        // Fallback Treichville
        const treichvilleLat = 5.3015;
        const treichvilleLng = -4.0083;
        const distToTreich = Math.sqrt(Math.pow(lat - treichvilleLat, 2) + Math.pow(lng - treichvilleLng, 2));
        if (distToTreich < 0.02) return 'Treichville';

        return 'Abidjan (Hors zone)';
    };

    // ==========================================
    // TTS (Text To Speech)
    // ==========================================
    const speakText = async (text: string, nextStep: any) => {
        // Bloquer toute écoute du microphone pendant que l'IA parle
        stopListening();
        window.speechSynthesis.cancel();

        // Nettoyage des balises Markdown (*, _, #) pour éviter que la synthèse ne lise "étoile étoile"
        const cleanText = text.replace(/[*_#`]/g, '').trim();

        // Timeout de secours au cas où l'API vocal plante silencieusement
        // (150ms / caractère garantit que le timeout ne coupe pas une phrase)
        const maxDuration = Math.max(8000, cleanText.length * 150);
        let safetyTimeout: any;

        const advance = () => {
            clearTimeout(safetyTimeout);
            if (nextStep === 'end') setStep('success');
            else setStep(nextStep);
        };

        safetyTimeout = setTimeout(advance, maxDuration);

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'fr-FR';
        utterance.rate = 1.0; // vitesse normale

        // Référence globale pour éviter le nettoyage mémoire agressif des navigateurs
        (window as any).currentUtterance = utterance;

        utterance.onend = advance;
        utterance.onerror = advance;

        // On lance la voix !
        window.speechSynthesis.speak(utterance);
    };

    // ==========================================
    // STT (Speech To Text)
    // ==========================================
    const stopListening = useCallback(() => {
        shouldListenRef.current = false;
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        const recognition = recognitionRef.current; // Use the ref to stop the active recognition
        if (recognition) {
            recognition.stop();
        }
        setIsRecording(false);
    }, []);

    const startListening = useCallback((target: string) => {
        shouldListenRef.current = true;
        // SÉCURITÉ : On s'assure que l'IA se tait complètement avant d'activer le micro de l'utilisateur
        window.speechSynthesis.cancel();
        if ((window as any).currentAudio) {
            try { (window as any).currentAudio.pause(); } catch (e) { }
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            speakText("Votre navigateur ne permet pas la reconnaissance vocale. Veuillez ouvrir Keneya avec Google Chrome.", 'intro');
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'fr-FR';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onerror = (event: any) => {
            console.error('Speech Recognition Error:', event.error);
            setIsRecording(false);
            if (event.error === 'not-allowed') {
                const errorMsg = "L'accès au micro a été refusé. Veuillez l'autoriser dans les paramètres de votre navigateur pour continuer.";
                speakText(errorMsg, 'intro');
            }
        };

        recognition.onstart = () => { setIsRecording(true); setTranscript(''); transcriptRef.current = ''; };
        recognition.onresult = (e: any) => {
            let current = '';
            for (let i = 0; i < e.results.length; i++) current += e.results[i][0].transcript;
            const liveText = current.toLowerCase();
            setTranscript(current);
            transcriptRef.current = current;

            // Détection automatique de la langue (très résistante aux bruits et phrases parasites)
            if (target === 'lang') {
                const isFr = ['1', 'un', 'francais', 'français', 'france'].some(word => liveText.includes(word));
                const isDioula = ['2', 'deux', 'dioula', 'jula'].some(word => liveText.includes(word));
                const isBaoule = ['3', 'trois', 'baoule', 'baoulé'].some(word => liveText.includes(word));
                const isBete = ['4', 'quatre', 'bété', 'bete'].some(word => liveText.includes(word));

                // Dès qu'une langue est détectée dans les résultats intermédiaires,
                // on coupe le micro pour enchaîner sans délai
                if (isFr || isDioula || isBaoule || isBete) {
                    stopListening();
                    return; // Empêcher les appels multiples sur les résultats intermédiaires suivants
                }
            }
            // Détection Oui/Non pour les questions fermées
            else if (target.startsWith('listen_') && target !== 'listen_other' && target !== 'listen_details' && target !== 'listen_contact') {
                if (liveText.includes('oui') || liveText.includes('non') || liveText.includes('ouais') || liveText.includes('nan')) {
                    stopListening(); // Instantané
                    return;
                }
            }
            // Détection de pause pour les questions ouvertes ou recueil contact
            else if (target === 'listen_other' || target === 'listen_details' || target === 'listen_contact') {
                // "Non" / "rien" à la question des autres symptômes : on enchaîne sans attendre
                if (target === 'listen_other' && /^\s*(non|nan|rien)\b/.test(liveText)) {
                    stopListening();
                    return;
                }
                if (liveText.trim().length > 0) {
                    if ((window as any).silenceTimer) clearTimeout((window as any).silenceTimer);
                    (window as any).silenceTimer = setTimeout(() => stopListening(), 2500);
                }
            }
        };

        recognition.onend = () => {
            setIsRecording(false);

            // PWA / Mobile Optimization: Redémarrage automatique si le système est censé écouter
            // mais s'est arrêté prématurément (silence long, timeout OS, etc.)
            if (shouldListenRef.current) {
                console.log("PWA: Restarting recognition for persistence...");
                try {
                    recognition.start();
                    return;
                } catch (e) {
                    console.error("PWA: Failed to restart recognition:", e);
                }
            }

            const finalTranscript = transcriptRef.current.trim().toLowerCase();
            if (!finalTranscript) return;

            if (target === 'listen_contact') {
                const digits = finalTranscript.replace(/\D/g, '');
                const phoneMatch = digits.match(/\d{10}/);

                if (!phoneMatch) {
                    const errorMsg = "Pardon, je n'ai pas bien saisi votre numéro. Il doit comporter 10 chiffres. Pouvez-vous me le répéter ?";
                    speakText(errorMsg, 'listening_contact');
                    return;
                }

                const phone = phoneMatch[0];
                // Extraction du premier nom/prénom
                let rawName = finalTranscript.replace(/\d+/g, '').trim() || 'Citoyen';
                const firstName = rawName.split(' ')[0];
                const cleanName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

                setPatientName(cleanName);
                setPatientPhone(phone);
                setStep('ask_vitals'); // Vers la biométrie après le contact
                return;
            }

            if (target === 'lang') {
                const isFr = ['1', 'un', 'francais', 'français', 'france'].some(w => finalTranscript.includes(w));
                const isDioula = ['2', 'deux', 'dioula', 'jula'].some(w => finalTranscript.includes(w));
                const isBaoule = ['3', 'trois', 'baoule', 'baoulé'].some(w => finalTranscript.includes(w));
                const isBete = ['4', 'quatre', 'bété', 'bete'].some(w => finalTranscript.includes(w));

                if (isFr) {
                    // Priorité absolue au Français (Scénario 1)
                    setUserLanguage('fr');
                } else if (isDioula) {
                    setUserLanguage('dioula');
                } else if (isBaoule) {
                    setUserLanguage('baoule');
                } else if (isBete) {
                    setUserLanguage('bete');
                } else {
                    // Par défaut et de force : Français si incompréhension
                    setUserLanguage('fr');
                }
                setStep('lang');
            }
            else if (target === 'listen_fever') {
                if (finalTranscript.includes('oui') || finalTranscript.includes('ouais')) {
                    setDetectedSymptoms(prev => [...prev, 'fievre']);
                }
                setStep('ask_digestive');
            }
            else if (target === 'listen_digestive') {
                if (finalTranscript.includes('oui') || finalTranscript.includes('ouais') || finalTranscript.includes('vomiss') || finalTranscript.includes('diarrh')) {
                    setDetectedSymptoms(prev => [...prev, 'digestif']);
                }
                setStep('ask_rash');
            }
            else if (target === 'listen_rash') {
                if (finalTranscript.includes('oui') || finalTranscript.includes('ouais') || finalTranscript.includes('bouton') || finalTranscript.includes('plaqu')) {
                    setDetectedSymptoms(prev => [...prev, 'eruptif']);
                }
                setStep('ask_other');
            }
            else if (target === 'listen_other') {
                let finalSymptoms = [...detectedSymptoms];
                if (!finalTranscript.includes('non') && finalTranscript.length > 3) {
                    finalSymptoms.push(finalTranscript); // On ajoute le texte brut pour l'IA
                    setDetectedSymptoms(finalSymptoms);
                }

                // On passe à l'analyse
                setStep('processing');
                fetch('/api/triage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transcript: finalSymptoms.join(', ') || 'aucun symptome' })
                })
                    .then(res => {
                        if (!res.ok) throw new Error(`Triage HTTP ${res.status}`);
                        return res.json();
                    })
                    .then(data => {
                        setDiagnosis(data.diagnosis);
                        setSuspectedIllness(data.suspectedIllness);
                        setInstructions(data.instructions);
                        setOfficialMatch(data.officialAlertMatch);

                        if (data.diagnosis === 'danger' || data.diagnosis === 'warning') {
                            setStep('ask_details');
                        } else {
                            const saveReportWithoutDetails = async () => {
                                const currentCoords = coords;

                                if (currentCoords) {
                                    const nearest = getNearestHospital(currentCoords.lat, currentCoords.lng);
                                    setHospitalRecommendation(nearest);
                                }

                                const payload: any = {
                                    symptoms: finalSymptoms,
                                    symptoms_text: finalSymptoms.join(', '),
                                    patient_name: patientName || 'Anonyme',
                                    patient_phone: patientPhone,
                                    severity: 'vert',
                                    suspected_illness: data.suspectedIllness,
                                    geo_cell: currentCoords ? getGeoCellFromCoords(currentCoords.lat, currentCoords.lng) : 'ESATIC Treichville (Simulé)',
                                    metadata: currentCoords ? { lat: currentCoords.lat, lng: currentCoords.lng, source: 'vocal' } : { source: 'vocal' }
                                };
                                await saveReport(payload);
                                setStep('result_vocal');
                            };
                            saveReportWithoutDetails();
                        }
                    })
                    .catch(err => {
                        // Analyse indisponible : on donne un conseil prudent plutôt que de bloquer l'écran
                        console.error('Erreur triage:', err);
                        setDiagnosis('warning');
                        setSuspectedIllness('Analyse indisponible');
                        setInstructions(["Rendez-vous dans le centre de santé le plus proche si les symptômes persistent."]);
                        setStep('result_vocal');
                    });
            }
            else if (target === 'listen_details') {
                const finalTranscript = transcriptRef.current.trim().toLowerCase();
                const saveFinalReport = async () => {
                    const currentCoords = coords;

                    if (currentCoords) {
                        const nearest = getNearestHospital(currentCoords.lat, currentCoords.lng);
                        setHospitalRecommendation(nearest);
                    }

                    const payload: any = {
                        symptoms: detectedSymptoms,
                        symptoms_text: detectedSymptoms.join(', ') + ' | Détails: ' + finalTranscript,
                        patient_name: patientName || 'Anonyme',
                        patient_phone: patientPhone,
                        severity: diagnosis === 'danger' ? 'rouge' : (diagnosis === 'warning' ? 'jaune' : 'vert'),
                        suspected_illness: suspectedIllness,
                        geo_cell: currentCoords ? getGeoCellFromCoords(currentCoords.lat, currentCoords.lng) : 'ESATIC Treichville (Simulé)',
                        metadata: currentCoords ? { lat: currentCoords.lat, lng: currentCoords.lng, source: 'vocal_details' } : { source: 'vocal_details' }
                    };
                    await saveReport(payload);

                    setStep('result_vocal');
                };
                saveFinalReport();
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
        // coords, nom, diagnostic : lus dans onend, doivent être à jour au moment de l'écoute
    }, [detectedSymptoms, coords, patientName, patientPhone, diagnosis, suspectedIllness]);



    // Gestion du retour au premier plan (PWA Resilience)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && shouldListenRef.current && !isRecording) {
                console.log("PWA: App returned to foreground, resuming mic...");
                const currentStep = step;
                // Table de correspondance étape → target d'écoute
                const stepToTarget: Record<string, string> = {
                    'listening_lang': 'lang',
                    'listening_contact': 'listen_contact',
                    'listen_fever': 'listen_fever',
                    'listen_digestive': 'listen_digestive',
                    'listen_rash': 'listen_rash',
                    'listen_other': 'listen_other',
                    'listen_details': 'listen_details',
                };
                const target = stepToTarget[currentStep];
                if (target) {
                    startListening(target);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [step, isRecording, startListening]);


    // ==========================================
    // CYCLE DE VIE VOCAL
    // ==========================================
    useEffect(() => {
        if (step === 'greeting_vocal') {
            speakText("Bonjour. Choississez votre langue. Si c'est Français dites 1. Si c'est Dioula dites 2. Si c'est Baoulé dites 3. Si c'est Bété dites 4.", 'listening_lang');
        } else if (step === 'listening_lang') {
            startListening('lang');
        } else if (step === 'lang') {
            // Après le choix de la langue, on demande le GPS
            requestGPS();
        }
        else if (step === 'ask_contact') {
            speakText(`${t('ask_contact_info')} ${t('press_to_finish')}`, 'listening_contact');
        } else if (step === 'listening_contact') {
            startListening('listen_contact');
        }
        else if (step === 'ask_vitals') {
            speakText(`${patientName}, ${t('ask_vitals')}`, 'measuring_vitals');
        } else if (step === 'measuring_vitals') {
            // Simulation d'une mesure biométrique de 4 secondes
            const timer = setTimeout(() => {
                setStep('ask_fever');
            }, 4000);
            return () => clearTimeout(timer);
        }
        else if (step === 'ask_fever') {
            // Sécurité : On s'assure que si on a répondu 1, la question suivante est bien dite en français.
            const textToSpeak = `${patientName}, ${t('ask_fever') || "Avez-vous de la fièvre ou des maux de tête depuis moins de 48 heures ?"}`;
            speakText(textToSpeak, 'listen_fever');
        } else if (step === 'listen_fever') {
            startListening('listen_fever');
        }
        else if (step === 'ask_digestive') {
            speakText(`${patientName}, ${t('ask_vomiting')}`, 'listen_digestive');
        } else if (step === 'listen_digestive') {
            startListening('listen_digestive');
        }
        else if (step === 'ask_rash') {
            speakText(`${patientName}, ${t('ask_rash')}`, 'listen_rash');
        } else if (step === 'listen_rash') {
            startListening('listen_rash');
        }
        else if (step === 'ask_other') {
            speakText(`${patientName}, avez-vous d'autres symptômes particuliers ? Si oui, dites lesquels, sinon dites Non. ${t('press_to_finish')}`, 'listen_other');
        } else if (step === 'listen_other') {
            startListening('listen_other');
        }
        else if (step === 'ask_details') {
            speakText(`D'accord ${patientName}. Votre cas semble nécessiter un suivi. Veuillez nous donner plus de précisions sur ce que vous ressentez. ${t('press_to_finish')}`, 'listen_details');
        } else if (step === 'listen_details') {
            startListening('listen_details');
        } else if (step === 'result_vocal') {
            const hospitalInfo = hospitalRecommendation
                ? `Veuillez vous rendre immédiatement au centre de santé le plus proche : le ${hospitalRecommendation}. C'est très important pour votre sécurité.`
                : `Veuillez vous rendre dans le centre de santé le plus proche de chez vous sans tarder.`;

            const centre = hospitalRecommendation ? `le ${hospitalRecommendation}` : 'le centre de santé le plus proche';

            // Message adapté à la gravité : ne pas envoyer "immédiatement" à l'hôpital une personne sans signe grave
            const msg = diagnosis === 'danger'
                ? `Attention ${patientName}, une suspicion de ${suspectedIllness} a été détectée. ${hospitalInfo} Un agent de santé a été alerté.`
                : diagnosis === 'warning'
                    ? `${patientName}, d'après vos symptômes, il s'agit peut-être de ${suspectedIllness}. Consultez ${centre} dans les 24 heures. ${instructions.join(' ')}`
                    : `${patientName}, vos réponses ne montrent pas de signe de maladie grave. ${instructions.join(' ')} Si vous ne vous sentez pas mieux, consultez ${centre}.`;
            speakText(msg, 'end');
        }
    }, [step, diagnosis, suspectedIllness, instructions, hospitalRecommendation, patientName, t]);



    return (
        <div className="min-h-screen bg-keneya-navy relative flex flex-col font-sans overflow-hidden">
            {/* Background Animations for Voice Feedback */}
            <div className={`absolute top-[20%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full blur-[100px] transition-colors duration-1000 
                ${isRecording ? 'bg-keneya-red/30 animate-pulse' : ''}
                ${step === 'result_vocal' && diagnosis === 'danger' ? 'bg-keneya-red/40 animate-pulse' : ''}
                ${step === 'result_vocal' && diagnosis === 'safe' ? 'bg-keneya-green/20' : ''}
                ${step === 'processing' ? 'bg-slate-500/30 animate-spin' : ''}
            `} />

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 p-4 sm:p-6 z-50 flex items-center justify-between pointer-events-none">
                {step !== 'success' && (
                    <button onClick={() => { window.speechSynthesis.cancel(); window.history.back(); }} className="w-12 h-12 flex items-center justify-center bg-white/10 border border-white/20 backdrop-blur-md rounded-full shadow-lg pointer-events-auto active:scale-95 transition-transform text-white">
                        <ChevronLeft size={28} />
                    </button>
                )}
                <div className="ml-auto w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white border border-white/20 shadow-xl pointer-events-auto backdrop-blur-md">
                    <Shield size={24} className={diagnosis === 'danger' ? "text-keneya-red-light" : "text-keneya-green-light"} />
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full relative z-10 max-w-lg mx-auto">

                {/* ETAPE: INTRO (Déblocage Audio) */}
                {step === 'intro' && (
                    <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 w-full text-center">
                        <div className="w-24 h-24 text-white bg-keneya-red rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(201,42,42,0.5)] animate-pulse">
                            <Volume2 size={48} strokeWidth={2} />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-3 text-center leading-tight tracking-tight">Déclarer un<br />Cas Suspect</h1>
                        <p className="text-base text-slate-400 font-medium max-w-sm mb-10">
                            L'Agent Vocal de Keneya va vous poser quelques questions pour comprendre la situation.
                        </p>

                        <button
                            onClick={() => {
                                // Petite initialisation vocale silencieuse pour "chauffer" le navigateur
                                const init = new SpeechSynthesisUtterance('');
                                window.speechSynthesis.speak(init);
                                setStep('greeting_vocal'); // On commence par la langue maintenant
                            }}
                            className="px-6 py-4 w-full flex items-center justify-center gap-3 bg-white text-keneya-navy text-lg font-black rounded-2xl shadow-xl hover:bg-slate-100 transition-all active:scale-95"
                        >
                            <Mic size={24} className="text-keneya-red" />
                            Démarrer l'Alerte
                        </button>
                    </div>
                )}

                {/* ETAPES VOCALES (IA PARLE) */}
                {(step === 'greeting_vocal' || step === 'ask_contact' || step === 'ask_vitals' || step.startsWith('ask_') || step === 'result_vocal') && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full animate-in zoom-in-95 duration-700">
                        <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 relative animate-bounce
                            ${diagnosis === 'danger' && step === 'result_vocal' ? 'bg-keneya-red shadow-[0_0_40px_rgba(201,42,42,0.5)]' : 'bg-keneya-green shadow-[0_0_40px_rgba(70,131,62,0.5)]'}
                        `} style={{ animationDuration: '3s' }}>
                            <div className={`absolute inset-0 border-4 rounded-full animate-ping ${diagnosis === 'danger' && step === 'result_vocal' ? 'border-keneya-red-light' : 'border-keneya-green-light'}`}></div>
                            <Volume2 size={48} className="text-white relative z-10 animate-pulse" />
                        </div>
                        <h1 className="text-2xl font-black text-white text-center leading-tight mb-2 uppercase tracking-tighter">
                            KENEYA <span className={diagnosis === 'danger' && step === 'result_vocal' ? "text-keneya-red-light" : "text-keneya-green-light"}>vous parle</span>
                        </h1>
                        <p className="text-base text-slate-400 font-medium text-center italic">
                            Écoutez bien la question...
                        </p>
                    </div>
                )}


                {/* PROCESSING IA OU BIOMETRIE */}
                {(step === 'processing' || step === 'measuring_vitals') && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full animate-in zoom-in-95 duration-500">
                        <div className={`w-32 h-32 border-8 border-slate-700 border-t-keneya-green rounded-full animate-spin mb-8 flex items-center justify-center`}>
                            {step === 'measuring_vitals' && <Volume2 size={32} className="text-keneya-green animate-pulse" />}
                        </div>
                        <h1 className="text-2xl font-black text-white text-center leading-tight mb-2">
                            {step === 'processing' ? <>Analyse <span className="text-keneya-green">Médicale...</span></> : <>Mesure <span className="text-keneya-green">Biométrique...</span></>}
                        </h1>
                        <p className="text-slate-500 font-medium uppercase tracking-widest text-xs">
                            {step === 'processing' ? "Moteur Claude 3.5 Sonnet actif" : t('vitals_measuring')}
                        </p>
                    </div>
                )}

                {/* ETAPES ECOUTE (USER PARLE) */}
                {(step === 'listening_lang' || step === 'listening_contact' || step.startsWith('listen_')) && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full animate-in fade-in slide-in-from-bottom-12 duration-500">

                        <h1 className="text-2xl font-black text-white text-center mb-4 uppercase tracking-tight">
                            {step === 'listening_lang' ? "Choix de la langue"
                                : step === 'listening_contact' ? "Nom & Téléphone"
                                : step === 'listen_details' ? "Détails patient"
                                : step === 'listen_other' ? "Autres symptômes"
                                : "Répondez (Oui / Non)"}
                        </h1>

                        <div className="mb-6 w-full flex justify-center">
                            <VoiceVisualizer isActive={isRecording} color="#f87171" />
                        </div>

                        <button
                            onClick={stopListening}
                            className="relative flex items-center justify-center w-36 h-36 rounded-full bg-keneya-red text-white shadow-[0_0_60px_rgba(201,42,42,0.4)] group active:scale-95 transition-transform"
                        >
                            <div className="absolute inset-0 border-[4px] border-white/20 rounded-full animate-ping"></div>
                            <Mic size={48} className="relative z-10 group-hover:scale-110 transition-transform" />
                            <div className="absolute bottom-6 font-black tracking-[0.2em] uppercase text-[9px] opacity-70">Appuyez pour finir</div>
                        </button>

                        <div className="mt-8 bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-6 w-full text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-keneya-red to-transparent"></div>
                            <span className="text-keneya-red-light font-black text-[9px] uppercase tracking-[0.2em] block mb-3">Transcription en direct</span>
                            <p className="text-lg text-white font-bold leading-relaxed">
                                {transcript ? `"${transcript}"` : 'Attente de votre réponse...'}
                            </p>

                            {step.startsWith('listen_') && step !== 'listening_lang' && step !== 'listen_details' && (
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                    <div className={`w-8 h-2 rounded-full transition-colors ${step !== 'listen_fever' ? 'bg-keneya-green' : 'bg-white/10'}`}></div>
                                    <div className={`w-8 h-2 rounded-full transition-colors ${step === 'listen_rash' || step === 'listen_other' ? 'bg-keneya-green' : 'bg-white/10'}`}></div>
                                    <div className={`w-8 h-2 rounded-full transition-colors ${step === 'listen_other' ? 'bg-keneya-green' : 'bg-white/10'}`}></div>
                                    <span className="ml-2 text-[9px] font-black text-slate-500 uppercase">Progression du questionnaire</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ETAPE: SUCCESS */}
                {step === 'success' && (
                    <div className="flex-1 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500 w-full text-center">
                        <div className={`w-24 h-24 text-white rounded-full flex items-center justify-center mb-6 shadow-xl ${diagnosis === 'danger' ? 'bg-keneya-red shadow-keneya-red/40' : 'bg-keneya-green shadow-keneya-green/40'}`}>
                            <Check size={48} strokeWidth={4} />
                        </div>
                        {officialMatch && (
                            <div className="mb-6 p-3 bg-keneya-green/10 border border-keneya-green/30 rounded-xl animate-in zoom-in-95 duration-1000">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-keneya-green-light block mb-2">Vérification Gouvernementale</span>
                                <p className="text-white text-xs font-medium">
                                    Cas correspondant à l'alerte <span className="font-bold text-keneya-green-light underline decoration-dotted">{officialMatch.disease}</span> signalée par le {officialMatch.source}.
                                </p>
                            </div>
                        )}

                        <h1 className="text-3xl font-black text-white mb-3 text-center">Appel Terminé</h1>
                        <p className="text-base text-slate-400 font-medium max-w-sm mb-10">
                            Votre dossier médical vocal a été enregistré et traité par la Mairie d'Abidjan.
                        </p>

                        <Link href="/" onClick={() => window.speechSynthesis.cancel()} className="px-6 py-4 w-full text-center bg-white text-keneya-navy text-lg font-black rounded-2xl shadow-xl hover:bg-slate-100 transition-all active:scale-95">
                            Terminer
                        </Link>
                    </div>
                )}

            </main>
        </div>
    );
}
