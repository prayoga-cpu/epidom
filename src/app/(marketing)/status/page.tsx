import type { Metadata } from "next";
import { StatusClient } from "./client";
export const metadata: Metadata = { title: "Status — EPIDOM", description: "Live status of Epidom services and infrastructure." };
export default function StatusPage() { return <StatusClient />; }
