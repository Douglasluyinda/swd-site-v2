import { db } from "./db/client";
import { orderItems, orders, products, trackingEvents } from "./db/schema";
import { eq } from "drizzle-orm";

export async function getOrderByNumber(orderNumber: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return null;

  const items = await db
    .select({
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      unitSupplierCost: orderItems.unitSupplierCost,
      title: products.title,
      slug: products.slug,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, order.id));

  const events = (
    await db.select().from(trackingEvents).where(eq(trackingEvents.orderId, order.id))
  ).sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  return { order, items, events };
}
