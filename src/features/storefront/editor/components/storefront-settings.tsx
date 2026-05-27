"use client";

import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateStorefrontSchema, UpdateStorefrontInput } from "@/lib/validation/storefront.schemas";
import { storefrontApi } from "@/lib/api";
import { toast } from "sonner";
import { useI18n } from "@/components/lang/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ExternalLink } from "lucide-react";

interface StorefrontSettingsProps {
  storeId: string;
  initialData: any;
  onSuccess: () => void;
}

export function StorefrontSettings({ storeId, initialData, onSuccess }: StorefrontSettingsProps) {
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);

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
      acceptsReservations: initialData?.acceptsReservations ?? false,
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
      toast.success(t("storefront.settings.saveSuccess"));
      onSuccess();
    } catch (error: any) {
      if (error.response?.status === 409) {
        form.setError("slug", { message: t("storefront.settings.urlTaken") });
        toast.error(t("storefront.settings.urlUnavailable"));
      } else {
        toast.error(t("storefront.settings.saveFailed"));
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
              <h3 className="font-semibold text-lg">{t("storefront.settings.publishStatus")}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-[500px]">
                {form.watch("isPublished")
                  ? t("storefront.settings.storeActive")
                  : t("storefront.settings.storeHidden")}
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
                <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border border-border p-4 bg-card shadow-sm">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold">{t("storefront.settings.storeActiveLabel")}</FormLabel>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Profile & Branding */}
        <Card>
          <CardHeader>
            <CardTitle>{t("storefront.settings.profileSection")}</CardTitle>
            <CardDescription>{t("storefront.settings.profileDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("storefront.settings.slugLabel")}</FormLabel>
                  <FormControl>
                    <div className="flex rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
                      <div className="bg-muted px-3 py-2 text-sm text-muted-foreground border-r flex items-center">
                        epidom.fr/@
                      </div>
                      <input {...field} className="flex-1 bg-transparent px-3 py-2 text-sm outline-none" placeholder={t("storefront.settings.slugPlaceholder")} />
                    </div>
                  </FormControl>
                  <FormDescription>{t("storefront.settings.slugDesc")}</FormDescription>
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
                    <FormLabel>{t("storefront.settings.displayName")}</FormLabel>
                    <FormControl><Input placeholder={t("storefront.settings.displayNamePlaceholder")} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tagline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("storefront.settings.tagline")}</FormLabel>
                    <FormControl><Input placeholder={t("storefront.settings.taglinePlaceholder")} {...field} /></FormControl>
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
                  <FormLabel>{t("storefront.settings.description")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("storefront.settings.descriptionPlaceholder")} className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Visual & Theme */}
        <Card>
          <CardHeader>
            <CardTitle>{t("storefront.settings.visualSection")}</CardTitle>
            <CardDescription>{t("storefront.settings.visualDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("storefront.settings.logoUrl")}</FormLabel>
                    <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heroImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("storefront.settings.heroImageUrl")}</FormLabel>
                    <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                    <FormDescription>Recommended: 16:9 ratio — min 1200×675px, ideal 1920×1080px</FormDescription>
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
                  <FormLabel>{t("storefront.settings.themeColor")}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      <input type="color" {...field} className="h-10 w-16 p-1 border rounded-md cursor-pointer" />
                      <Input {...field} className="font-mono w-32" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Contact & Orders */}
        <Card>
          <CardHeader>
            <CardTitle>{t("storefront.settings.contactSection")}</CardTitle>
            <CardDescription>{t("storefront.settings.contactDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="whatsappNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("storefront.settings.whatsappNumber")}</FormLabel>
                  <FormControl>
                    <div className="flex rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
                      <div className="bg-muted px-3 py-2 text-sm text-muted-foreground border-r flex items-center select-none">
                        +
                      </div>
                      <input
                        {...field}
                        inputMode="numeric"
                        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                        placeholder="628123456789"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Include country code without +. Example: 628123456789 (Indonesia)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <FormField control={form.control} name="instagramUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Instagram URL</FormLabel>
                  <FormControl><Input placeholder="https://instagram.com/..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="googleMapsUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Google Maps URL</FormLabel>
                  <FormControl><Input placeholder="https://maps.app.goo.gl/..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid md:grid-cols-3 gap-4 pt-2">
              <FormField control={form.control} name="gofoodUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("storefront.settings.gofoodUrl")}</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="grabfoodUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("storefront.settings.grabfoodUrl")}</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="shopeefoodUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("storefront.settings.shopeefoodUrl")}</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
        </Card>

        {/* Storefront Features */}
        <Card>
          <CardHeader>
            <CardTitle>Storefront Features</CardTitle>
            <CardDescription>Control what customers can do on your public storefront page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="acceptsOrders"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4 gap-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold">Online Orders</FormLabel>
                    <FormDescription>Let customers place orders directly from your storefront.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="acceptsReservations"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4 gap-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base font-semibold">Table Reservations</FormLabel>
                    <FormDescription>
                      Let customers book a table from your storefront. Enable reservation per-table in{" "}
                      <strong>Operations → Tables</strong>.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Custom Links */}
        <Card>
          <CardHeader>
            <CardTitle>{t("storefront.settings.customLinksSection")}</CardTitle>
            <CardDescription>{t("storefront.settings.customLinksDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkFields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-3 bg-muted/30 p-3 rounded-lg border">
                <div className="grid flex-1 gap-3 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`customLinks.${index}.label`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl><Input placeholder={t("storefront.settings.linkTitlePlaceholder")} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`customLinks.${index}.url`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeLink(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => appendLink({ label: "", url: "" })} className="w-full border-dashed">
              <Plus className="size-4 mr-2" />
              {t("storefront.settings.addLink")}
            </Button>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-12">
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            {t("storefront.settings.cancelButton")}
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t("storefront.settings.savingButton") : t("storefront.settings.saveButton")}
          </Button>
        </div>

      </form>
    </Form>
  );
}
