import { Wallet } from '@coinbase/coinbase-sdk'
import { coinbase, CDP_NETWORK } from '../config/coinbase.js'
import { supabase } from '../config/supabase.js'
import logger from '../utils/logger.js'

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
    logger.info(`Step 1: Create wallet request received - userId: ${userId}, walletName: ${walletName || 'default'}`)
    
    try {
      // MOCK: Always return a mock wallet (for demo purposes)
      // TODO: Replace with actual Coinbase CDP wallet creation in production
      const mockWalletId = `mock-wallet-${userId}-${Date.now()}`
      const mockWalletAddress = `0x${Math.random().toString(16).substring(2, 42)}`
      
      logger.info(`Step 2: Creating mock wallet (for demo)`)
      logger.info(`Step 3: Mock wallet created - walletId: ${mockWalletId}, address: ${mockWalletAddress}`)
      
      // Uncomment below for actual wallet creation:
      // const wallet = await Wallet.create({
      //   networkId: CDP_NETWORK,
      // })
      // const walletId = wallet.getId()
      // const defaultAddress = await wallet.getDefaultAddress()
      // const walletAddress = defaultAddress.getId()
      
      const walletId = mockWalletId
      const walletAddress = mockWalletAddress

      // Store wallet info in database
      logger.info(`Step 4: Updating users table with wallet info`)
      
      const { data: updateData, error } = await supabase
        .from('users')
        .update({
          wallet_id: walletId,
          wallet_address: walletAddress,
        })
        .eq('id', userId)
        .select('id, wallet_id, wallet_address')

      if (error) {
        logger.info(`Step 5: Failed to update user with wallet info: ${error.message}`)
        // If database update fails, we still have the wallet created
        // Log error but don't fail the operation
      } else {
        logger.info(`Step 5: Users table updated successfully`)
      }

      // Verify the update worked
      logger.info(`Step 6: Verifying wallet update`)
      const { data: verifyData, error: verifyError } = await supabase
        .from('users')
        .select('wallet_id, wallet_address')
        .eq('id', userId)
        .single()

      if (verifyError) {
        logger.info(`Step 7: Failed to verify wallet update: ${verifyError.message}`)
      } else {
        logger.info(`Step 7: Wallet update verified - matches: ${verifyData?.wallet_id === walletId}`)
      }

      logger.info(`Step 8: Wallet creation completed successfully`)
      return {
        id: walletId!,
        address: walletAddress,
        network: CDP_NETWORK,
      }
    } catch (error) {
      logger.info(`Step 1: Error creating wallet: ${error instanceof Error ? error.message : 'Unknown error'}`)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to create wallet: ${errorMessage}`)
    }
  }

  /**
   * Get wallet info for a user
   */
  async getWallet(userId: string): Promise<WalletInfo | null> {
    logger.info(`Step 1: Get wallet request received - userId: ${userId}`)
    
    logger.info(`Step 2: Querying users table for wallet info`)
    const { data, error } = await supabase
      .from('users')
      .select('wallet_id, wallet_address')
      .eq('id', userId)
      .single()

    if (error) {
      logger.info(`Step 3: Error querying users table: ${error.message}`)
      return null
    }

    if (!data) {
      logger.info(`Step 3: No user found for userId: ${userId}`)
      return null
    }

    logger.info(`Step 3: User data retrieved - hasWalletId: ${!!data.wallet_id}`)

    if (!data.wallet_id) {
      logger.info(`Step 4: User exists but has no wallet_id`)
      return null
    }

    logger.info(`Step 4: Returning wallet info`)
    const walletInfo = {
      id: data.wallet_id,
      address: data.wallet_address || '',
      network: CDP_NETWORK,
    }
    
    return walletInfo
  }

  /**
   * Get wallet balance
   */
  async getBalance(walletId: string, assetType: string = 'USDC') {
    try {
      const wallet = await Wallet.fetch(walletId)
      const balance = await wallet.getBalance(assetType)

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
      // Create wallet via CDP API using Wallet.create()
      const wallet = await Wallet.create({
        networkId: CDP_NETWORK,
      })
      const walletId = wallet.getId()
      const defaultAddress = await wallet.getDefaultAddress()
      const walletAddress = defaultAddress.getId()

      return {
        id: walletId!,
        address: walletAddress,
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
      // Get wallet and create transfer
      const wallet = await Wallet.fetch(fromWalletId)
      const transfer = await wallet.createTransfer({
        amount: amount,
        assetId: 'USDC',
        destination: toWalletAddress,
      })

      // The transaction is signed and will be broadcast by Coinbase
      return {
        transactionHash: transfer.id,
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
      const wallet = await Wallet.fetch(walletId)
      const payloadSignature = await wallet.createPayloadSignature(message)

      return {
        payload: paymentInstructions,
        signature: payloadSignature.signature,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Failed to sign payment: ${errorMessage}`)
    }
  }
}

