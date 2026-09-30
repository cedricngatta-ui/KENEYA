'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    User, MapPin, Activity, Thermometer, Droplets, Wind, Syringe, Eye, Brain,
    CheckCircle2, Save, Clock, Users, Stethoscope, TestTube, AlertCircle,
    Loader2, FileText, Mic, Waves, Bot, Zap
} from 'lucide-react';

const ABIDJAN_ZONES = [
    'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville',
    'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët',
    'Songon', 'Treichville', 'Yopougon'
];

const SYNDROMES = [
    { id: 'fievre', label: 'Fièvre Cible', icon: Thermometer, color: 'text-orange-500' },
    { id: 'respi', label: 'Respiratoire', icon: Wind, color: 'text-teal-500' },
    { id: 'diarrhee', label: 'Digestif Sév.', icon: Droplets, color: 'text-blue-500' },
    { id: 'eruptif', label: 'Éruptif', icon: Eye, color: 'text-pink-500' },
    { id: 'neuro', label: 'Neurologique', icon: Brain, color: 'text-purple-500' },
    { id: 'hemorragique', label: 'Hémorragique', icon: Syringe, color: 'text-red-500' },
];

export default function FastAgentForm() {
    const supabase = createClient();

    const [patientId, setPatientId] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState<'M' | 'F'>('M');
    const [zone, setZone] = useState('');
    const [gravity, setGravity] = useState<'vert' | 'jaune' | 'rouge'>('jaune');
    const [syndrome, setSyndrome] = useState('');
    const [caseStatus, setCaseStatus] = useState<'suspect' | 'probable' | 'confirmed'>('suspect');
    const [actions, setActions] = useState<string[]>([]);

    const [zoneOpen, setZoneOpen] = useState(false);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [recentCount, setRecentCount] = useState(0);
    const [todayCount, setTodayCount] = useState(0);

    // États IA Vocale
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [aiAnalyzing, setAiAnalyzing] = useState(false);
    const [recognition, setRecognition] = useState<any>(null);
    const [coords, setCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

    // Initialisation de Web Speech API
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recog = new SpeechRecognition();
                recog.continuous = false; // S'arrête après un silence
                recog.interimResults = true; // Montre les résultats partiels
                recog.lang = 'fr-FR'; // Standard compatible universel

                recog.onresult = (event: any) => {
                    let fullTranscript = '';
                    for (let i = 0; i < event.results.length; ++i) {
                        fullTranscript += event.results[i][0].transcript + ' ';
                    }
                    const clean = fullTranscript.trim();
                    if (clean) {
                        setTranscript(clean);
                    }
                };

                recog.onerror = (event: any) => {
                    console.error('Speech recognition error', event.error);
                    setIsListening(false);
                    setAiAnalyzing(false);
                };

                recog.onend = () => {
                    setIsListening(false);
                    // Déclenche l'analyse quand on arrête de parler
                    setAiAnalyzing(true);
                };

                setRecognition(recog);
            } else {
                console.warn("L'API SpeechRecognition n'est pas supportée sur ce navigateur.");
            }
        }
    }, []);

    // Fonction d'Analyse Sémanthique Rapide
    useEffect(() => {
        if (aiAnalyzing && transcript) {
            // Petite pause artificielle pour "l'effet IA"
            const timer = setTimeout(() => {
                analyzeTranscriptAndFill(transcript);
                setAiAnalyzing(false);
            }, 800);
            return () => clearTimeout(timer);
        } else if (aiAnalyzing && !transcript) {
            setAiAnalyzing(false);
        }
    }, [aiAnalyzing, transcript]);

    const analyzeTranscriptAndFill = (text: string) => {
        const lowerText = text.toLowerCase();

        // 1. Extraction de l'Âge
        const ageMatch = lowerText.match(/(\d+)\s*(ans|an)/);
        if (ageMatch && ageMatch[1]) setAge(ageMatch[1]);

        // Genre
        if (lowerText.match(/\b(homme|garçon|garcon|monsieur|vieux)\b/)) { setGender('M'); }
        else if (lowerText.match(/\b(femme|fille|dame|vieille|patiente)\b/)) { setGender('F'); }

        // Zone
        const foundZone = ABIDJAN_ZONES.find(z => lowerText.includes(z.toLowerCase()));
        if (foundZone) setZone(foundZone);

        // Syndromes
        let detectedSyndrome = '';
        let detectedGravity: 'vert' | 'jaune' | 'rouge' = 'jaune';

        if (lowerText.includes('fièvre') || lowerText.includes('fievre') || lowerText.includes('chaud')) {
            detectedSyndrome = 'fievre';
            if (lowerText.includes('forte') || lowerText.includes('très') || lowerText.includes('40')) detectedGravity = 'rouge';
        }
        if (lowerText.includes('diarrhée') || lowerText.includes('vomissement') || lowerText.includes('choléra')) {
            detectedSyndrome = 'diarrhee';
            if (lowerText.includes('sang') || lowerText.includes('déshydrat')) detectedGravity = 'rouge';
        }
        if (lowerText.includes('toux') || lowerText.includes('respire mal') || lowerText.includes('essoufflé') || lowerText.includes('respiratoire')) {
            detectedSyndrome = 'respi';
            if (lowerText.includes('sang') || lowerText.includes('étouffe')) detectedGravity = 'rouge';
        }
        if (detectedSyndrome) setSyndrome(detectedSyndrome);

        // Gravité surcharge
        if (lowerText.match(/\b(léger|legere|leger|faible)\b/)) detectedGravity = 'vert';
        else if (lowerText.match(/\b(modéré|modere|moyen)\b/)) detectedGravity = 'jaune';
        else if (lowerText.match(/\b(urgent|urgence|sévère|severe|grave|critique)\b/)) detectedGravity = 'rouge';
        setGravity(detectedGravity);

        // ID Patient Auto
        if (!patientId) {
            setPatientId('ID-' + Math.floor(1000 + Math.random() * 9000));
        }
    };

    const handleVoiceCommand = () => {
        if (!recognition) return;
        if (isListening) {
            recognition.stop();
        } else {
            setTranscript('');
            if (typeof window !== 'undefined') {
                window.speechSynthesis.cancel();
            }
            setIsListening(true);

            // Capture GPS silencieuse en tâche de fond si pas encore effectuée
            if (gpsStatus === 'idle') {
                setGpsStatus('requesting');
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                        setGpsStatus('granted');
                    },
                    (err) => {
                        setGpsStatus('denied');
                        console.warn("GPS non disponible sur FastAgentForm");
                    },
                    { enableHighAccuracy: true, timeout: 5000 }
                );
            }

            try { recognition.start(); } catch (e) { }
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayC } = await supabase.from('reports').select('id', { count: 'exact', head: true }).gte('created_at', today.toISOString());
        const { count: totalC } = await supabase.from('reports').select('id', { count: 'exact', head: true });
        setTodayCount(todayC || 0);
        setRecentCount(totalC || 0);
    }

    const toggleAction = (actionId: string) => {
        setActions(prev => prev.includes(actionId) ? prev.filter(a => a !== actionId) : [...prev, actionId]);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientId || !age || !zone || !syndrome) {
            setErrorMessage('ID, Âge, Zone et Syndrome requis.');
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
            return;
        }
        setStatus('saving');
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const syndromeLabel = SYNDROMES.find(s => s.id === syndrome)?.label || syndrome;

            const { error: reportError } = await (supabase as any).from('reports').insert({
                user_id: user?.id || null,
                symptoms: [syndromeLabel, ...actions],
                geo_cell: zone,
                severity: gravity,
                metadata: coords ? { lat: coords.lat, lng: coords.lng, source: 'fast_agent_vocal' } : { source: 'fast_agent_vocal' }
            });
            if (reportError) throw reportError;

            setStatus('saved');
            fetchStats();
            setTimeout(() => { setStatus('idle'); /* Rester sur le formulaire s'il veut en faire un autre */ }, 2000);
        } catch (err: any) {
            setErrorMessage(err.message || 'Erreur transmission.');
            setStatus('error');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <div className="p-4 lg:p-8 max-w-5xl mx-auto">
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-black text-keneya-navy">Saisie Terrain Rapide</h1>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">IA Vocal & Sémantique</p>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
                {/* Micro / Assistant */}
                <div className="p-8 bg-slate-900 border-b border-white/5 flex flex-col items-center gap-6 text-center">
                    <button
                        type="button"
                        onClick={handleVoiceCommand}
                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all bg-keneya-green relative shadow-[0_0_50px_rgba(26,188,156,0.4)] ${isListening ? 'scale-110' : 'hover:scale-105 shadow-none'}`}
                    >
                        {isListening && <div className="absolute inset-0 rounded-full border-4 border-white/20 border-t-white animate-spin"></div>}
                        <Mic size={32} className="text-white" />
                    </button>
                    <div className="space-y-1">
                        <p className="text-sm font-black text-white">Appuyez pour dicter le cas</p>
                        <p className="text-[10px] text-slate-400 font-medium">"Homme de 30 ans à Abobo avec forte fièvre et toux..."</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="p-8 space-y-8">
                    {/* Champs simplifiés */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">ID Patient / Dossier</label>
                            <input required type="text" value={patientId} onChange={e => setPatientId(e.target.value)} placeholder="Ex: Dossier 202" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Âge</label>
                                <input required type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">District</label>
                                <select value={zone} onChange={e => setZone(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700">
                                    <option value="">Zone...</option>
                                    {ABIDJAN_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Syndrome principal</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {SYNDROMES.map(s => (
                                <button key={s.id} type="button" onClick={() => setSyndrome(s.id)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${syndrome === s.id ? 'bg-keneya-navy border-keneya-navy text-white' : 'bg-slate-50 border-slate-100/50'}`}>
                                    <s.icon size={24} className={syndrome === s.id ? 'text-white' : s.color} />
                                    <span className="text-[10px] font-black uppercase text-center">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-6">
                        <button type="submit" disabled={status === 'saving'} className={`w-full py-5 rounded-2xl font-black text-white text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95 ${status === 'saved' ? 'bg-keneya-green' : 'bg-keneya-navy shadow-keneya-navy/20'}`}>
                            {status === 'saving' ? 'Envoi en cours...' : status === 'saved' ? 'Signalement Transmis !' : 'Transmettre le cas'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
