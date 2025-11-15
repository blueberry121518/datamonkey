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
    try {
      // Create wallet via CDP API
      const wallet = await coinbase.wallets.createWallet({
        name: walletName || `Data Monkey Wallet - ${userId}`,
        type: 'developer_managed',
      })

      // Store wallet info in database
      const { error } = await supabase
        .from('users')
        .update({
          wallet_id: wallet.id,
          wallet_address: wallet.address,
        })
        .eq('id', userId)

      if (error) {
        // If database update fails, we still have the wallet created
        // Log error but don't fail the operation
        console.error('Failed to update user with wallet info:', error)
      }

      return {
        id: wallet.id,
        address: wallet.address,
        network: CDP_NETWORK,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to create wallet: ${errorMessage}`)
    }
  }

  /**
   * Get wallet info for a user
   */
  async getWallet(userId: string): Promise<WalletInfo | null> {
    const { data, error } = await supabase
      .from('users')
      .select('wallet_id, wallet_address')
      .eq('id', userId)
      .single()

    if (error || !data || !data.wallet_id) {
      return null
    }

    return {
      id: data.wallet_id,
      address: data.wallet_address || '',
      network: CDP_NETWORK,
    }
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

