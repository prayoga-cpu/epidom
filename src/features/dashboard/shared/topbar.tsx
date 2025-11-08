import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Search, Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { StoreSwitcher } from "./store-switcher";
import { useI18n } from "../../../components/lang/i18n-provider";
import LangSwitcher from "../../../components/lang/lang-switcher";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import NavUser from "./nav-user";
import { useState } from "react";
import { GlobalSearchDialog } from "./global-search-dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { t } = useI18n();

  return (
    <header
      role="banner"
      className="bg-primary text-primary-foreground navbar-no-transition navbar-static sticky top-0 z-10 w-full rounded-none shadow"
      style={{
        animation: "none !important",
        transition: "none !important",
        transform: "none !important",
        opacity: "1 !important",
      }}
    >
      <div className="mx-auto max-w-7xl px-3">
        <div className="grid h-14 grid-cols-[1fr_minmax(220px,720px)_1fr] items-center gap-3">
          {/* Left: Mobile menu + Logo */}
          <div className="flex items-center gap-2">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-foreground hover:bg-white/10 md:hidden"
                >
                  <Menu className="size-5" />
                  <span className="sr-only">{t("common.nav.openMenu")}</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="h-[100dvh] w-[280px] p-0">
                <Sidebar mode="mobile" />
              </SheetContent>
            </Sheet>
            <div className="flex w-[100px] items-center justify-center rounded-md bg-transparent">
              <Image
                src="/images/logo-white.png"
                alt="EPIDOM logo"
                width={100}
                height={30}
                className="w-auto object-contain"
                priority
              />
            </div>
          </div>

          {/* Center: Search (hidden on mobile, centered on md+) */}
          <div className="hidden w-full items-center justify-end md:flex">
            <Button
              variant="outline"
              className="text-muted-foreground relative h-9 w-80 max-w-xl justify-start rounded-full bg-white text-sm font-normal sm:max-w-2xl"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="mr-2 size-4 shrink-0" />
              <span>{t("actions.searchPlaceholder")}</span>
              <KbdGroup className="absolute right-3 hidden md:flex">
                <Kbd>⌘</Kbd>
                <Kbd>k</Kbd>
              </KbdGroup>
            </Button>
          </div>

          {/* Right: store switcher, language, profile, logout */}
          <div className="ml-auto flex items-center justify-end gap-2">
            {/* Mobile search button */}
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/10 md:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-5" />
              <span className="sr-only">{t("common.nav.searchAriaLabel")}</span>
            </Button>

            {/* Store switcher - hidden on mobile */}
            <div className="hidden sm:block">
              <StoreSwitcher />
            </div>
            {/* Language switcher */}
            <LangSwitcher className="text-foreground hidden border bg-white sm:inline-block" />
            <NavUser />
            <Button
              size="sm"
              variant="ghost"
              className="rounded-xl hover:bg-red-500"
              onClick={() => {
                signOut({ callbackUrl: "/login" });
              }}
            >
              <LogOut className="mr-1 size-4" />
              {t("actions.logout")}
            </Button>
          </div>
        </div>
      </div>

      {/* Global Search Dialog */}
      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
