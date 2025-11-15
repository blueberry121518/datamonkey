# CDP Account Creation Troubleshooting

## Current Issue: Unauthorized Error

When trying to create an EVM account with `@coinbase/cdp-sdk`, getting:
```
APIError: Unauthorized. (401)
```

## Possible Causes

### 1. API Key Permissions
Your API keys might not have permission to create EVM accounts. Check in Coinbase Developer Platform:
- Go to: API Keys → Your API Key
- Verify permissions include: "EVM Account Creation" or "Wallet Operations"

### 2. Wallet Secret Mismatch
The wallet secret must match the API keys. They should be from the same project in Coinbase Developer Platform.

### 3. Network/Environment
- Ensure you're using the correct network (testnet vs mainnet)
- Verify the API keys are for the correct environment

## Solutions

### Option 1: Check API Key Permissions
1. Go to Coinbase Developer Platform
2. Navigate to your API key
3. Ensure it has "EVM Account" or "Wallet" permissions
4. Regenerate if needed

### Option 2: Use Different SDK
We're currently using `@coinbase/coinbase-sdk` in the codebase which works differently. The `@coinbase/cdp-sdk` might require different setup.

### Option 3: Verify Wallet Secret
- Ensure wallet secret is from the same project as API keys
- Check if wallet secret needs to be generated in the CDP dashboard

## Current Configuration

Your `.env` has:
- ✅ `CDP_API_KEY_NAME=datamonkey`
- ✅ `CDP_API_KEY_SECRET=...` (set)
- ✅ `CDP_WALLET_SECRET=...` (set)

## Next Steps

1. **Check Coinbase Developer Platform Dashboard**:
   - Verify API key permissions
   - Check if wallet secret matches API key project

2. **Try Alternative Approach**:
   - Use the existing `WalletService` in the codebase
   - It uses `@coinbase/coinbase-sdk` which might work better

3. **Contact Support**:
   - If permissions look correct, may need to contact Coinbase support
   - Or check if there's a different API endpoint/method

## Note

The `@coinbase/cdp-sdk` and `@coinbase/coinbase-sdk` are different packages:
- `@coinbase/coinbase-sdk` - What we're using in codebase (wallets API)
- `@coinbase/cdp-sdk` - Newer SDK (EVM accounts API)

They may require different authentication or permissions.

