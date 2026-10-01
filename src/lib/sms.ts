/**
 * Service d'envoi de SMS via HSMS.CI
 * Gère l'authentification et le formatage des numéros pour la Côte d'Ivoire
 */

export async function sendSMS(telephone: string, message: string) {
    const url = process.env.HSMS_API_URL;
    const token = process.env.HSMS_TOKEN;
    const clientId = process.env.HSMS_CLIENT_ID;
    const clientSecret = process.env.HSMS_CLIENT_SECRET;

    if (!url || !token || !clientId || !clientSecret) {
        console.error("Configuration SMS manquante dans les variables d'environnement.");
        return { success: false, error: "Configuration manquante" };
    }

    // Formatage du numéro : doit être 225 + 10 chiffres
    let formattedPhone = telephone.replace(/\D/g, '');
    if (formattedPhone.length === 10) {
        formattedPhone = '225' + formattedPhone;
    } else if (formattedPhone.length === 8) {
        // Fallback anciens numéros (rare mais au cas où)
        formattedPhone = '22501' + formattedPhone;
    }

    try {
        const params = new URLSearchParams();
        params.append('clientid', clientId);
        params.append('clientsecret', clientSecret);
        params.append('telephone', formattedPhone);
        params.append('message', message);
        params.append('unicode', 'true');
        // Préciser l'expéditeur selon les différents formats d'API possibles (OpenSMS/HSMS)
        params.append('sender_id', 'KENEYA');
        params.append('sender', 'KENEYA');
        params.append('expediteur', 'KENEYA');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
            },
            body: params.toString(),
        });

        // HSMS peut renvoyer du texte brut en cas d'erreur
        const raw = await response.text();
        let result: unknown = raw;
        try { result = JSON.parse(raw); } catch { /* réponse non JSON */ }

        if (!response.ok) {
            console.error("Erreur HSMS.CI:", result);
            return { success: false, error: result, status: response.status };
        }

        return { success: true, data: result };
    } catch (error) {
        console.error("Exception lors de l'envoi SMS:", error);
        return { success: false, error: error };
    }
}
