import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductDetails } from "@/components/shop/product-details";
import { getProduct } from "@/queries/menu";

/**
 * Intercepting route: перехват /product/[id] с главной → модалка товара (§8).
 * params — динамическое чтение: оболочка в Suspense, await params — внизу (§5.3).
 */
export default function InterceptedProductPage({
  params,
}: PageProps<"/product/[id]">) {
  return (
    <Suspense fallback={<ProductDetailsSkeleton />}>
      <InterceptedProduct params={params} />
    </Suspense>
  );
}

async function InterceptedProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return <ProductDetails product={product} asDialog />;
}

function ProductDetailsSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4" aria-hidden>
      <Skeleton className="h-44 w-full rounded-lg" />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
