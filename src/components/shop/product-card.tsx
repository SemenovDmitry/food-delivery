import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/shop/add-to-cart-button";
import { PriceLine } from "@/components/shop/price-line";
import type { MenuProduct } from "@/queries/menu";

/**
 * Серверная карточка товара: фото из MinIO или emoji-фолбэк,
 * у сетов — зачёркнутая старая цена (setOldPrice из set_items) и бейдж выгоды.
 * Кликабельны только медиа и название — кнопка не вложена в ссылку (a11y).
 */
export function ProductCard({ product }: { product: MenuProduct }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border">
      <Link
        href={`/product/${product.id}`}
        className="flex h-36 items-center justify-center bg-muted text-5xl"
        aria-label={`Открыть «${product.name}»`}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={288}
            height={144}
            className="size-full object-cover"
          />
        ) : (
          <span aria-hidden>{product.emoji}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="font-semibold">
          <Link href={`/product/${product.id}`} className="transition-colors hover:text-primary">
            {product.name}
          </Link>
        </h3>
        {product.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        ) : null}
        {product.type === "set" && product.setComponents.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Состав:{" "}
            {product.setComponents
              .map((c) => `${c.name}${c.qty > 1 ? ` ×${c.qty}` : ""}`)
              .join(", ")}
          </p>
        ) : null}
        <div className="mt-auto pt-2">
          <PriceLine price={product.price} oldPrice={product.setOldPrice} />
        </div>
        <div className="pt-2">
          <AddToCartButton productId={product.id} fullWidth />
        </div>
      </div>
    </article>
  );
}
