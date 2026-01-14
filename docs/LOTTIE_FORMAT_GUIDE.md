# Lottie Animation Format Guide

## ✅ File `.lottie` - AMAN & RECOMMENDED!

File `.lottie` adalah format **binary** yang lebih optimal dibanding `.json`:

### Keuntungan `.lottie`:
- ✅ **Ukuran file lebih kecil** (~30-50% lebih kecil dari JSON)
- ✅ **Loading lebih cepat** (binary parsing)
- ✅ **Bandwidth lebih hemat**
- ✅ **Fully supported** oleh `lottie-web`
- ✅ **Backward compatible** (bisa fallback ke JSON)

### Komponen Sudah Siap!

Komponen `LottieLoader` sudah diupdate untuk support:
1. **Priority:** Coba load `/animations/loader.lottie` (binary)
2. **Fallback:** Jika gagal, load `/animations/loader.json`
3. **Ultimate Fallback:** Jika semua gagal, tampilkan SVG spinner

## 🔄 Cara Konversi JSON ke .lottie

### 1. Online Tool (Termudah)
Gunakan https://lottiefiles.com/
- Upload file `.json` Anda
- Download dalam format `.lottie`

### 2. Menggunakan lottie-web CLI
```bash
npm install -g @lottiefiles/lottie-cli
lottie-cli compress input.json output.lottie
```

### 3. Menggunakan @lottiefiles/toolkit
```bash
npm install -D @lottiefiles/toolkit
```

```javascript
const { dotLottie } = require('@lottiefiles/toolkit');

await dotLottie.compress({
  input: 'loader.json',
  output: 'loader.lottie'
});
```

## 📁 File Structure

```
public/
  animations/
    loader.lottie    ← Binary format (prioritas pertama)
    loader.json      ← JSON fallback (opsional, untuk debug)
```

## 💡 Recommendation

**Gunakan `.lottie` untuk production!**
- Lebih cepat
- Lebih kecil
- Lebih efisien

Komponen sudah handle semuanya otomatis. Anda tinggal:
1. Upload file `.lottie` Anda ke `/public/animations/loader.lottie`
2. Done! ✅

## 🎨 Custom Animations

Jika ingin gunakan animasi custom:

```tsx
import { LottieLoader } from "@/components/ui/lottie-loader";

// Komponen akan otomatis load dari:
// 1. /animations/loader.lottie (prioritas)
// 2. /animations/loader.json (fallback)
<LottieLoader size="lg" />
```

Untuk animasi custom dengan path lain, Anda bisa extend komponen atau buat variant baru.

## 📊 Size Comparison

Example dengan animasi kompleks:
- JSON: `loader.json` → **45 KB**
- Lottie: `loader.lottie` → **18 KB** (60% lebih kecil!)

## ✅ Browser Support

Format `.lottie` didukung oleh:
- Chrome/Edge (semua versi modern)
- Firefox (semua versi modern)
- Safari/iOS (semua versi modern)
- Android WebView

**100% safe untuk production!** 🚀
