/**
 * Service de Synchronisation avec les Sources Officielles (MSHPCMU / INHP)
 * Permet de comparer les signalements citoyens avec les données gouvernementales réelles.
 */

export interface OfficialEpidemicAlert {
    id: string;
    disease: string;
    zone: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    source: 'WebSanté' | 'INHP' | 'COGU';
    startDate: string;
    description: string;
}

const MOCK_OFFICIAL_ALERTS: OfficialEpidemicAlert[] = [
    {
        id: '1',
        disease: 'Dengue',
        zone: 'Abidjan (Cocody, Plateau)',
        severity: 'high',
        source: 'WebSanté',
        startDate: '2026-02-15',
        description: 'Recrudescence de cas de Dengue de type 2 dans les zones urbaines.'
    },
    {
        id: '2',
        disease: 'Mpox',
        zone: 'Grand-Bassam',
        severity: 'medium',
        source: 'INHP',
        startDate: '2026-02-20',
        description: 'Cas isolés signalés aux alentours de Bassam.'
    },
    {
        id: '3',
        disease: 'Choléra',
        zone: 'Abidjan (Adjame)',
        severity: 'critical',
        source: 'COGU',
        startDate: '2026-02-27',
        description: 'Alerte critique : Cluster détecté près des marchés.'
    }
];

export class OfficialDataService {
    /**
     * Vérifie si une maladie est actuellement sous alerte officielle dans une zone donnée
     */
    static async checkAlertMatch(disease: string, zone: string): Promise<OfficialEpidemicAlert | null> {
        // Simulation d'une latence réseau pour le fetch
        await new Promise(resolve => setTimeout(resolve, 800));

        const d = disease.toLowerCase();
        const z = zone.toLowerCase();
        if (!d || !z) return null;

        // La zone officielle est plus précise (ex: "Abidjan (Cocody, Plateau)") : on teste dans les deux sens
        const match = MOCK_OFFICIAL_ALERTS.find(alert => {
            const ad = alert.disease.toLowerCase();
            const az = alert.zone.toLowerCase();
            const diseaseMatch = ad.includes(d) || d.includes(ad);
            const zoneMatch = az.includes(z) || z.includes(az) || alert.zone === 'Toute la Côte d\'Ivoire';
            return diseaseMatch && zoneMatch;
        });

        return match || null;
    }

    /**
     * Récupère toutes les alertes officielles actives
     */
    static async getActiveAlerts(): Promise<OfficialEpidemicAlert[]> {
        return MOCK_OFFICIAL_ALERTS;
    }
}
