import Link from "next/link";
import Image from "next/image";

type ProductCardProps = {
  slug: string;
  title: string;
  image: string;
  price: number;
  currency: string;
  stockStatus: string;
  isDemo?: boolean;
};

const stockLabel: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

export function ProductCard({
  slug,
  title,
  image,
  price,
  currency,
  stockStatus,
  isDemo,
}: ProductCardProps) {
  return (
    <Link
      href={`/products/${slug}`}
      className="group block overflow-hidden rounded-xl border border-border bg-white transition-colors hover:border-navy"
    >
      <div className="relative aspect-square bg-light">
        <Image
          src={image}
          alt={title}
          fill
          className="object-contain p-6"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
        {isDemo && (
          <span className="absolute left-2 top-2 rounded-full bg-navy/90 px-2 py-0.5 text-[10px] font-medium text-white">
            DEMO
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-[15px] font-medium text-navy group-hover:underline">
          {title}
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-lg font-semibold text-navy">
            {currency} {price.toFixed(2)}
          </p>
          <span
            className={`text-xs ${
              stockStatus === "out_of_stock" ? "text-red-600" : "text-slate"
            }`}
          >
            {stockLabel[stockStatus] ?? stockStatus}
          </span>
        </div>
      </div>
    </Link>
  );
}
