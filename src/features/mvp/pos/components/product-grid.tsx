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

      const matchesCategory =
        !selectedCategory || product.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-muted/30 border-muted focus:bg-background"
          />
        </div>

        {/* Category Pills */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="gap-1.5 rounded-full"
            >
              <Filter className="h-3.5 w-3.5" />
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="gap-1.5 rounded-full"
              >
                <Tag className="h-3.5 w-3.5" />
                {cat}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto -mx-2 px-2">
        {filteredProducts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground py-20">
            <div className="rounded-2xl bg-muted/50 p-6 mb-4">
              <Package className="h-12 w-12 opacity-50" />
            </div>
            <p className="font-medium">No products found</p>
            {products.length === 0 ? (
              <p className="text-sm mt-1">Import products first</p>
            ) : (
              <p className="text-sm mt-1">Try adjusting your search</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 pb-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAdd={() => addItem(product)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
}: {
  product: ProductForPOS;
  onAdd: () => void;
}) {
  const outOfStock = product.currentStock <= 0;
  const lowStock = product.currentStock > 0 && product.currentStock <= 5;

  return (
    <button
      onClick={onAdd}
      disabled={outOfStock}
      className={`group relative flex flex-col rounded-xl border bg-card p-4 text-left transition-all duration-200 ${
        outOfStock
          ? "cursor-not-allowed opacity-50"
          : "hover:border-primary hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 active:scale-[0.98]"
      }`}
    >
      {/* Stock Badge */}
      <Badge
        variant={outOfStock ? "destructive" : lowStock ? "outline" : "secondary"}
        className={`absolute right-2 top-2 text-[10px] font-bold ${
          lowStock ? "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950" : ""
        }`}
      >
        {outOfStock ? "Out of Stock" : `Stock: ${product.currentStock}`}
      </Badge>

      {/* Category */}
      {product.category && (
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {product.category}
        </span>
      )}

      {/* Product Info */}
      <p className="font-semibold leading-snug mt-1 line-clamp-2 group-hover:text-primary transition-colors">
        {product.name}
      </p>
      <p className="text-xs text-muted-foreground mt-1 font-mono">{product.sku}</p>

      {/* Price & Add Button */}
      <div className="mt-auto pt-4 flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-lg font-bold tabular-nums">
            {product.sellingPrice.toLocaleString()}
          </p>
        </div>
        {!outOfStock && (
          <div className="rounded-full bg-primary p-2 text-primary-foreground shadow-md shadow-primary/30 group-hover:scale-110 transition-transform">
            <Plus className="h-4 w-4" />
          </div>
        )}
      </div>
    </button>
  );
}
