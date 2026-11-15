import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "./index";
import {
  categories,
  products,
  promotions,
  setItems,
  user,
  type Product,
} from "./schema";

/**
 * Идемпотентный сидер: повторный запуск не создаёт дублей.
 * Категории — upsert по slug, продукты — resolve по (category, name),
 * составы сетов — пересоздание, акции — resolve по code (или name для акций без кода),
 * аккаунты — upsert по phoneNumber.
 */

type SeedProduct = {
  name: string;
  price: number; // копейки
  description?: string;
  emoji: string;
  type?: "single" | "set";
};

const SEED_CATEGORIES: { slug: string; name: string; products: SeedProduct[] }[] = [
  {
    slug: "pizza",
    name: "Пицца",
    products: [
      { name: "Маргарита", price: 59000, emoji: "🍕", description: "Томатный соус, моцарелла, базилик" },
      { name: "Пепперони", price: 69000, emoji: "🍕", description: "Пепперони, моцарелла, томатный соус" },
      { name: "Четыре сыра", price: 74000, emoji: "🧀", description: "Моцарелла, дорблю, пармезан, чеддер" },
      { name: "Гавайская", price: 72000, emoji: "🍍", description: "Курица, ананасы, моцарелла" },
      { name: "Дьявол", price: 79000, emoji: "🌶️", description: "Салями, халапеньо, чили-соус" },
      { name: "Ветчина и грибы", price: 68000, emoji: "🍄", description: "Ветчина, шампиньоны, моцарелла" },
      { name: "Барбекю", price: 75000, emoji: "🍖", description: "Свинина барбекю, соус барбекю, красный лук" },
      { name: "Веган", price: 64000, emoji: "🌱", description: "Овощи, веган-сыр, томатный соус" },
    ],
  },
  {
    slug: "shawarma",
    name: "Шаурма",
    products: [
      { name: "Классическая", price: 34000, emoji: "🌯", description: "Курица, свежие овощи, белый соус" },
      { name: "Куриная", price: 32000, emoji: "🌯", description: "Куриное филе, лаваш, соус чесночный" },
      { name: "Сырная", price: 36000, emoji: "🧀", description: "Курица, двойной сыр, томаты" },
      { name: "Острая", price: 35000, emoji: "🌶️", description: "Говядина, острый соус, лук" },
      { name: "Большая", price: 45000, emoji: "🌯", description: "Двойная начинка, 30 см" },
      { name: "Овощная", price: 30000, emoji: "🥬", description: "Овощи, хумус, зелень" },
    ],
  },
  {
    slug: "sets",
    name: "Сеты",
    products: [
      // старая цена = сумма цен компонентов (setOldPrice — computed, §11)
      { name: "Шаурма для двоих", price: 69000, emoji: "🥡", type: "set", description: "2 шаурмы классические + 2 колы 0.5" },
      { name: "Двойная пицца", price: 109000, emoji: "🥡", type: "set", description: "Маргарита + Пепперони" },
      { name: "Компания", price: 199000, emoji: "🍱", type: "set", description: "2 пиццы + 2 шаурмы + 4 колы 0.5" },
    ],
  },
  {
    slug: "drinks",
    name: "Напитки",
    products: [
      { name: "Кола 0.5", price: 9000, emoji: "🥤" },
      { name: "Спрайт 0.5", price: 9000, emoji: "🥤" },
      { name: "Сок апельсиновый 0.3", price: 12000, emoji: "🧃" },
      { name: "Вода без газа 0.5", price: 6000, emoji: "💧" },
    ],
  },
  {
    slug: "desserts",
    name: "Десерты",
    products: [
      { name: "Чизкейк", price: 19000, emoji: "🍰" },
      { name: "Брауни", price: 15000, emoji: "🍫" },
      { name: "Мороженое-рожок", price: 12000, emoji: "🍦" },
    ],
  },
];

/** Составы сетов: [имя сета, [имя компонента, qty]] */
const SEED_SET_ITEMS: { setName: string; items: { productName: string; qty: number }[] }[] = [
  {
    setName: "Шаурма для двоих",
    items: [
      { productName: "Классическая", qty: 2 },
      { productName: "Кола 0.5", qty: 2 },
    ],
  },
  {
    setName: "Двойная пицца",
    items: [
      { productName: "Маргарита", qty: 1 },
      { productName: "Пепперони", qty: 1 },
    ],
  },
  {
    setName: "Компания",
    items: [
      { productName: "Маргарита", qty: 1 },
      { productName: "Пепперони", qty: 1 },
      { productName: "Классическая", qty: 1 },
      { productName: "Куриная", qty: 1 },
      { productName: "Кола 0.5", qty: 4 },
    ],
  },
];

