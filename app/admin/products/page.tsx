import { db } from "@/lib/db/client";
import { categories, products, suppliers } from "@/lib/db/schema";
import { createCategory, createProduct, toggleProductStatus } from "@/lib/admin-actions";

const statusColor: Record<string, string> = {
  published: "bg-green-100 text-green-800",
  draft: "bg-light text-slate",
  archived: "bg-red-100 text-red-700",
};

export default async function AdminProductsPage() {
  const allProducts = await db.select().from(products);
  const allCategories = await db.select().from(categories);
  const allSuppliers = await db.select().from(suppliers);

  const categoryName = (id: string) => allCategories.find((c) => c.id === id)?.name ?? "—";

  async function toggleAction(formData: FormData) {
    "use server";
    await toggleProductStatus(
      formData.get("productId") as string,
      formData.get("nextStatus") as string,
    );
  }

  async function createProductAction(formData: FormData) {
    "use server";
    await createProduct(formData);
  }

  async function createCategoryAction(formData: FormData) {
    "use server";
    await createCategory(formData);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Products</h1>
        <p className="mt-1 text-sm text-slate">
          New products are created as drafts — publish them to show on the storefront.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {allProducts.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-navy">
                  {p.title}
                  {p.isDemo && (
                    <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] text-navy">
                      DEMO
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate">{categoryName(p.categoryId)}</td>
                <td className="px-4 py-3 text-navy">${p.sellingPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-slate">{p.stockStatus}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor[p.status]}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form action={toggleAction}>
                    <input type="hidden" name="productId" value={p.id} />
                    <input
                      type="hidden"
                      name="nextStatus"
                      value={p.status === "published" ? "draft" : "published"}
                    />
                    <button className="text-sm text-blue hover:underline">
                      {p.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {allProducts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate">
                  No products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Add product</p>
          <form action={createProductAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="sku" placeholder="SWD SKU" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="title" placeholder="Title" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <select name="categoryId" required className="rounded-lg border border-border-strong px-3 py-2 text-sm">
              <option value="">Category…</option>
              {allCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select name="supplierId" required className="rounded-lg border border-border-strong px-3 py-2 text-sm">
              <option value="">Supplier…</option>
              {allSuppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input name="supplierSku" placeholder="Supplier SKU" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="supplierStock" type="number" placeholder="Supplier stock" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="supplierCost" type="number" step="0.01" placeholder="Supplier cost ($)" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="supplierShipping" type="number" step="0.01" placeholder="Supplier shipping ($)" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="sellingPrice" type="number" step="0.01" placeholder="Selling price ($)" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="customerShipping" type="number" step="0.01" placeholder="Customer shipping ($)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="deliveryEstimateDays" placeholder="Delivery estimate (e.g. 7-14)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="image" placeholder="Image URL (optional)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <textarea name="description" placeholder="Description" required rows={3} className="sm:col-span-2 rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <button className="sm:col-span-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
              Create product (as draft)
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Add category</p>
          <form action={createCategoryAction} className="mt-3 space-y-2">
            <input name="name" placeholder="Category name" required className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <button className="w-full rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white">
              Add category
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
