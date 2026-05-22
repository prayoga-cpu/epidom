import type { Metadata } from "next";
import { PressClient } from "./client";
export const metadata: Metadata = { title: "Press — EPIDOM", description: "Media kit, press releases and contact for journalists covering Epidom." };
export default function PressPage() { return <PressClient />; }
