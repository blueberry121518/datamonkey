import { X402_FACILITATOR_URL, CDP_NETWORK } from '../config/coinbase.js'
import { WalletService } from './wallet.service.js'
import crypto from 'crypto'

export interface PaymentInstructions {
  scheme: string
  amount: string
  currency: string
  recipient: string
  network: string
  nonce: string
  timestamp: number
  facilitator: string
}

export interface SignedPayment {
  scheme: string
  amount: string
  recipient: string
  signature: string
}

export class X402Service {
  private walletService: WalletService

  constructor() {
    this.walletService = new WalletService()
  }

  /**
   * Generate payment instructions for x402 protocol
   */
  generatePaymentInstructions(
    amount: string,
    recipientWalletAddress: string
  ): PaymentInstructions {
    return {
      scheme: 'x402',
      amount,
      currency: 'USDC',
      recipient: recipientWalletAddress,
      network: CDP_NETWORK,
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Math.floor(Date.now() / 1000),
      facilitator: X402_FACILITATOR_URL,
    }
  }

  /**
   * Verify a signed payment
   * In production, this would verify the signature on-chain
   * For now, we'll do basic validation
   */
  async verifyPayment(signedPayment: SignedPayment): Promise<boolean> {
    // Basic validation
    if (!signedPayment.scheme || signedPayment.scheme !== 'x402') {
      return false
    }

    if (!signedPayment.amount || !signedPayment.recipient || !signedPayment.signature) {
      return false
    }

    // TODO: In production, verify signature on-chain via facilitator
    // For now, we'll accept valid format
    return true
  }

  /**
   * Sign payment instructions with a wallet
   */
  async signPayment(
    walletId: string,
    paymentInstructions: PaymentInstructions
  ): Promise<SignedPayment> {
    const signed = await this.walletService.signPaymentPayload(walletId, {
      amount: paymentInstructions.amount,
      recipient: paymentInstructions.recipient,
      nonce: paymentInstructions.nonce,
      timestamp: paymentInstructions.timestamp,
    })

    return {
      scheme: 'x402',
      amount: paymentInstructions.amount,
      recipient: paymentInstructions.recipient,
      signature: signed.signature,
    }
  }
}