const SEED_PROMOTIONS = [
  {
    name: "−20% на всю шаурму",
    code: "SHAWARMA20",
    discountType: "percent",
    discountValue: 20,
    daysOffset: 30,
  },
  {
    name: "−150 ₽ на сеты",
    code: "COMBO150",
    discountType: "fixed",
    discountValue: 15000,
    daysOffset: 30,
  },
  {
    name: "−300 ₽ на пиццу",
    code: "PIZZA300",
    discountType: "fixed",
    discountValue: 30000,
    daysOffset: 30,
  },
  {
    name: "Счастливые часы −10%",
    code: null,
    discountType: "percent",
    discountValue: 10,
    daysOffset: 7,
  },
];

const SEED_USERS = [
  { name: "Админ", email: "admin@food.local", phone: "+7 999 000-00-01", role: "admin" },
  { name: "Менеджер", email: "manager@food.local", phone: "+7 999 000-00-02", role: "manager" },
  { name: "Клиент Демо", email: "client@food.local", phone: "+7 999 000-00-03", role: "customer" },
];

async function upsertProducts(
  categoryId: number,
  seedProducts: SeedProduct[],
): Promise<Map<string, Product>> {
  const result = new Map<string, Product>();
  const existing = await db
    .select()
    .from(products)
    .where(eq(products.categoryId, categoryId));
  const byName = new Map(existing.map((p) => [p.name, p]));

  for (const sp of seedProducts) {
    const values = {
      categoryId,
      name: sp.name,
      description: sp.description ?? null,
      price: sp.price,
      type: sp.type ?? "single",
      emoji: sp.emoji,
    };
    const found = byName.get(sp.name);
    if (found) {
      const [updated] = await db
        .update(products)
        .set(values)
        .where(eq(products.id, found.id))
        .returning();
      result.set(sp.name, updated);
    } else {
      const [inserted] = await db.insert(products).values(values).returning();
      result.set(sp.name, inserted);
    }
  }
  return result;
}

async function seed() {
  console.log("Seed: старт…");

  // Проход 1: категории и товары (глобальный реестр по имени — имена уникальны)
  const globalProducts = new Map<string, Product>();
  for (const category of SEED_CATEGORIES) {
    const [cat] = await db
      .insert(categories)
      .values({ slug: category.slug, name: category.name })
      .onConflictDoUpdate({ target: categories.slug, set: { name: category.name } })
      .returning();

    const productMap = await upsertProducts(cat.id, category.products);
    for (const [name, product] of productMap) {
      globalProducts.set(name, product);
    }
  }

  // Проход 2: составы сетов — пересоздание (идемпотентно); компоненты из любых категорий
  for (const setDef of SEED_SET_ITEMS) {
    const set = globalProducts.get(setDef.setName);
    if (!set || set.type !== "set") continue;
    await db.delete(setItems).where(eq(setItems.setId, set.id));
    for (const item of setDef.items) {
      const component = globalProducts.get(item.productName);
      if (!component) continue;
      await db.insert(setItems).values({
        setId: set.id,
        productId: component.id,
        qty: item.qty,
      });
    }
  }

  const now = Date.now();
  for (const promo of SEED_PROMOTIONS) {
    const values = {
      name: promo.name,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      isActive: true,
      startsAt: new Date(now - 24 * 60 * 60 * 1000), // окно открыто сутки назад
      endsAt: new Date(now + promo.daysOffset * 24 * 60 * 60 * 1000),
    };
    const found = promo.code
      ? (await db.select().from(promotions).where(eq(promotions.code, promo.code)))[0]
      : (
          await db
            .select()
            .from(promotions)
            .where(and(eq(promotions.name, promo.name), eq(promotions.isActive, true)))
        )[0];
    if (found) {
      await db.update(promotions).set(values).where(eq(promotions.id, found.id));
    } else {
      await db.insert(promotions).values(values);
    }
  }

  for (const u of SEED_USERS) {
    const values = {
      id: randomUUID(),
      name: u.name,
      email: u.email,
      emailVerified: true,
      role: u.role,
      phoneNumber: u.phone,
      phoneNumberVerified: true,
    };
    await db
      .insert(user)
      .values(values)
      .onConflictDoUpdate({
        target: user.phoneNumber,
        set: {
          name: values.name,
          email: values.email,
          emailVerified: values.emailVerified,
          role: values.role,
        },
      });
  }

  console.log("Seed: готово (идемпотентно).");
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed упал:", error);
    process.exit(1);
  });
