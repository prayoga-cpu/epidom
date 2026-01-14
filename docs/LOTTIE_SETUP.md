# Lottie Animation Setup

## Installation Required

Untuk menggunakan Lottie animations, Anda perlu menginstall package `lottie-web`:

```bash
npm install lottie-web
```

Atau jika menggunakan yarn:

```bash
yarn add lottie-web
```

Atau jika menggunakan pnpm:

```bash
pnpm add lottie-web
```

## Catatan

Jika mengalami masalah dengan execution policy di PowerShell Windows, jalankan:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Kemudian coba install lagi.

## Fallback Behavior

Komponen `LottieLoader` sudah dilengkapi dengan fallback SVG spinner. Jadi meskipun `lottie-web` belum terinstall, aplikasi tetap bisa berjalan dengan spinner standar.

Setelah `lottie-web` terinstall, semua loading spinners akan otomatis menggunakan animasi Lottie yang lebih smooth dan menarik.

## Usage

```tsx
import { LottieLoader, LottieLoaderCentered } from "@/components/ui/lottie-loader";

// Small inline loader
<LottieLoader size="sm" className="mr-2" />

// Large centered loader
<LottieLoaderCentered size="lg" message="Loading data..." />
```

## Sizes Available

- `xs`: 16x16px
- `sm`: 20x20px
- `md`: 32x32px (default)
- `lg`: 48x48px
- `xl`: 64x64px

You can also use custom sizes:

```tsx
<LottieLoader width={100} height={100} />
```
