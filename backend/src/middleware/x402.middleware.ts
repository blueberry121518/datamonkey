import { Request, Response, NextFunction } from 'express'
import { X402Service } from '../services/x402.service.js'
import { WalletService } from '../services/wallet.service.js'
import { AgentActionService } from '../services/agent-action.service.js'
import { supabase } from '../config/supabase.js'
import { CDP_NETWORK, X402_FACILITATOR_URL } from '../config/coinbase.js'

const x402Service = new X402Service()
const walletService = new WalletService()
const agentActionService = new AgentActionService()

// Temporary storage for payment instructions (keyed by nonce)
// In production, use Redis or similar for distributed systems
const paymentInstructionsCache = new Map<string, any>()

/**
 * x402 Payment Middleware
 * 
 * This middleware handles x402 payment protocol for dataset endpoints.
 * 
 * Flow:
 * 1. Check if X-PAYMENT header exists
 * 2. If not, return HTTP 402 with payment instructions
 * 3. If yes, verify payment and proceed
 */
export const x402PaymentMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get dataset ID from route params
    const datasetId = req.params.id
    if (!datasetId) {
      res.status(400).json({
        success: false,
        error: 'Dataset ID required',
      })
      return
    }

    // Get dataset info
    const { data: dataset, error: datasetError } = await supabase
      .from('dataset_listings')
      .select('*')
      .eq('id', datasetId)
      .eq('is_active', true)
      .single()

    if (datasetError || !dataset) {
      res.status(404).json({
        success: false,
        error: 'Dataset not found',
      })
      return
    }

    // Get producer wallet address
    const { data: producer, error: producerError } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', dataset.seller_id)
      .single()

    if (producerError || !producer || !producer.wallet_address) {
      res.status(500).json({
        success: false,
        error: 'Producer wallet not configured',
      })
      return
    }

    const producerWalletAddress = producer.wallet_address

    // Check if payment header exists
    const paymentHeader = req.headers['x-payment']
    
    if (!paymentHeader) {
      // No payment - return 402 with payment instructions
      const quantity = parseInt(req.query.quantity as string) || 1
      const totalAmount = (parseFloat(dataset.price_per_record) * quantity).toFixed(6)

      const paymentInstructions = x402Service.generatePaymentInstructions(
        totalAmount,
        producerWalletAddress
      )

      // Store payment instructions for verification (keyed by nonce)
      paymentInstructionsCache.set(paymentInstructions.nonce, {
        ...paymentInstructions,
        datasetId,
        quantity,
      })

      // Clean up old entries (older than 5 minutes)
      setTimeout(() => {
        paymentInstructionsCache.delete(paymentInstructions.nonce)
      }, 5 * 60 * 1000)

      // Log agent action (if agent_id in query)
      const agentId = req.query.agent_id as string | undefined
      if (agentId) {
        await agentActionService.logAction(
          agentId,
          'payment_402_received',
          {
            dataset_id: datasetId,
            dataset_name: dataset.name,
            amount: totalAmount,
            quantity,
            payment_instructions: paymentInstructions,
          },
          'pending'
        )
      }

      res.status(402).json({
        scheme: 'x402',
        amount: totalAmount,
        currency: 'USDC',
        recipient: producerWalletAddress,
        network: paymentInstructions.network,
        nonce: paymentInstructions.nonce,
        timestamp: paymentInstructions.timestamp,
        facilitator: paymentInstructions.facilitator,
        metadata: {
          dataset_id: datasetId,
          dataset_name: dataset.name,
          quantity: quantity,
          price_per_record: dataset.price_per_record,
        },
      })
      return
    }

    // Payment header exists - verify payment
    let signedPayment
    let paymentInstructions: any = null
    
    try {
      const paymentData = typeof paymentHeader === 'string' 
        ? JSON.parse(paymentHeader) 
        : paymentHeader
      
      signedPayment = paymentData
      
      // Try to get payment instructions from cache using nonce
      // The nonce should be in the payment instructions that were returned in the 402
      // For now, we'll reconstruct from what we have or get from cache
      // In a real implementation, the client should include nonce in the payment header
      if (paymentData.nonce) {
        paymentInstructions = paymentInstructionsCache.get(paymentData.nonce)
      }
      
      // If not in cache, reconstruct from signed payment (will work but nonce won't match)
      if (!paymentInstructions) {
        // Reconstruct payment instructions (nonce/timestamp won't match original, but facilitator can still verify signature)
        paymentInstructions = {
          scheme: 'x402',
          amount: signedPayment.amount,
          recipient: signedPayment.recipient,
          network: CDP_NETWORK,
          facilitator: X402_FACILITATOR_URL,
        }
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Invalid X-PAYMENT header format',
      })
      return
    }

    // Log payment signing (if agent_id in query)
    const agentId = req.query.agent_id as string | undefined
    if (agentId) {
      await agentActionService.logAction(
        agentId,
        'payment_signing',
        {
          dataset_id: datasetId,
          amount: signedPayment.amount,
        },
        'pending'
      )
    }

    // Verify payment with facilitator (will settle on-chain)
    const verificationResult = await x402Service.verifyPayment(
      signedPayment,
      paymentInstructions
    )
    
    if (!verificationResult.valid) {
      if (agentId) {
        await agentActionService.logAction(
          agentId,
          'error',
          {
            error: verificationResult.error || 'Payment verification failed',
            dataset_id: datasetId,
          },
          'failed'
        )
      }
      res.status(402).json({
        success: false,
        error: verificationResult.error || 'Payment verification failed',
      })
      return
    }

    // Payment verified and settled on-chain by facilitator
    // Log payment sent and settled
    if (agentId) {
      await agentActionService.logAction(
        agentId,
        'payment_sent',
        {
          dataset_id: datasetId,
          amount: signedPayment.amount,
          recipient: signedPayment.recipient,
          transaction_hash: verificationResult.transactionHash,
        },
        'success'
      )
      
      if (verificationResult.transactionHash) {
        await agentActionService.logAction(
          agentId,
          'payment_settled',
          {
            dataset_id: datasetId,
            transaction_hash: verificationResult.transactionHash,
            amount: signedPayment.amount,
          },
          'success'
        )
      }
    }

    // Payment verified - attach dataset info to request and proceed
    ;(req as any).dataset = dataset
    ;(req as any).payment = signedPayment
    ;(req as any).agentId = agentId // Pass agent ID to controller
    next()
  } catch (error) {
    console.error('x402 middleware error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

