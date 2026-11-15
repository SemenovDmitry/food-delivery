import { Suspense } from "react";
import Link from "next/link";
import { cacheLife } from "next/cache";

/** Год в кеше — `new Date()` разрешён только внутри 'use cache' (§5.3) */
async function FooterYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function Footer() {
  return (
    <footer className="border-t py-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row">
        <p>
          ©{" "}
          <Suspense fallback="2026">
            <FooterYear />
          </Suspense>{" "}
          Food Delivery — учебный проект
        </p>
        <nav aria-label="Навигация в подвале">
          <ul className="flex gap-4">
            <li>
              <Link href="/" className="hover:underline">
                Меню
              </Link>
            </li>
            <li>
              <Link href="/promo" className="hover:underline">
                Акции
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
