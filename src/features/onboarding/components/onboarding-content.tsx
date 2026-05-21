"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  ArrowRight,
  Loader2,
  Building2,
  Image as ImageIcon,
  MenuSquare,
  Palette,
  Rocket
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { storefrontApi } from "@/lib/api";

const CONTAINER_STYLES = "flex min-h-screen flex-col items-center justify-center bg-slate-50/50 px-4 py-12 md:px-8";
const CONTENT_WRAPPER_STYLES = "animate-in fade-in slide-in-from-bottom-4 w-full max-w-2xl duration-700";
const CARD_STYLES = "overflow-hidden border-0 shadow-2xl ring-1 ring-slate-200/60";
const CARD_CONTENT_STYLES = "p-8 md:p-12";
const INPUT_STYLES = "h-12 rounded-xl border-slate-200 bg-white px-4 text-sm transition-all focus:ring-2 focus:ring-orange-500/20";
const BUTTON_STYLES = "group bg-orange-500 hover:bg-orange-600 h-12 w-full rounded-xl text-sm font-semibold text-white shadow-lg transition-all";

export function OnboardingContent() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = useSession();
  const isAuthenticated = !isSessionPending && !!session?.user;

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [themeColor, setThemeColor] = useState("#FF6B35");
  const [menuItems, setMenuItems] = useState([
    { name: "Nasi Goreng Spesial", price: 25000 },
    { name: "Es Teh Manis", price: 5000 },
    { name: "Kerupuk Udang", price: 3000 }
  ]);

  // Load profile to skip onboarding or set defaults
  useEffect(() => {
    async function checkProfile() {
      if (!isAuthenticated) return;
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const { data } = await res.json();
          if (data?.business?.id) {
            setStoreId(data.business.id);
          }
          // If storefront is already published, skip
          if (data?.business?.storefront?.isPublished) {
            router.push("/dashboard");
          }
        }
      } catch (error) {}
    }
    checkProfile();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isSessionPending && !isAuthenticated) {
      router.push("/login?callbackUrl=/onboarding");
    }
  }, [isSessionPending, isAuthenticated, router]);

  const handleCreateBusiness = async () => {
    if (!name.trim()) return toast.error("Nama toko wajib diisi");
    
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/user/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: "Online" }),
      });
      if (res.ok) {
        const { data } = await res.json();
        setStoreId(data.id);
        
        // Also update the storefront draft
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        await storefrontApi.updateStorefront(data.id, { 
          displayName: name, 
          tagline,
          slug,
          isPublished: false
        } as any);
        
        setStep(2);
      }
    } catch (e) {
      toast.error("Gagal membuat profil toko");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateLogo = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/generate-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, themeColor }),
      });
      if (res.ok) {
        const svgContent = await res.text();
        const base64Svg = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
        setLogoUrl(base64Svg);
        
        // Asynchronously request AI menu items while we wait
        fetch("/api/onboarding/suggest-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, tagline }),
        }).then(res => res.json()).then(resData => {
           if (resData?.data?.length > 0) {
             setMenuItems(resData.data);
           }
        }).catch(err => console.error("Menu suggestion error", err));

      } else {
         toast.error("Gagal generate logo AI");
      }
    } catch (e) {
      toast.error("Gagal generate logo AI");
    } finally {
      setStep(3);
      setIsSubmitting(false);
    }
  };

  const handleSaveMenu = async () => {
    if (!storeId) return;
    setIsSubmitting(true);
    try {
      // Create a default category
      const categoryRes = await storefrontApi.createCategory(storeId, { name: "Rekomendasi", displayOrder: 0 });
      const categoryId = categoryRes.data?.id;

      if (categoryId) {
        for (const item of menuItems) {
          await storefrontApi.createItem(storeId, {
            name: item.name,
            price: item.price,
            categoryId: categoryId,
            isAvailable: true
          } as any);
        }
      }
      setStep(4);
    } catch (e) {
      toast.error("Gagal menyimpan menu");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!storeId) return;
    setIsSubmitting(true);
    try {
      await storefrontApi.updateStorefront(storeId, { 
        themeColor,
        isPublished: true,
        logoUrl
      } as any);
      toast.success("Toko berhasil diterbitkan!");
      router.push("/storefront");
    } catch (e) {
      toast.error("Gagal menerbitkan toko");
    } finally {
      setIsSubmitting(false);
    }
  };

  const Header = ({ stepNum, title, subtitle, icon: Icon }: any) => (
    <div className="mb-8 text-center">
      <div className="flex justify-center mb-6">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={cn("h-1.5 w-8 rounded-full transition-all", s <= stepNum ? "bg-orange-500" : "bg-slate-200")} />
          ))}
        </div>
      </div>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
        <Icon className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
    </div>
  );

  if (isSessionPending) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  return (
    <div className={CONTAINER_STYLES}>
      <div className={CONTENT_WRAPPER_STYLES}>
        <Card className={CARD_STYLES}>
          <CardContent className={CARD_CONTENT_STYLES}>
            
            {/* STEP 1: Basic Info */}
            {step === 1 && (
              <div className="space-y-6">
                <Header stepNum={1} icon={Building2} title="Mulai Buat Toko Anda" subtitle="Beritahu kami nama usaha Anda." />
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Nama Toko / Usaha</label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Kedai Kopi Senja" className={INPUT_STYLES} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold mb-2 block">Tagline (Opsional)</label>
                    <Input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Contoh: Kopi enak harga bersahabat" className={INPUT_STYLES} />
                  </div>
                </div>
                <Button onClick={handleCreateBusiness} disabled={isSubmitting || !name} className={BUTTON_STYLES}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Lanjutkan"}
                </Button>
              </div>
            )}

            {/* STEP 2: Logo */}
            {step === 2 && (
              <div className="space-y-6">
                <Header stepNum={2} icon={ImageIcon} title="Logo Toko" subtitle="Kami bisa membuatkan logo AI untuk Anda, atau Anda bisa lewati." />
                <div className="flex flex-col items-center justify-center py-6">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Logo" className="w-32 h-32 rounded-full border-4 border-slate-100 shadow-md" />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-dashed">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" onClick={() => setStep(3)} className="h-12 rounded-xl">Lewati</Button>
                  <Button onClick={handleGenerateLogo} disabled={isSubmitting} className="h-12 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Buat AI Logo"}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Menu */}
            {step === 3 && (
              <div className="space-y-6">
                <Header stepNum={3} icon={MenuSquare} title="Menu Utama" subtitle="Tambahkan 3 menu jagoan Anda (bisa diubah nanti)." />
                <div className="space-y-3">
                  {menuItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input 
                        value={item.name} 
                        onChange={(e) => {
                          const newItems = [...menuItems];
                          newItems[idx].name = e.target.value;
                          setMenuItems(newItems);
                        }}
                        placeholder="Nama menu"
                        className="flex-1 rounded-lg"
                      />
                      <Input 
                        type="number"
                        value={item.price} 
                        onChange={(e) => {
                          const newItems = [...menuItems];
                          newItems[idx].price = Number(e.target.value);
                          setMenuItems(newItems);
                        }}
                        placeholder="Harga"
                        className="w-32 rounded-lg"
                      />
                    </div>
                  ))}
                </div>
                <Button onClick={handleSaveMenu} disabled={isSubmitting} className={BUTTON_STYLES}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Simpan Menu"}
                </Button>
              </div>
            )}

            {/* STEP 4: Theme */}
            {step === 4 && (
              <div className="space-y-6">
                <Header stepNum={4} icon={Palette} title="Pilih Tema" subtitle="Warna utama untuk toko online Anda." />
                <div className="flex justify-center gap-4 py-4">
                  {['#FF6B35', '#2563EB', '#16A34A', '#E11D48', '#9333EA', '#000000'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setThemeColor(color)}
                      className={cn(
                        "w-12 h-12 rounded-full border-2 transition-all",
                        themeColor === color ? "border-slate-900 scale-110 shadow-lg" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <Button onClick={() => setStep(5)} className={BUTTON_STYLES}>Lanjutkan</Button>
              </div>
            )}

            {/* STEP 5: Publish */}
            {step === 5 && (
              <div className="space-y-6">
                <Header stepNum={5} icon={Rocket} title="Siap Diterbitkan!" subtitle="Toko online Anda sudah siap dibagikan ke pelanggan." />
                <div className="bg-slate-50 p-6 rounded-2xl text-center border border-dashed">
                  <h3 className="font-bold text-lg mb-1">{name}</h3>
                  <p className="text-slate-500 text-sm mb-4">{tagline}</p>
                  <div className="w-full h-32 bg-slate-200 rounded-xl mb-4 overflow-hidden" style={{ backgroundColor: themeColor + '20' }}>
                     <div className="w-full h-10" style={{ backgroundColor: themeColor }}></div>
                     <div className="p-4 flex gap-2">
                       <div className="w-12 h-12 bg-white rounded shadow-sm"></div>
                       <div className="flex-1 space-y-2 py-1">
                         <div className="h-2 bg-white rounded w-3/4"></div>
                         <div className="h-2 bg-white rounded w-1/2"></div>
                       </div>
                     </div>
                  </div>
                </div>
                <Button onClick={handlePublish} disabled={isSubmitting} className={BUTTON_STYLES}>
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Terbitkan Sekarang"}
                  {!isSubmitting && <ArrowRight className="ml-2 w-4 h-4" />}
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
