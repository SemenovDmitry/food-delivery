import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { MenuNav } from "@/components/shop/menu-nav";
import { ProductCard } from "@/components/shop/product-card";
import { PromoCard } from "@/components/shop/promo-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getFullMenu, type MenuCategory } from "@/queries/menu";
import { getActivePromotions } from "@/queries/promotions";

/**
 * Главная = меню (§6/§8): «Акции недели» в Suspense, sticky-навигация с scrollspy,
 * поиск `?q` через searchParams в Suspense. Кешируемая оболочка + динамические скоупы.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <main id="main-content">
      <section aria-labelledby="promos-heading" className="mx-auto max-w-6xl px-4 pt-6">
        <div className="flex items-baseline justify-between">
          <h2 id="promos-heading" className="text-2xl font-bold">
            Акции недели
          </h2>
          <Link href="/promo" className="text-sm text-primary hover:underline">
            все →
          </Link>
        </div>
        <Suspense fallback={<PromosSkeleton />}>
          <PromotionsRibbon />
        </Suspense>
      </section>

      <Suspense fallback={<MenuSkeleton />}>
        <MenuSection searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** Окно дат — фильтр на чтении ВНЕ кеша (§5.3), поэтому секция динамическая */
async function PromotionsRibbon() {
  const promos = await getActivePromotions();

  if (promos.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">Сейчас активных акций нет</p>;
  }

  return (
    <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
      {promos.map((promo) => (
        <PromoCard key={promo.id} promo={promo} />
      ))}
    </div>
  );
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function MenuSection({ searchParams }: { searchParams: SearchParams }) {
  // runtime-граница ДО кеш-запросов: на пререндере сборки нет БД — меню наполняется кешем на первом запросе (§5.3)
  await connection();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";

  const menu = await getFullMenu();
  const filtered: MenuCategory[] = query
    ? menu
        .map((cat) => ({
          ...cat,
          products: cat.products.filter((p) => p.name.toLowerCase().includes(query)),
        }))
        .filter((cat) => cat.products.length > 0)
    : menu;

  return (
    <div>
      {/* пилюли только для присутствующих секций — иначе при ?q якоря ведут в никуда */}
      <MenuNav categories={filtered.map(({ slug, name }) => ({ slug, name }))} />

      <div className="mx-auto max-w-6xl px-4 pb-16">
        <h1 className="sr-only">Меню доставки</h1>

        {/* Нативная GET-форма поиска (§11); <search> — семантический лендмарк */}
        <search className="flex gap-2 py-4">
          <form action="/" method="get" className="flex flex-1 gap-2">
            <Input
              type="search"
              name="q"
              defaultValue={query}
              aria-label="Поиск по меню"
              placeholder="Найти в меню…"
            />
            <Button type="submit">Найти</Button>
            {query ? (
              <Button type="button" variant="ghost" asChild>
                <Link href="/">Сбросить</Link>
              </Button>
            ) : null}
          </form>
        </search>

        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {query
            ? filtered.length > 0
              ? `Найдено разделов: ${filtered.length}`
              : `Ничего не найдено по запросу «${query}»`
            : ""}
        </p>

        {filtered.map((category) => (
          <section
            key={category.slug}
            id={category.slug}
            aria-labelledby={`${category.slug}-heading`}
            className="scroll-mt-32 border-t py-6 first:border-t-0"
          >
            <h2 id={`${category.slug}-heading`} className="mb-4 text-xl font-bold">
              {category.name}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function PromosSkeleton() {
  return (
    <div className="mt-3 flex gap-3 pb-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-56 rounded-xl" />
      ))}
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4" aria-hidden>
      <Skeleton className="my-4 h-10 w-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
