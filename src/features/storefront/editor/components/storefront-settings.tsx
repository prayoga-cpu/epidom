"use client";

import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateStorefrontSchema, UpdateStorefrontInput } from "@/lib/validation/storefront.schemas";
import { storefrontApi } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";

interface StorefrontSettingsProps {
  storeId: string;
  initialData: any;
  onSuccess: () => void;
}

export function StorefrontSettings({ storeId, initialData, onSuccess }: StorefrontSettingsProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with initialData, safely mapping null to empty strings where needed
  const form = useForm<any>({
    resolver: zodResolver(updateStorefrontSchema),
    defaultValues: {
      slug: initialData?.slug || "",
      displayName: initialData?.displayName || "",
      tagline: initialData?.tagline || "",
      description: initialData?.description || "",
      logoUrl: initialData?.logoUrl || "",
      heroImageUrl: initialData?.heroImageUrl || "",
      themeColor: initialData?.themeColor || "#FF6B35",
      fontFamily: initialData?.fontFamily || "Inter",
      whatsappNumber: initialData?.whatsappNumber || "",
      instagramUrl: initialData?.instagramUrl || "",
      tiktokUrl: initialData?.tiktokUrl || "",
      gofoodUrl: initialData?.gofoodUrl || "",
      grabfoodUrl: initialData?.grabfoodUrl || "",
      shopeefoodUrl: initialData?.shopeefoodUrl || "",
      googleMapsUrl: initialData?.googleMapsUrl || "",
      customLinks: Array.isArray(initialData?.customLinks) ? initialData.customLinks : [],
      isPublished: initialData?.isPublished ?? false,
      acceptsOrders: initialData?.acceptsOrders ?? false,
    },
  });

  const { fields: linkFields, append: appendLink, remove: removeLink } = useFieldArray({
    control: form.control,
    name: "customLinks",
  });

  const onSubmit = async (data: UpdateStorefrontInput) => {
    setIsSaving(true);
    try {
      await storefrontApi.updateStorefront(storeId, data);
      toast.success("Pengaturan toko berhasil disimpan.");
      onSuccess();
    } catch (error: any) {
      if (error.response?.status === 409) {
        form.setError("slug", { message: "URL ini sudah digunakan toko lain." });
        toast.error("URL tidak tersedia.");
      } else {
        toast.error("Gagal menyimpan pengaturan.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const domain = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${domain}/@${form.watch("slug")}`;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Status / Publish Card */}
        <Card className="border-orange-200 bg-orange-50/30">
          <CardContent className="pt-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Status Publikasi</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-[500px]">
                {form.watch("isPublished") 
                  ? "Toko online Anda sedang aktif dan bisa diakses pelanggan."
                  : "Toko online disembunyikan. Pelanggan tidak bisa mengakses link Anda."}
              </p>
              
              {form.watch("isPublished") && (
                <div className="mt-4 flex items-center gap-3">
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
                    {publicUrl}
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              )}
            </div>
            
            <FormField
              control={form.control}
              name="isPublished"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border p-4 bg-white shadow-sm">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold">Toko Aktif</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Profil & Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Profil Toko</CardTitle>
            <CardDescription>
              Informasi dasar yang akan ditampilkan di halaman toko Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL Toko (Slug)</FormLabel>
                  <FormControl>
                    <div className="flex rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
                      <div className="bg-muted px-3 py-2 text-sm text-muted-foreground border-r flex items-center">
                        epidom.com/@
                      </div>
                      <input
                        {...field}
                        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                        placeholder="nama-toko-anda"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Pilih nama unik untuk link toko Anda.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Tampilan</FormLabel>
                    <FormControl>
                      <Input placeholder="Nama Toko" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tagline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slogan / Tagline</FormLabel>
                    <FormControl>
                      <Input placeholder="Pasti Enak!" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi Singkat</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Jelaskan sedikit tentang toko Anda..." 
                      className="resize-none" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Visual & Tema */}
        <Card>
          <CardHeader>
            <CardTitle>Visual & Tema</CardTitle>
            <CardDescription>
              Sesuaikan warna dan gambar agar sesuai dengan brand Anda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Logo / Avatar</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="heroImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Gambar Latar (Cover)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="themeColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warna Tema</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      <input 
                        type="color" 
                        {...field} 
                        className="h-10 w-16 p-1 border rounded-md cursor-pointer"
                      />
                      <Input {...field} className="font-mono w-32" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Kontak & Order */}
        <Card>
          <CardHeader>
            <CardTitle>Kontak & Order</CardTitle>
            <CardDescription>
              Ke mana pesanan dan pelanggan harus diarahkan?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="whatsappNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor WhatsApp (Untuk Order)</FormLabel>
                  <FormControl>
                    <Input placeholder="08123456789" {...field} />
                  </FormControl>
                  <FormDescription>
                    Pesanan dari pelanggan akan dikirim ke nomor ini.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="instagramUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Instagram URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://instagram.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="googleMapsUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google Maps URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://maps.app.goo.gl/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid md:grid-cols-3 gap-4 pt-2">
              <FormField
                control={form.control}
                name="gofoodUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link GoFood</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="grabfoodUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link GrabFood</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shopeefoodUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link ShopeeFood</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Custom Links */}
        <Card>
          <CardHeader>
            <CardTitle>Link Tambahan (Linktree)</CardTitle>
            <CardDescription>
              Tambahkan link bebas seperti Website, Promo, dsb.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkFields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-3 bg-slate-50 p-3 rounded-lg border">
                <div className="grid flex-1 gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`customLinks.${index}.label`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Judul Link (Cth: Website Resmi)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`customLinks.${index}.url`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeLink(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => appendLink({ label: "", url: "" })}
              className="w-full border-dashed"
            >
              <Plus className="size-4 mr-2" />
              Tambah Link
            </Button>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3 pb-12">
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </Button>
        </div>

      </form>
    </Form>
  );
}
