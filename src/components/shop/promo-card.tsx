import { Badge } from "@/components/ui/badge";
import type { Promotion } from "@/db/schema";
import { formatDateTime, formatDiscount } from "@/lib/format";

export function PromoCard({ promo }: { promo: Promotion }) {
  return (
    <article className="flex min-w-56 flex-col gap-1 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary">{formatDiscount(promo)}</Badge>
        {promo.code ? (
          <Badge variant="outline" className="font-mono">
            {promo.code}
          </Badge>
        ) : (
          <Badge variant="outline">без кода</Badge>
        )}
      </div>
      <h3 className="text-base font-semibold">{promo.name}</h3>
      {promo.endsAt ? (
        <p className="text-sm text-muted-foreground">до {formatDateTime(promo.endsAt)}</p>
      ) : (
        <p className="text-sm text-muted-foreground">бессрочно</p>
      )}
    </article>
  );
}
