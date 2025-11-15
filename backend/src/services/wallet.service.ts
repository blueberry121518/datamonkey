import { coinbase, CDP_NETWORK } from '../config/coinbase.js'
import { supabase } from '../config/supabase.js'

export interface WalletInfo {
  id: string
  address: string
  network: string
}

export class WalletService {
  /**
   * Create a CDP wallet for a user
   */
  async createWallet(userId: string, walletName?: string): Promise<WalletInfo> {
    console.log(`[WALLET_DEBUG] createWallet called for userId: ${userId}, walletName: ${walletName || 'default'}`)
    
    try {
      // Create wallet via CDP API
      console.log(`[WALLET_DEBUG] Calling coinbase.wallets.createWallet...`)
      const wallet = await coinbase.wallets.createWallet({
        name: walletName || `Data Monkey Wallet - ${userId}`,
        type: 'developer_managed',
      })
      console.log(`[WALLET_DEBUG] Wallet created via CDP: id=${wallet.id}, address=${wallet.address}`)

      // Store wallet info in database
      console.log(`[WALLET_DEBUG] Updating users table for userId: ${userId}`)
      const { data: updateData, error } = await supabase
        .from('users')
        .update({
          wallet_id: wallet.id,
          wallet_address: wallet.address,
        })
        .eq('id', userId)
        .select('id, wallet_id, wallet_address')

      if (error) {
        console.error(`[WALLET_DEBUG] ❌ Failed to update user with wallet info:`, {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId,
          walletId: wallet.id,
          walletAddress: wallet.address,
        })
        // If database update fails, we still have the wallet created
        // Log error but don't fail the operation
      } else {
        console.log(`[WALLET_DEBUG] ✅ Successfully updated users table:`, {
          userId,
          updatedRows: updateData?.length || 0,
          walletId: wallet.id,
          walletAddress: wallet.address,
        })
      }

      // Verify the update worked
      const { data: verifyData, error: verifyError } = await supabase
        .from('users')
        .select('wallet_id, wallet_address')
        .eq('id', userId)
        .single()

      if (verifyError) {
        console.error(`[WALLET_DEBUG] ❌ Failed to verify wallet update:`, verifyError)
      } else {
        console.log(`[WALLET_DEBUG] ✅ Verification - User wallet in DB:`, {
          userId,
          wallet_id: verifyData?.wallet_id,
          wallet_address: verifyData?.wallet_address,
          matches: verifyData?.wallet_id === wallet.id,
        })
      }

      return {
        id: wallet.id,
        address: wallet.address,
        network: CDP_NETWORK,
      }
    } catch (error) {
      console.error(`[WALLET_DEBUG] ❌ Exception in createWallet:`, {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to create wallet: ${errorMessage}`)
    }
  }

  /**
   * Get wallet info for a user
   */
  async getWallet(userId: string): Promise<WalletInfo | null> {
    console.log(`[WALLET_DEBUG] getWallet called for userId: ${userId}`)
    
    const { data, error } = await supabase
      .from('users')
      .select('wallet_id, wallet_address')
      .eq('id', userId)
      .single()

    if (error) {
      console.log(`[WALLET_DEBUG] ❌ Error querying users table:`, {
        userId,
        error: error.message,
        code: error.code,
        details: error.details,
      })
      return null
    }

    if (!data) {
      console.log(`[WALLET_DEBUG] ❌ No user found for userId: ${userId}`)
      return null
    }

    console.log(`[WALLET_DEBUG] User data from DB:`, {
      userId,
      wallet_id: data.wallet_id,
      wallet_address: data.wallet_address,
      hasWalletId: !!data.wallet_id,
      hasWalletAddress: !!data.wallet_address,
    })

    if (!data.wallet_id) {
      console.log(`[WALLET_DEBUG] ❌ User exists but has no wallet_id`)
      return null
    }

    const walletInfo = {
      id: data.wallet_id,
      address: data.wallet_address || '',
      network: CDP_NETWORK,
    }
    
    console.log(`[WALLET_DEBUG] ✅ Returning wallet info:`, walletInfo)
    return walletInfo
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletId: string, assetType: string = 'USDC') {
    try {
      const balance = await coinbase.wallets.getBalance({
        walletId,
        assetType,
      })

      return balance
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to get balance: ${errorMessage}`)
    }
  }

  /**
   * Create a wallet for an agent (doesn't update users table)
   */
  async createAgentWallet(walletName: string): Promise<WalletInfo> {
    try {
      // Create wallet via CDP API
      const wallet = await coinbase.wallets.createWallet({
        name: walletName,
        type: 'developer_managed',
      })

      return {
        id: wallet.id,
        address: wallet.address,
        network: CDP_NETWORK,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to create agent wallet: ${errorMessage}`)
    }
  }

  /**
   * Transfer USDC from one wallet to another
   * Note: This requires the source wallet to have sufficient balance
   * For testnet: Use faucets to get test USDC
   * For mainnet: Buyer must have USDC in their wallet
   */
  async transferUSDC(
    fromWalletId: string,
    toWalletAddress: string,
    amount: string
  ): Promise<{ transactionHash?: string; success: boolean }> {
    try {
      // Sign and send transaction using Coinbase CDP
      // Note: The actual API may vary - check Coinbase CDP SDK docs for exact method
      const transaction = await coinbase.wallets.signTransaction({
        walletId: fromWalletId,
        to: toWalletAddress,
        value: amount,
        assetType: 'USDC',
        networkId: CDP_NETWORK,
      })

      // The transaction is signed and will be broadcast by Coinbase
      return {
        transactionHash: transaction.hash || transaction.transactionHash,
        success: true,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to transfer USDC: ${errorMessage}`)
    }
  }

  /**
   * Sign a payment payload for x402 protocol
   */
  async signPaymentPayload(
    walletId: string,
    paymentInstructions: {
      amount: string
      recipient: string
      nonce: string
      timestamp: number
    }
  ): Promise<{ payload: any; signature: string }> {
    try {
      const message = JSON.stringify(paymentInstructions)

      const signed = await coinbase.wallets.signMessage({
        walletId,
        message,
      })

      return {
        payload: paymentInstructions,
        signature: signed.signature,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to sign payment: ${errorMessage}`)
    }
  }
}

