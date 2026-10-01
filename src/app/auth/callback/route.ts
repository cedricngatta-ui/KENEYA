import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    // Redirection après succès - Le proxy se chargera de router vers le bon dashboard
    const response = NextResponse.redirect(new URL('/pro/login', request.url))

    if (code) {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        // Les cookies de session doivent être posés sur la réponse, sinon la session est perdue
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
            console.error('Auth callback error:', error)
            return NextResponse.redirect(new URL('/pro/login?error=auth', request.url))
        }
    }

    return response
}
