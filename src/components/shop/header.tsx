"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

/**
 * Клиентский header (§11): навигация + ThemeToggle + AuthArea на authClient.useSession().
 * Бейдж корзины добавляется в этапе 1 (динамический фрагмент в Suspense).
 */
export function Header() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold">
          <span aria-hidden>🌯</span> Food Delivery
        </Link>

        <nav aria-label="Основная навигация" className="hidden items-center gap-1 sm:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Меню</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/promo">Акции</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/assistant">Ассистент</Link>
          </Button>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {isPending ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" aria-hidden />
          ) : session ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{session.user.name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => authClient.signOut()}
              >
                Выйти
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Войти</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
