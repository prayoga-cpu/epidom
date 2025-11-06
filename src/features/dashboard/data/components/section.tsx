"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PillsList } from "./pills-list";
import { DetailsPanel } from "./details-panel";

// Generic item type for display components
type Item = {
  id: string;
  name: string;
  [key: string]: any;
};

interface SectionProps {
  items: Item[];
  label: string;
}

export function Section({ items, label }: SectionProps) {
  const [selected, setSelected] = useState<string | undefined>(items[0]?.id);
  const selectedItem = items.find((i) => i.id === selected);

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[1fr_380px]">
      <Card className="shadow-md transition-shadow hover:shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <PillsList items={items} onSelect={setSelected} selectedId={selected} />
        </CardContent>
      </Card>
      <DetailsPanel item={selectedItem} />
    </div>
  );
}
