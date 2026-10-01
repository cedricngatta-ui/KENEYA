import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/requireRole';

const ALLOWED_ROLES = ['citizen', 'community_agent', 'health_center', 'district', 'city_hall', 'admin'];


export async function POST(request: Request) {
    try {
        const auth = await requireRole(['admin']);
        if (!auth.ok) return auth.response;

        const supabaseAdmin = getSupabaseAdmin();
        const body = await request.json();
        const { phone, password, role, language = 'fr' } = body;

        if (typeof phone !== 'string' || typeof password !== 'string' || !phone.trim() || !password) {
            return NextResponse.json({ error: 'Téléphone et mot de passe requis' }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ error: 'Mot de passe trop court (6 caractères minimum)' }, { status: 400 });
        }
        if (role && !ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 });
        }

        const email = `${phone.replace(/\s+/g, '')}@keneya.ci`;

        // 1. Création de l'utilisateur dans Supabase Auth via l'API Admin
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true // Valide l'email directement
        });

        if (authError) {
            console.error('Auth Error:', authError);
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        const userId = authData.user.id;

        // 2. Insertion du profil dans la table 'users'
        const { error: dbError } = await supabaseAdmin
            .from('users')
            .upsert({
                id: userId,
                phone: phone,
                role: role || 'citizen',
                language: language
            });

        if (dbError) {
            console.error('DB Insert Error:', dbError);
            // Rollback : on supprime l'utilisateur Auth pour ne pas laisser de compte orphelin
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return NextResponse.json({ error: "Échec de création du profil (BDD), utilisateur annulé" }, { status: 500 });
        }

        return NextResponse.json({ success: true, user: { id: authData.user.id, email: authData.user.email } });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
