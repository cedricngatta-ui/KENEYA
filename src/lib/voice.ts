/**
 * Utilitaires pour interpréter ce que l'utilisateur a dit au micro.
 */

const DIGIT_WORDS: Record<string, string> = {
    'zéro': '0', 'zero': '0', 'un': '1', 'une': '1', 'deux': '2', 'trois': '3', 'quatre': '4',
    'cinq': '5', 'six': '6', 'sept': '7', 'huit': '8', 'neuf': '9',
};

// Mots qui entourent souvent le nom ("je m'appelle Marc, mon numéro c'est...")
const FILLER_WORDS = new Set([
    'je', "m'appelle", 'mappelle', 'appelle', 'moi', "c'est", 'cest', 'mon', 'ma', 'nom', 'prénom', 'prenom',
    'est', 'numéro', 'numero', 'téléphone', 'telephone', 'tel', 'et', 'le', 'la', 'de', 'suis', 'bonjour', 'voici', 'alors', 'euh',
]);

/**
 * Extrait un numéro ivoirien (10 chiffres) et un prénom d'une phrase dictée.
 * Gère "+225", les chiffres dictés en lettres et les espaces entre les groupes.
 */
export function extractContact(transcript: string): { name: string; phone: string } | null {
    const words = transcript.toLowerCase().replace(/[,.;:!?]/g, ' ').split(/\s+/).filter(Boolean);

    // Chiffres dictés en lettres -> chiffres
    const digits = words.map(w => DIGIT_WORDS[w] ?? w.replace(/\D/g, '')).join('');

    let phone: string | null = null;
    const withPrefix = digits.match(/(?:00)?225(\d{10})/);
    if (withPrefix) phone = withPrefix[1];
    else {
        const plain = digits.match(/\d{10}/);
        if (plain) phone = plain[0];
    }
    if (!phone) return null;

    const nameWord = words.find(w => !/\d/.test(w) && !DIGIT_WORDS[w] && !FILLER_WORDS.has(w) && w.length > 1);
    const name = nameWord ? nameWord.charAt(0).toUpperCase() + nameWord.slice(1) : 'Citoyen';
    return { name, phone };
}
