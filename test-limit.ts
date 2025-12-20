import { getStoreLimit, canCreateStore } from "./src/config/stripe.config";

console.log("Testing Limit Logic:");
console.log("PRO Limit:", getStoreLimit("PRO"));
console.log("Is 999 < Infinity?", canCreateStore("PRO", 999));

console.log("STARTER Limit:", getStoreLimit("STARTER"));
console.log("Is 0 < 1?", canCreateStore("STARTER", 0));
console.log("Is 1 < 1?", canCreateStore("STARTER", 1));

// Test with Prisma-like string (just to be sure)
const prismaPlan = "PRO";
console.log("Prisma 'PRO' Limit:", getStoreLimit(prismaPlan as any));
