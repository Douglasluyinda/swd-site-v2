"use client";

import { useState, type FormEvent } from "react";
import { useCart } from "@/lib/cart/CartContext";
import { Button } from "@/components/Button";

export default function CheckoutPage() {
  const { items, subtotal, shippingTotal, total, clear } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponStatus, setCouponStatus] = useState<"idle" | "checking" | "error">("idle");
  const [couponError, setCouponError] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
        <h1 className="text-2xl font-semibold text-navy">
          Your cart is empty
        </h1>
        <p className="mt-2 text-slate">Add a product before checking out.</p>
        <Button href="/products" className="mt-6">
          Browse products
        </Button>
      </section>
    );
  }

  const finalTotal = Math.max(0, total - (appliedCoupon?.discount ?? 0));

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponStatus("checking");
    setCouponError(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim(), subtotal }),
      });
      const data = await res.json();
      if (!data.valid) {
        setCouponError(data.error ?? "Invalid coupon");
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({ code: data.code, discount: data.discount });
      }
    } catch {
      setCouponError("Couldn't check that code — try again.");
    } finally {
      setCouponStatus("idle");
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const body = {
      fullName: form.get("fullName"),
      email: form.get("email"),
      phone: form.get("phone"),
      country: form.get("country"),
      city: form.get("city"),
      address: form.get("address"),
      deliveryInstructions: form.get("deliveryInstructions"),
      couponCode: appliedCoupon?.code,
      items: items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
        quantity: i.quantity,
      })),
    };

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          data.error ??
            "We couldn't start checkout. Please try again, or contact SWD.",
        );
        setSubmitting(false);
        return;
      }

      clear();
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-navy">
        Checkout
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="fullName" required />
            <Field label="Email" name="email" type="email" required />
            <Field label="Phone" name="phone" required />
            <Field label="Country" name="country" required />
            <Field label="City" name="city" required />
          </div>
          <Field label="Address" name="address" required />
          <div>
            <label
              htmlFor="deliveryInstructions"
              className="mb-1.5 block text-sm font-medium text-navy"
            >
              Delivery instructions (optional)
            </label>
            <textarea
              id="deliveryInstructions"
              name="deliveryInstructions"
              rows={3}
              className="w-full rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[15px] focus:border-blue"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-lg bg-blue px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-blue-dark disabled:opacity-60"
          >
            {submitting ? "Redirecting to payment…" : "Continue to payment"}
          </button>
          <p className="text-xs text-slate">
            You&apos;ll be redirected to Flutterwave to complete payment
            securely. SWD never sees or stores your card details.
          </p>
        </form>

        <div className="h-fit rounded-xl border border-border bg-white p-6">
          <p className="text-lg font-semibold text-navy">Order summary</p>
          <ul className="mt-4 space-y-2 text-sm text-slate">
            {items.map((i) => (
              <li key={`${i.productId}-${i.variantId ?? "base"}`} className="flex justify-between">
                <span>
                  {i.title} × {i.quantity}
                </span>
                <span>${(i.unitPrice * i.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 border-t border-border pt-4">
            {appliedCoupon ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700">
                  Coupon {appliedCoupon.code} applied
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput("");
                  }}
                  className="text-xs text-slate underline"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Coupon code"
                  className="flex-1 rounded-lg border border-border-strong px-3 py-2 text-sm uppercase focus:border-blue"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponStatus === "checking"}
                  className="rounded-lg border border-border-strong px-3 py-2 text-sm text-navy hover:border-navy disabled:opacity-60"
                >
                  {couponStatus === "checking" ? "..." : "Apply"}
                </button>
              </div>
            )}
            {couponError && <p className="mt-1.5 text-xs text-red-600">{couponError}</p>}
          </div>

          <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-[15px]">
            <div className="flex justify-between text-slate">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate">
              <span>Shipping</span>
              <span>${shippingTotal.toFixed(2)}</span>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-green-700">
                <span>Discount</span>
                <span>-${appliedCoupon.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-navy">
              <span>Total</span>
              <span>${finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-navy">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[15px] focus:border-blue"
      />
    </div>
  );
}
