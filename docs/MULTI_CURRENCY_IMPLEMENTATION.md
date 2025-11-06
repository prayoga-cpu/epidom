# Multi-Currency Implementation Summary

## Overview

Implemented comprehensive multi-currency support across the application with EUR and USD as supported currencies. Users can select their preferred currency in their profile, and all prices automatically convert and display in their chosen currency.

## Architecture

### Backend Services

- **Exchange Rate Service** (`src/lib/services/exchange-rate.service.ts`)
  - Fetches EUR to USD exchange rates from exchangerate-api.com
  - Caches rates for 6 hours to minimize API calls
  - Provides fallback mechanism (1 EUR = 1.10 USD if API fails)
  - Stores rates in database (ExchangeRate model)

- **Exchange Rate API** (`src/app/api/exchange-rates/route.ts`)
  - GET endpoint to retrieve current exchange rate
  - POST endpoint to manually refresh rates
  - Returns cached rate if available and not expired

### Frontend Infrastructure

- **Currency Provider** (`src/components/providers/currency-provider.tsx`)
  - React Context for currency management
  - Reads user's currency preference from profile
  - Fetches exchange rate from API
  - Provides `formatPrice()` helper for automatic conversion
  - Provides `convertPrice()` for manual conversion
  - Integrated into dashboard layout

### Database Schema

- **User Model**: Has `currency` field (default: "EUR")
- **Business Model**: Has `currency` field (default: "EUR")
- **ExchangeRate Model**: Stores cached exchange rates
  - `fromCurrency` and `toCurrency` (unique compound key)
  - `rate`, `fetchedAt`, `expiresAt` fields
  - Auto-cleanup of expired rates

## Components Updated

### Data Management Pages

✅ **Materials**

- `materials-section.tsx` - Already using `useCurrency().formatPrice()`
- `material-details-dialog.tsx` - Updated to use `formatPrice()` for prices
- `add-material-dialog.tsx` - Dynamic currency symbols in labels
- `edit-material-dialog.tsx` - Dynamic currency symbols in labels

### Management Pages

✅ **Edit Stock**

- `edit-stock.tsx` - Updated to use `formatPrice()` for stock values

✅ **Recipe Production**

- `recipe-production.tsx` - Updated cost displays
- `start-production-dialog.tsx` - Updated estimated costs
- `batch-details-dialog.tsx` - Updated all cost displays

### Tracking Pages

✅ **Alerts**

- `orders-view.tsx` - Already using `useCurrency()`
- `place-order-dialog.tsx` - Already using `useCurrency()`

### Profile

✅ **Personal Info**

- Currency selection dropdown
- Updates user preference in database
- Session automatically refreshes to reflect new currency

## Usage

### For Users

1. Go to Profile → Personal Information
2. Select preferred currency (EUR or USD)
3. Save changes
4. All prices throughout the app will display in selected currency

### For Developers

```tsx
import { useCurrency } from "@/components/providers/currency-provider";

function MyComponent() {
  const { currency, formatPrice, convertPrice, exchangeRate } = useCurrency();

  // Format a price (stored in EUR in DB)
  const displayPrice = formatPrice(priceInEur);

  // Manual conversion
  const convertedAmount = convertPrice(amountInEur);

  // Current currency
  const symbol = currency === "EUR" ? "€" : "$";

  return <div>{displayPrice}</div>;
}
```

## Key Features

### Automatic Conversion

- All prices are stored in EUR in the database
- Frontend automatically converts to USD if user preference is USD
- Uses real-time exchange rates (cached for 6 hours)

### Smart Caching

- Exchange rates cached in database
- Reduces API calls (free tier: 1,500 requests/month)
- Falls back to cached rate even if expired when API fails

### Graceful Fallback

- If API fails: uses last cached rate (even if expired)
- If no cache: uses fixed rate of 1.10 (1 EUR = 1.10 USD)
- Never breaks the application due to exchange rate issues

### Consistent Formatting

- Uses `Intl.NumberFormat` for proper currency formatting
- Respects currency conventions (€1.234,56 vs $1,234.56)
- Proper decimal places (2 for all currencies)

## Configuration

### Environment Variables

```env
# Exchange Rate API Configuration
EXCHANGE_RATE_API_URL=https://v6.exchangerate-api.com/v6
EXCHANGE_RATE_API_KEY=your_api_key_here
```

### Supported Currencies

Currently supports:

- **EUR** (Euro) - Base currency
- **USD** (US Dollar) - Converted currency

To add more currencies:

1. Update `Currency` type in `currency-provider.tsx`
2. Update exchange rate service to support additional pairs
3. Update locale mapping in `formatPrice()` function

## Testing Checklist

### User Flow

- [ ] User can select currency in profile
- [ ] Currency persists across sessions
- [ ] Prices update when currency changes
- [ ] Exchange rate displays correctly in debug mode

### Price Display

- [ ] Materials list shows correct currency
- [ ] Material details shows correct currency
- [ ] Stock value calculations use correct rate
- [ ] Recipe costs display in selected currency
- [ ] Production batch costs show correct currency
- [ ] Supplier prices formatted correctly

### API Integration

- [ ] Exchange rate fetches from API
- [ ] Rate caches in database
- [ ] Expired rates refresh automatically
- [ ] Fallback works when API is down

## Future Enhancements

### Potential Additions

1. **More Currencies**: Add GBP, CAD, AUD, etc.
2. **Historical Rates**: Track exchange rate history
3. **Rate Alerts**: Notify when rates change significantly
4. **Manual Rates**: Allow admin to override API rates
5. **Multi-Currency Input**: Allow entering prices in different currencies
6. **Currency Conversion Report**: Show conversion gains/losses

### Advanced Features

1. **Per-Store Currency**: Different stores use different currencies
2. **Multi-Currency Accounting**: Track actual currency of transactions
3. **Hedging Strategies**: Lock rates for future orders
4. **Real-time Rates**: WebSocket for live rate updates

## Maintenance

### Regular Tasks

- Monitor API usage (1,500 requests/month limit)
- Review cached rates cleanup (runs automatically)
- Update fallback rate if market conditions change
- Test API connectivity periodically

### Troubleshooting

**Prices not converting:**

- Check user's currency setting in profile
- Verify exchange rate API is accessible
- Check browser console for errors
- Verify CurrencyProvider is in layout

**Wrong exchange rate:**

- Check cache expiration (6 hours default)
- Manually refresh rate via API
- Verify API key is valid
- Check for API rate limits

**Currency not persisting:**

- Check session refresh after profile update
- Verify database update is successful
- Check auth token includes currency field

## Notes

- All database prices remain in EUR (single source of truth)
- Conversion happens only in the frontend for display
- No financial transactions affected by display currency
- Historical data always stored in EUR for consistency
