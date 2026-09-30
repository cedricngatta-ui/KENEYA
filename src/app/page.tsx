'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, Mic, Lock, MapPin, Thermometer, Wind, Droplets, Eye, Brain, Syringe, Activity, Fingerprint, Shield, MessageSquare, LayoutDashboard } from 'lucide-react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function Home() {
    const { t } = useLanguage();
    const [user, setUser] = useState<any>(null);
    const [dashboardUrl, setDashboardUrl] = useState('/pro/login');

    useEffect(() => {
        const checkUser = async () => {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            if (!url || url.includes('placeholder') || url.includes('your_supabase')) return;
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUser(user);
                    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single() as any;
                    if (userData?.role === 'admin') setDashboardUrl('/admin');
                    else if (userData?.role === 'health_center') setDashboardUrl('/dashboard/center');
                    else if (userData?.role === 'community_agent') setDashboardUrl('/dashboard/agent');
                    else setDashboardUrl('/dashboard');
                }
            } catch (e) {
                console.warn('Supabase auth check skipped in test mode:', e);
            }
        };
        checkUser();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">

            {/* ================= HEADER / NAVBAR ================= */}
            <header className="fixed top-0 left-0 right-0 h-16 md:h-24 bg-white/95 backdrop-blur-md z-50 border-b border-slate-200 shadow-sm flex items-center">
                <div className="container mx-auto px-4 md:px-6 max-w-7xl flex items-center justify-between">
                    {/* Vrai Logo KENEYA */}
                    <Link href="/" className="flex items-center transition-opacity hover:opacity-80 rounded-2xl overflow-hidden isolate">
                        <div className="relative h-12 w-48 md:h-24 md:w-80">
                            <Image
                                src="/logo-keneya.png"
                                alt="Logo KENEYA"
                                fill
                                className="object-contain object-left mix-blend-darken"
                                priority
                            />
                        </div>
                    </Link>

                    <div className="flex items-center gap-4">
                        <Link
                            href={dashboardUrl}
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-black uppercase tracking-widest rounded-full transition-all shadow-lg active:scale-95"
                        >
                            {user ? (
                                <>
                                    <LayoutDashboard size={16} className="text-keneya-green-light" />
                                    <span>Mon Dashboard</span>
                                </>
                            ) : (
                                <>
                                    <Lock size={16} className="text-keneya-green-light" />
                                    <span>Espace PRO</span>
                                </>
                            )}
                        </Link>
                    </div>
                </div>
            </header>

            <main className="pt-20">

                {/* ================= HERO SECTION (Le Cœur du Projet) ================= */}
                <section className="relative overflow-hidden bg-keneya-navy min-h-[80vh] flex items-center justify-center text-white py-20 px-4">
                    {/* Background Gradients */}
                    <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-keneya-green/20 rounded-full blur-[120px] animate-pulse-slow object-cover" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-keneya-red/20 rounded-full blur-[120px] animate-pulse-slow object-cover" style={{ animationDelay: '2s' }} />
                    <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.05]"></div>

                    <div className="container mx-auto max-w-5xl relative z-10 flex flex-col items-center text-center">

                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 text-white text-sm font-bold uppercase tracking-widest rounded-full mb-8 backdrop-blur-sm">
                            <Activity size={16} className="text-keneya-green-light" />
                            <span>Système d'Alerte Citoyen</span>
                        </div>

                        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6 tracking-tighter text-wrap-balance">
                            Prévenir, Alerter et <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-keneya-green-light to-white">
                                Protéger Abidjan.
                            </span>
                        </h1>

                        <p className="text-base md:text-xl text-slate-300 max-w-2xl mb-10 font-medium leading-relaxed px-4">
                            La santé communautaire à portée de voix. Signalez une urgence en langue locale sans consulter votre clavier.
                        </p>

                        {/* BIG CENTRAL ACTIONS */}
                        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl justify-center mb-12 px-4">
                            <Link href="/signaler" className="group flex-1 flex flex-col items-center justify-center gap-2 px-5 py-6 bg-keneya-green hover:bg-keneya-green-light text-white rounded-3xl shadow-[0_0_30px_rgba(70,131,62,0.3)] transition-all duration-300 hover:scale-105 active:scale-95">
                                <Mic size={32} className="animate-pulse mb-1 text-white" />
                                <span className="text-lg md:text-xl font-black tracking-tight">Signalement Vocal</span>
                                <span className="text-xs font-medium text-white/80 flex items-center gap-1">Je parle pour signaler <ChevronRight size={14} /></span>
                            </Link>

                            <Link href="/triage" className="group flex-1 flex flex-col items-center justify-center gap-2 px-5 py-6 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border-2 border-white/20 rounded-3xl shadow-[0_0_30px_rgba(255,255,255,0.1)] transition-all duration-300 hover:scale-105 active:scale-95">
                                <Fingerprint size={32} className="mb-1 text-keneya-green-light group-hover:animate-bounce" />
                                <span className="text-lg md:text-xl font-black tracking-tight">Triage Empreinte</span>
                                <span className="text-xs font-medium text-white/80 flex items-center gap-1 text-center">Scanner mes constantes <ChevronRight size={14} /></span>
                            </Link>
                        </div>

                        {/* MINI STATS */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center border-t border-white/10 pt-8 w-full max-w-2xl">
                            <div>
                                <h3 className="text-2xl font-black text-white mb-1">0%</h3>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Clavier requis</p>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-keneya-green-light mb-1">100%</h3>
                                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Vocal & Inclusif</p>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                                <MapPin size={24} className="text-slate-400 mb-1 opacity-50" />
                                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Abidjan</p>
                            </div>
                        </div>

                    </div>
                </section>

                {/* ================= SYNDROMES GRID ================= */}
                <section className="py-16 bg-white relative border-b border-slate-100">
                    <div className="container mx-auto px-4 max-w-6xl">
                        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-10">
                            <div className="max-w-lg">
                                <span className="text-keneya-green font-bold tracking-widest uppercase text-[10px] mb-2 block">Surveillance Médicale</span>
                                <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight">Détection Syndromique</h2>
                            </div>
                            <p className="text-slate-500 font-medium max-w-sm">
                                KENEYA regroupe les signalements autour de ces 6 syndromes critiques pour une classification instantanée.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
                            {[
                                { icon: Thermometer, color: 'text-orange-500', bg: 'bg-orange-50', title: 'Fièvre & Douleur' },
                                { icon: Wind, color: 'text-teal-500', bg: 'bg-teal-50', title: 'Respiratoire' },
                                { icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-50', title: 'Digestif Sévère' },
                                { icon: Eye, color: 'text-pink-500', bg: 'bg-pink-50', title: 'Éruptif / Boutons' },
                                { icon: Brain, color: 'text-purple-500', bg: 'bg-purple-50', title: 'Neurologique' },
                                { icon: Syringe, color: 'text-red-500', bg: 'bg-red-50', title: 'Hémorragique' }
                            ].map((s, i) => (
                                <div key={i} className="group relative bg-white border border-slate-200 p-5 rounded-2xl hover:shadow-lg hover:-translate-y-1 hover:border-keneya-navy transition-all duration-300">
                                    <div className={`w-12 h-12 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                        <s.icon size={24} strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-xs font-black text-slate-900 leading-tight">{s.title}</h3>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ================= COMMENT ÇA MARCHE ================= */}
                <section className="py-16 bg-slate-50 relative">
                    <div className="container mx-auto px-4 max-w-5xl">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">Un système conçu pour tous.</h2>
                            <p className="text-slate-600 font-medium text-base">
                                Le moteur intelligent de KENEYA convertit la voix locale en données médicales structurées pour les équipes d'intervention.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Carte 1 */}
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5 text-slate-400 font-black text-2xl">1</div>
                                <h3 className="text-lg font-black text-keneya-navy mb-3">Je choisis ma langue</h3>
                                <p className="text-slate-500 font-medium text-sm">L'interface s'adapte à votre ethnie (Dioula, Baoulé, Bété...) via une voix de synthèse claire.</p>
                            </div>

                            {/* Carte 2 */}
                            <div className="bg-white p-6 rounded-3xl shadow-md border-2 border-keneya-green relative transform -translate-y-2 text-center flex flex-col items-center">
                                <div className="absolute -top-3 bg-keneya-green text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">Étape Clé</div>
                                <div className="w-16 h-16 bg-keneya-green/10 text-keneya-green rounded-2xl flex items-center justify-center mb-5">
                                    <MessageSquare size={32} />
                                </div>
                                <h3 className="text-lg font-black text-keneya-navy mb-3">Je décris au micro</h3>
                                <p className="text-slate-500 font-medium text-sm">Dialogue naturel avec KENEYA qui écoute les symptômes et rassure le patient.</p>
                            </div>

                            {/* Carte 3 */}
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 text-center flex flex-col items-center">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-5 text-slate-400 font-black text-2xl">3</div>
                                <h3 className="text-lg font-black text-keneya-navy mb-3">Alerte Transmise</h3>
                                <p className="text-slate-500 font-medium text-sm">Le centre de santé reçoit l'alerte qualifiée avec la géolocalisation pour agir super vite !</p>
                            </div>
                        </div>


                    </div>
                </section>

            </main>

            {/* ================= FOOTER ================= */}
            <footer className="bg-slate-900 text-slate-400 py-12 px-4 border-t border-slate-800 text-center">
                <div className="container mx-auto max-w-7xl">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="relative w-56 h-14 block rounded-xl overflow-hidden isolate">
                                <Image
                                    src="/logo-keneya.png"
                                    alt="Logo KENEYA Footer"
                                    fill
                                    className="object-contain object-left invert opacity-100 transition-opacity hover:opacity-80 mix-blend-screen"
                                />
                            </div>
                        </div>
                        <p className="text-sm font-medium">© 2026 Projet KENEYA. Déveleppé pour la ville d'Abidjan.</p>
                    </div>
                </div>
            </footer>

        </div>
    );
}
