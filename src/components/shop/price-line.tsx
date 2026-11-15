import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";

type PriceLineProps = {
  price: number;
  /** сумма цен компонентов сета — зачёркнутая старая цена */
  oldPrice?: number | null;
  /** карточка — обычный размер, модалка/страница — крупный */
  large?: boolean;
};

/** Цена + зачёркнутая старая + бейдж выгоды — общий блок карточки и деталей (§11) */
export function PriceLine({ price, oldPrice, large = false }: PriceLineProps) {
  const saving = oldPrice !== null && oldPrice !== undefined ? oldPrice - price : null;

  return (
    <div className="flex items-baseline gap-2">
      <span className={large ? "text-2xl font-bold" : "text-lg font-bold"}>
        {formatPrice(price)}
      </span>
      {saving !== null && saving > 0 && oldPrice !== undefined && oldPrice !== null ? (
        <>
          <span className="text-sm text-muted-foreground line-through">
            {formatPrice(oldPrice)}
          </span>
          <Badge variant="secondary">выгода {formatPrice(saving)}</Badge>
        </>
      ) : null}
    </div>
  );
}
