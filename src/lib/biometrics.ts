/**
 * BioMetrics API — Intégration WEB KENEYA
 * ─────────────────────────────────────────────────────
 * Fonctionne dans le navigateur via les APIs Web standard ou fallback
 * vers l'API biometrics.
 */

const API_URL = "https://biometrics-api-production.up.railway.app/api/v1";
const API_KEY = "bm_dfe4ae679462d9e8dc133e0e56649e5358bb42ec9656b34";

const _fetch = async (endpoint: string, options: RequestInit = {}) => {
    try {
        const res = await fetch(`${API_URL}${endpoint}`, {
            headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
            // Le scan ne doit jamais rester bloqué si l'API externe ne répond pas
            signal: AbortSignal.timeout(5000),
            ...options,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Erreur API BioMetrics");
        return data;
    } catch (error) {
        console.warn("BioMetrics API warning:", error);
        // En cas d'erreur réseau (CORS, serveur déconnecté, etc.), 
        // on lève l'exception pour que l'interface puisse éventuellement passer en mode "dégradé/simulation".
        throw error;
    }
};

/**
 * Envoyer une température saisie manuellement par l'utilisateur.
 * @param value - Température saisie par l'utilisateur (°C)
 * @param notes - Note optionnelle
 */
export const saveTemperature = async (value: number, notes: string = "") => {
    return await _fetch("/measurements/submit", {
        method: "POST",
        body: JSON.stringify({ type: "temperature", value, notes }),
    });
};

/**
 * Envoyer une fréquence cardiaque mesurée.
 * @param value - Fréquence cardiaque (BPM)
 * @param notes - Note optionnelle
 */
export const saveHeartRate = async (value: number, notes: string = "") => {
    return await _fetch("/measurements/submit", {
        method: "POST",
        body: JSON.stringify({ type: "heart_rate", value, notes }),
    });
};

/**
 * Envoyer une fréquence respiratoire mesurée.
 * @param value - Fréquence respiratoire (Respirations par minute)
 * @param notes - Note optionnelle
 */
export const saveRespiratoryRate = async (value: number, notes: string = "") => {
    return await _fetch("/measurements/submit", {
        method: "POST",
        body: JSON.stringify({ type: "respiratory_rate", value, notes }),
    });
};
