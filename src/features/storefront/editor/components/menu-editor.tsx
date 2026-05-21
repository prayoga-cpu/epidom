"use client";

import React, { useState } from "react";
import { storefrontApi } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical, Settings2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

// Note: In a complete implementation we would use a drag-and-drop library (like @dnd-kit/core)
// For this MVP phase, we'll provide a simplified list view with Add/Edit/Delete

interface MenuEditorProps {
  storeId: string;
  storefrontId: string;
  categories: any[];
  onSuccess: () => void;
}

export function MenuEditor({ storeId, storefrontId, categories, onSuccess }: MenuEditorProps) {
  const [newCatName, setNewCatName] = useState("");
  const [isAddingCat, setIsAddingCat] = useState(false);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setIsAddingCat(true);
    try {
      await storefrontApi.createCategory(storeId, { name: newCatName, displayOrder: 0 });
      setNewCatName("");
      onSuccess();
      toast.success("Kategori ditambahkan");
    } catch (e) {
      toast.error("Gagal menambahkan kategori");
    } finally {
      setIsAddingCat(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Hapus kategori ini dan semua menunya?")) return;
    try {
      await storefrontApi.deleteCategory(storeId, categoryId);
      onSuccess();
      toast.success("Kategori dihapus");
    } catch (e) {
      toast.error("Gagal menghapus kategori");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Daftar Menu & Kategori</CardTitle>
            <CardDescription>
              Atur urutan kategori dan menu makanan/minuman Anda.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 mb-6">
            <Input 
              placeholder="Nama Kategori Baru (Cth: Minuman Dingin)" 
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleAddCategory} disabled={isAddingCat || !newCatName.trim()}>
              <Plus className="size-4 mr-2" />
              Tambah Kategori
            </Button>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed text-slate-400">
              <p>Belum ada kategori menu.</p>
              <p className="text-sm">Tambahkan kategori pertama Anda untuk mulai.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category.id} className="border rounded-xl overflow-hidden bg-white shadow-sm">
                  {/* Category Header */}
                  <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b">
                    <div className="flex items-center gap-3">
                      <GripVertical className="size-4 text-slate-400 cursor-grab" />
                      <h4 className="font-bold text-slate-800">{category.name}</h4>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                        {category.items?.length || 0} menu
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-500" onClick={() => handleDeleteCategory(category.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Menu Items List */}
                  <div className="p-4 space-y-3">
                    {category.items?.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-400">
                        Belum ada menu di kategori ini.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {category.items?.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:border-slate-300 transition group">
                            <div className="flex items-center gap-4">
                              <GripVertical className="size-4 text-slate-300 cursor-grab group-hover:text-slate-400" />
                              <div className="size-12 bg-slate-100 rounded flex items-center justify-center shrink-0 overflow-hidden">
                                {item.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">Foto</span>
                                )}
                              </div>
                              <div>
                                <h5 className="font-semibold text-sm text-slate-800">{item.name}</h5>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                  <span className="font-medium text-slate-700">Rp {Number(item.price).toLocaleString('id-ID')}</span>
                                  {item.isAvailable ? (
                                    <span className="text-emerald-600">Tersedia</span>
                                  ) : (
                                    <span className="text-rose-500">Habis</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                              <Settings2 className="size-3 mr-1" /> Edit
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button variant="outline" className="w-full mt-2 border-dashed text-slate-500">
                      <Plus className="size-4 mr-2" />
                      Tambah Menu
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
