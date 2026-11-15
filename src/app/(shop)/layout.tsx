import { Footer } from "@/components/shop/footer";
import { Header } from "@/components/shop/header";

/** Рендерит {children} + слот {modal} — перехват /product/[id] с главной (§11) */
export default function ShopLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      {modal}
      <Footer />
    </div>
  );
}
