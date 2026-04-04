import { useEffect, useMemo, useState } from 'react'
import { exchangeAuthCode } from './auth/api'
import { getBrowserAuthSupabaseClient } from './auth/client'
import { getDefaultPostAuthPath, normalizeNextPath } from './auth/redirects'
import logoImage from './assets/logo.png'
import { replaceBrowserLocation } from './lib/browserNavigation'

function getNextPathFromLocationSearch(search: string) {
  return normalizeNextPath(new URLSearchParams(search).get('next'))
}

export function AuthCallbackPage() {
  const nextPath = useMemo(
    () =>
      typeof window === 'undefined'
        ? getDefaultPostAuthPath()
        : getNextPathFromLocationSearch(window.location.search),
    [],
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function completeAuth() {
      if (typeof window === 'undefined') {
        return
      }

      const searchParams = new URLSearchParams(window.location.search)
      const authError =
        searchParams.get('error_description')?.trim() ||
        searchParams.get('error')?.trim()

      if (authError) {
        throw new Error(authError)
      }

      const code = searchParams.get('code')?.trim()

      if (code) {
        await exchangeAuthCode(code)

        if (!isCancelled) {
          replaceBrowserLocation(nextPath)
        }
        return
      }

      const authClient = getBrowserAuthSupabaseClient()
      const { data, error } = await authClient.auth.getSession()

      if (error) {
        throw new Error(error.message || 'Nao foi possivel validar a sessao atual.')
      }

      if (!data.session?.user) {
        throw new Error('Nao foi possivel restaurar sua sessao. Tente entrar novamente.')
      }

      if (!isCancelled) {
        replaceBrowserLocation(nextPath)
      }
    }

    void completeAuth().catch((error) => {
      if (isCancelled) {
        return
      }

      console.error('Could not finish the auth callback.', error)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nao foi possivel concluir o login agora.',
      )
    })

    return () => {
      isCancelled = true
    }
  }, [nextPath])

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--surface)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,0,0,0.06),transparent_28%),radial-gradient(circle_at_92%_14%,rgba(0,0,0,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.35),rgba(243,243,244,0.85)_44%,rgba(255,255,255,0.8)_100%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[980px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="px-5 py-5 sm:px-6 sm:py-6">
          <a href="/" className="flex w-fit items-center">
            <img
              src={logoImage}
              alt="Prompt Archive"
              draggable={false}
              className="h-7 w-auto object-contain sm:h-12"
            />
          </a>
        </header>

        <section className="mx-auto flex w-full max-w-[760px] flex-1 items-center justify-center py-10">
          <div className="w-full rounded-[8px] bg-[var(--surface-low)] p-3 sm:p-4 lg:p-5">
            <div className="rounded-[8px] bg-[var(--surface-lowest)] px-6 py-8 text-center sm:px-8 sm:py-10">
              <p className="text-[0.72rem] font-semibold tracking-[0.26em] text-[var(--secondary)] uppercase">
                auth callback
              </p>
              <h1 className="mt-5 text-[clamp(2rem,6vw,4rem)] leading-[0.92] font-black tracking-[-0.06em]">
                {errorMessage ? 'NAO FOI POSSIVEL ENTRAR' : 'CONFIRMANDO LOGIN'}
              </h1>
              <p className="mx-auto mt-5 max-w-[32rem] text-sm leading-6 text-[var(--secondary)] sm:text-base">
                {errorMessage
                  ? errorMessage
                  : 'Restaurando sua sessao e voltando para a pagina anterior.'}
              </p>

              {errorMessage ? (
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <a
                    href={nextPath}
                    className="inline-flex items-center justify-center rounded-[8px] bg-[linear-gradient(135deg,var(--primary),var(--primary-container))] px-5 py-3.5 font-semibold text-[var(--on-primary)] transition hover:opacity-92"
                  >
                    Tentar novamente
                  </a>
                  <a
                    href="/"
                    className="inline-flex items-center justify-center rounded-[8px] bg-[var(--surface-low)] px-5 py-3.5 font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-high)]"
                  >
                    Voltar ao catalogo
                  </a>
                </div>
              ) : (
                <div className="mt-8 inline-flex items-center justify-center rounded-full bg-[var(--surface-low)] px-5 py-3 text-sm font-medium text-[var(--foreground)]">
                  Redirecionando para {nextPath}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
