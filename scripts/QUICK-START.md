# Quick Start - Dashboard Testing

## 🚀 Quick Setup

1. **Install Dependencies**:
   ```bash
   pnpm install
   npx playwright install chromium
   ```

2. **Set Environment Variables**:
   ```bash
   export NEXTAUTH_URL=http://localhost:3000
   export TEST_EMAIL=your-email@example.com
   export TEST_PASSWORD=your-password
   ```

3. **Start Dev Server** (di terminal lain):
   ```bash
   pnpm dev
   ```

4. **Run Tests**:
   ```bash
   pnpm test:dashboard
   ```

## 📊 View Results

Setelah test selesai, buka:
```
test-results/report.html
```

## 🎯 What Gets Tested?

✅ **8 Test Suites** dengan **50+ individual tests**:

1. **Authentication** (3 tests)
   - Login page
   - Login functionality
   - Logout

2. **Dashboard** (4 tests)
   - Page load
   - Charts
   - Cards

3. **Management** (6 tests)
   - All 4 tabs
   - Stock adjustment dialog

4. **Alerts** (3 tests)
   - Alerts table
   - Orders view toggle

5. **Tracking** (2 tests)
   - Stock levels

6. **Data** (6 tests)
   - All 4 tabs
   - Add dialog

7. **Profile** (3 tests)
   - Personal info
   - Business info

8. **API Endpoints** (6 tests)
   - Materials, Recipes, Products, Suppliers, Alerts, Orders

## ⚙️ Configuration

Edit `scripts/test-dashboard-mega.ts` untuk customize:
- Timeout duration
- Screenshot settings
- Test selection
- Report format

## 🐛 Troubleshooting

**"Page not initialized"**: Pastikan dev server running
**"Login failed"**: Check TEST_EMAIL dan TEST_PASSWORD
**"Store ID not found"**: Pastikan user punya store di database

## 📝 Notes

- Tests run in headless mode by default
- Set `HEADLESS=false` untuk melihat browser
- Screenshots diambil otomatis untuk failed tests
- Report HTML generated setelah semua tests selesai

