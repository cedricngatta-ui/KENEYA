import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// KENEYA Middleware v2.2 - User specific structure

export async function proxy(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Skip middleware if Supabase is not configured or uses placeholder
    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your_supabase') || supabaseUrl.includes('placeholder')) {
        return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        supabaseUrl!,
        supabaseKey!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Routes protégées (dashboard & admin)
    const protectedPaths = ['/dashboard', '/admin'];
    const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

    if (isProtected) {
        if (!user) {
            const url = request.nextUrl.clone();
            url.pathname = '/pro/login';
            url.searchParams.set('redirect', pathname);
            return NextResponse.redirect(url);
        }

        // Vérification du rôle pour les routes protégées
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const url = request.nextUrl.clone();

        // Sécurité : Empêcher l'accès croisé aux dashboards
        if (pathname.startsWith('/admin') && userData?.role !== 'admin') {
            url.pathname = '/';
            return NextResponse.redirect(url);
        }

        if (pathname.startsWith('/dashboard/center') && userData?.role !== 'health_center') {
            url.pathname = '/';
            return NextResponse.redirect(url);
        }

        if (pathname.startsWith('/dashboard/agent') && userData?.role !== 'community_agent') {
            url.pathname = '/';
            return NextResponse.redirect(url);
        }
    }

    // Si connecté et tentative d'accès aux pages login/signup, on redirige vers le dashboard approprié
    if (user && (pathname.startsWith('/auth') || pathname.startsWith('/pro'))) {
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        const url = request.nextUrl.clone();
        if (userData?.role === 'admin') {
            url.pathname = '/admin';
            return NextResponse.redirect(url);
        } else if (userData?.role === 'health_center') {
            url.pathname = '/dashboard/center';
            return NextResponse.redirect(url);
        } else if (userData?.role === 'community_agent') {
            url.pathname = '/dashboard/agent';
            return NextResponse.redirect(url);
        }

        return supabaseResponse;
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
