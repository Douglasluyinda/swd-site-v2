export default function AdminShippingPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">Shipping</h1>
      <p className="mt-2 max-w-xl text-sm text-slate">
        Carrier rate management and shipping-zone configuration aren&apos;t
        built yet — for now, customer shipping cost is set per product
        (Admin → Products) and tracking is entered manually per order
        (Admin → Orders). Carrier API integration is Phase 3 work.
      </p>
    </div>
  );
}
