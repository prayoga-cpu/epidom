/**
 * Product Grid Component
 *
 * Premium product cards for POS selection
 */

"use client";

import { useState, useMemo } from "react";
import { Search, Package, Plus, Tag, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "../cart-store";
import type { ProductForPOS } from "../types";

interface ProductGridProps {
  products: ProductForPOS[];
}

export function ProductGrid({ products }: ProductGridProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { addItem } = useCart();

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = !selectedCategory || product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search products by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Category Pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="gap-1.5 rounded-full"
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "secondary" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="gap-1.5 rounded-full"
              >
                {cat}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Product Grid */}
      <div className="-mx-2 flex-1 overflow-y-auto px-2">
        {filteredProducts.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center py-20">
            <div className="bg-muted mb-4 rounded-full p-6">
              <Package className="h-10 w-10 opacity-50" />
            </div>
            <p className="text-lg font-medium">No products found</p>
            {products.length === 0 ? (
              <p className="mt-1 text-sm">Import products first</p>
            ) : (
              <p className="mt-1 text-sm">Try adjusting your search</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-4 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={() => addItem(product)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, onAdd }: { product: ProductForPOS; onAdd: () => void }) {
  const outOfStock = product.currentStock <= 0;
  const lowStock = product.currentStock > 0 && product.currentStock <= 5;

  return (
    <div
      onClick={outOfStock ? undefined : onAdd}
      role="button"
      tabIndex={outOfStock ? -1 : 0}
      onKeyDown={(e) => {
        if (!outOfStock && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onAdd();
        }
      }}
      className={`group bg-card relative flex flex-col rounded-lg border p-4 text-left transition-colors ${
        outOfStock
          ? "cursor-not-allowed opacity-50"
          : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
      }`}
    >
      {/* Stock Badge */}
      <Badge
        variant={outOfStock ? "destructive" : lowStock ? "outline" : "secondary"}
        className={`absolute top-2 right-2 text-[10px] font-bold ${
          lowStock ? "border-amber-500 bg-amber-50 text-amber-600 dark:bg-amber-950" : ""
        }`}
      >
        {outOfStock ? "Out of Stock" : `Stock: ${product.currentStock}`}
      </Badge>

      {/* Category */}
      {product.category && (
        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {product.category}
        </span>
      )}

      {/* Product Info */}
      <p className="group-hover:text-primary mt-1 line-clamp-2 leading-snug font-semibold transition-colors">
        {product.name}
      </p>
      <p className="text-muted-foreground mt-1 font-mono text-xs">{product.sku}</p>

      {/* Price & Add Button */}
      <div className="mt-auto flex items-end justify-between gap-2 pt-4">
        <div>
          <p className="text-muted-foreground text-xs">Price</p>
          <p className="text-lg font-bold tabular-nums">
            {new Intl.NumberFormat("en-US").format(product.sellingPrice)}
          </p>
        </div>
        {!outOfStock && (
          <div className="bg-secondary text-secondary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
            <Plus className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
