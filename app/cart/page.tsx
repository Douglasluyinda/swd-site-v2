"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { Button } from "@/components/Button";
import { PageHero } from "@/components/PageHero";

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, shippingTotal, total } =
    useCart();

  if (items.length === 0) {
    return (
      <PageHero
        eyebrow="Cart"
        title="Your cart is empty"
        description="Browse the SWD Access catalogue to find something for your cart."
      >
        <Button href="/products">Browse products</Button>
      </PageHero>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-navy">
        Your cart
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="divide-y divide-border rounded-xl border border-border bg-white">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.variantId ?? "base"}`}
              className="flex gap-4 p-4 sm:p-5"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-light">
                <Image src={item.image} alt={item.title} fill className="object-contain p-2" />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/products/${item.slug}`}
                      className="font-medium text-navy hover:underline"
                    >
                      {item.title}
                    </Link>
                    {item.variantName && (
                      <p className="text-sm text-slate">{item.variantName}</p>
                    )}
                  </div>
                  <p className="font-medium text-navy">
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-border-strong">
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.variantId, item.quantity - 1)
                      }
                      className="px-2.5 py-1 text-navy"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.variantId, item.quantity + 1)
                      }
                      className="px-2.5 py-1 text-navy"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId, item.variantId)}
                    className="text-sm text-slate hover:text-navy"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit rounded-xl border border-border bg-white p-6">
          <p className="text-lg font-semibold text-navy">Order summary</p>
          <div className="mt-4 space-y-2 text-[15px]">
            <div className="flex justify-between text-slate">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate">
              <span>Shipping</span>
              <span>${shippingTotal.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold text-navy">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
          <Button href="/checkout" className="mt-6 w-full">
            Checkout
          </Button>
        </div>
      </div>
    </section>
  );
}
