"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PriceLine } from "@/components/shop/price-line";
import { formatPrice } from "@/lib/format";
import { MAX_QTY } from "@/lib/constants";
import type { MenuProduct } from "@/queries/menu";

type ProductDetailsProps = {
  product: MenuProduct;
  /** true → рендер внутри модалки (intercepting), закрытие через router.back() */
  asDialog?: boolean;
};

/**
 * Детали товара: два режима (модалка / страница), степпер количества.
 * Фото из MinIO или emoji-фолбэк; у сета — состав и зачёркнутая старая цена.
 */
export function ProductDetails({ product, asDialog = false }: ProductDetailsProps) {
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(true);
  const router = useRouter();

  const content = (
    <div className="flex flex-col gap-4">
      <div className="flex h-44 items-center justify-center rounded-lg bg-muted text-6xl">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={352}
            height={176}
            className="size-full rounded-lg object-cover"
          />
        ) : (
          <span aria-hidden>{product.emoji}</span>
        )}
      </div>

      <PriceLine price={product.price} oldPrice={product.setOldPrice} large />


      {product.description ? (
        <p className="text-sm text-muted-foreground">{product.description}</p>
      ) : null}

      {product.type === "set" && product.setComponents.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Состав</h3>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {product.setComponents.map((component) => (
              <li key={component.productId}>
                {component.name}
                {component.qty > 1 ? ` ×${component.qty}` : ""} —{" "}
                {formatPrice(component.price * component.qty)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Степпер количества; значение озвучивается через aria-live */}
      <div className="flex items-center gap-3">
        <span id="qty-label" className="text-sm text-muted-foreground">
          Количество
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Уменьшить количество"
          disabled={qty <= 1}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
        >
          <Minus aria-hidden className="size-4" />
        </Button>
        <span
          aria-live="polite"
          aria-labelledby="qty-label"
          className="w-8 text-center font-semibold"
        >
          {qty}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Увеличить количество"
          onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
        >
          <Plus aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  );

  if (asDialog) {
    return (
      // open — состояние: Radix закрывает диалог сразу, router.back() синхронизирует URL
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) router.back();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">{product.name}</h1>
      {content}
    </div>
  );
}
