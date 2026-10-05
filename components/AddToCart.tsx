"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import { Button } from "@/components/Button";

type AddToCartProps = {
  productId: string;
  slug: string;
  title: string;
  image: string;
  unitPrice: number;
  customerShipping: number;
  variants: { id: string; name: string; priceDelta: number }[];
  outOfStock: boolean;
};

export function AddToCart({
  productId,
  slug,
  title,
  image,
  unitPrice,
  customerShipping,
  variants,
  outOfStock,
}: AddToCartProps) {
  const { addItem } = useCart();
  const router = useRouter();
  const [variantId, setVariantId] = useState(variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === variantId);
  const finalPrice = unitPrice + (variant?.priceDelta ?? 0);

  function buildItem() {
    return {
      productId,
      variantId: variant?.id,
      variantName: variant?.name,
      slug,
      title,
      image,
      unitPrice: finalPrice,
      customerShipping,
      quantity,
    };
  }

  function handleAdd() {
    addItem(buildItem());
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  function handleBuyNow() {
    addItem(buildItem());
    router.push("/checkout");
  }

  if (outOfStock) {
    return (
      <div className="rounded-lg border border-border-strong bg-light px-4 py-3 text-sm text-slate">
        Currently out of stock. Contact us to be notified when it&apos;s back.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {variants.length > 0 && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-navy">
            Variant
          </label>
          <select
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="w-full rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[15px] focus:border-blue"
          >
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-navy">Quantity</label>
        <div className="flex items-center rounded-lg border border-border-strong">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-1.5 text-lg text-navy"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-8 text-center text-[15px]">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            className="px-3 py-1.5 text-lg text-navy"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleAdd} variant="secondary" type="button">
          {added ? "Added ✓" : "Add to cart"}
        </Button>
        <Button onClick={handleBuyNow} type="button">
          Buy now
        </Button>
      </div>
    </div>
  );
}
