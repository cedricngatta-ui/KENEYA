'use client';

import { useEffect, useRef, useState } from 'react';

interface VoiceVisualizerProps {
    isActive: boolean;
    color?: string;
}

export default function VoiceVisualizer({ isActive, color = '#ff4d4d' }: VoiceVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const smoothDataRef = useRef<Float32Array | null>(null);

    useEffect(() => {
        if (isActive) {
            startVisualizer();
        } else {
            stopVisualizer();
        }

        return () => stopVisualizer();
    }, [isActive]);

    const startVisualizer = async () => {
        // Éviter la double initialisation
        if (audioContextRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            streamRef.current = stream;

            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            const audioContext = new AudioContextClass();
            audioContextRef.current = audioContext;

            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            // Initialiser le tableau de lissage une seule fois
            smoothDataRef.current = new Float32Array(analyser.frequencyBinCount);

            draw();
        } catch (err) {
            console.error('Error accessing microphone for visualizer:', err);
        }
    };

    const stopVisualizer = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        analyserRef.current = null;
        smoothDataRef.current = null;
    };

    const draw = () => {
        if (!canvasRef.current || !analyserRef.current || !smoothDataRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const smoothData = smoothDataRef.current;

        const renderFrame = () => {
            if (!analyserRef.current || !smoothDataRef.current) return;
            animationFrameRef.current = requestAnimationFrame(renderFrame);
            analyserRef.current.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / 40); // On limite le nombre de barres pour un look plus propre
            let x = 0;

            // Effet WhatsApp/Premium : Barres symétriques et centrées
            for (let i = 0; i < 40; i++) {
                // Amortissement pour éviter les sauts brusques
                const targetHeight = (dataArray[i] / 255) * canvas.height * 0.8;
                smoothData[i] += (targetHeight - smoothData[i]) * 0.2;

                const barHeight = Math.max(4, smoothData[i]); // Hauteur minimale pour toujours voir un petit trait

                // Couleur et Transparence (Glassmorphism)
                // On utilise un dégradé de blanc à transparent ou orange doux
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);

                // On alterne ou on utilise une couleur harmonieuse
                const opacity = 0.4 + (barHeight / canvas.height) * 0.6;
                ctx.globalAlpha = opacity;

                const barColor = color === '#ff4d4d' ? '#FF6F00' : color; // Override red to Keneya Orange

                gradient.addColorStop(0, barColor);
                gradient.addColorStop(0.5, '#FFFFFF');
                gradient.addColorStop(1, barColor);

                ctx.fillStyle = gradient;

                // Ombre pour l'effet de lueur (Glow)
                ctx.shadowBlur = 15;
                ctx.shadowColor = barColor;

                // Centrage vertical
                const y = (canvas.height - barHeight) / 2;
                const radius = barWidth / 2;

                // Dessin des barres arrondies
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(x, y, barWidth - 3, barHeight, radius);
                } else {
                    // Fallback
                    ctx.rect(x, y, barWidth - 3, barHeight);
                }
                ctx.fill();

                x += barWidth;
            }
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
        };

        renderFrame();
    };

    return (
        <div className="w-full h-16 flex items-center justify-center overflow-hidden">
            <canvas
                ref={canvasRef}
                width={300}
                height={60}
                className="w-full max-w-xs h-full"
            />
        </div>
    );
}
