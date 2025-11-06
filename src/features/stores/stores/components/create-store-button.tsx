"use client";

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface FormFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

function FormField({ id, label, value, onChange, placeholder }: FormFieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-medium sm:text-base">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="h-10 text-sm sm:h-11 sm:text-base"
      />
    </div>
  );
}

export function CreateStoreButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [city, setCity] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement API call to create store

    setStoreName("");
    setCity("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="w-full rounded-full bg-[var(--color-brand-primary)] px-4 py-2.5 text-xs font-medium text-white shadow-md transition-all hover:opacity-90 hover:shadow-lg sm:w-auto sm:px-6 sm:py-3 sm:text-sm md:px-8 md:py-3.5 md:text-base"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4 md:h-5 md:w-5" />
          {t("stores.createStore")}
        </Button>
      </DialogTrigger>
      <DialogContent className="mx-4 max-h-[90vh] overflow-y-auto sm:mx-0 sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold sm:text-2xl">
              {t("stores.createStore")}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              {t("stores.createFirst")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:gap-6 sm:py-6">
            <FormField
              id="storeName"
              label={t("stores.storeName")}
              value={storeName}
              onChange={setStoreName}
              placeholder="Boutique boulangerie n°1"
            />
            <FormField
              id="city"
              label={t("stores.city")}
              value={city}
              onChange={setCity}
              placeholder="Paris"
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full text-sm sm:w-auto sm:text-base"
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              className="w-full bg-[var(--color-brand-primary)] text-sm text-white hover:opacity-90 sm:w-auto sm:text-base"
            >
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
