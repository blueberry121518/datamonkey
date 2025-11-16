import { Request, Response, NextFunction } from 'express'
import { X402Service } from '../services/x402.service.js'
import { WalletService } from '../services/wallet.service.js'
import { AgentActionService } from '../services/agent-action.service.js'
import { supabase } from '../config/supabase.js'
import { CDP_NETWORK, X402_FACILITATOR_URL } from '../config/coinbase.js'
import logger from '../utils/logger.js'

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
    logger.info(`Step 1: x402 payment middleware started`)
    // Get dataset ID from route params
    const datasetId = req.params.id
    logger.info(`Step 2: Extracted dataset ID: ${datasetId}`)
    if (!datasetId) {
      logger.info(`Step 3: Dataset ID missing, returning 400 error`)
      res.status(400).json({
        success: false,
        error: 'Dataset ID required',
      })
      return
    }

    // Get dataset info (handles virtual warehouse endpoints)
    logger.info(`Step 3: Fetching dataset`)
    const { DatasetService } = await import('../services/dataset.service.js')
    const datasetService = new DatasetService()
    
    let dataset
    try {
      dataset = await datasetService.getDatasetById(datasetId)
      if (!dataset.is_active) {
        throw new Error('Dataset not active')
      }
    } catch (error) {
      logger.info(`Step 4: Dataset not found, returning 404 error`)
      res.status(404).json({
        success: false,
        error: 'Dataset not found',
      })
      return
    }
    logger.info(`Step 4: Dataset found: ${dataset.name}`)

    // Get producer wallet address
    logger.info(`Step 5: Fetching producer wallet address`)
    const { data: producer, error: producerError } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', dataset.seller_id)
      .single()

    if (producerError || !producer || !producer.wallet_address) {
      logger.info(`Step 6: Producer wallet not configured, returning 500 error`)
      res.status(500).json({
        success: false,
        error: 'Producer wallet not configured',
      })
      return
    }
    logger.info(`Step 6: Producer wallet address retrieved`)

    const producerWalletAddress = producer.wallet_address

    // Check if payment header exists
    logger.info(`Step 7: Checking for X-PAYMENT header`)
    const paymentHeader = req.headers['x-payment']
    
    if (!paymentHeader) {
      logger.info(`Step 8: No payment header found, generating payment instructions`)
      // No payment - return 402 with payment instructions
      const quantity = parseInt(req.query.quantity as string) || 1
      const totalAmount = (parseFloat(dataset.price_per_record) * quantity).toFixed(6)
      logger.info(`Step 9: Calculated payment amount: ${totalAmount} for quantity: ${quantity}`)

      logger.info(`Step 10: Generating payment instructions`)
      const paymentInstructions = x402Service.generatePaymentInstructions(
        totalAmount,
        producerWalletAddress
      )
      logger.info(`Step 11: Payment instructions generated with nonce: ${paymentInstructions.nonce}`)

      // Store payment instructions for verification (keyed by nonce)
      paymentInstructionsCache.set(paymentInstructions.nonce, {
        ...paymentInstructions,
        datasetId,
        quantity,
      })
      logger.info(`Step 12: Payment instructions cached`)

      // Clean up old entries (older than 5 minutes)
      setTimeout(() => {
        paymentInstructionsCache.delete(paymentInstructions.nonce)
      }, 5 * 60 * 1000)

      // Log agent action (if agent_id in query)
      const agentId = req.query.agent_id as string | undefined
      if (agentId) {
        logger.info(`Step 13: Logging agent action for agent: ${agentId}`)
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

      logger.info(`Step 14: Returning 402 payment required response`)
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
    logger.info(`Step 8: Payment header found, verifying payment`)
    let signedPayment
    let paymentInstructions: any = null
    
    try {
      logger.info(`Step 9: Parsing payment header`)
      const paymentData = typeof paymentHeader === 'string' 
        ? JSON.parse(paymentHeader) 
        : paymentHeader
      
      signedPayment = paymentData
      logger.info(`Step 10: Payment data parsed successfully`)
      
      // Try to get payment instructions from cache using nonce
      // The nonce should be in the payment instructions that were returned in the 402
      // For now, we'll reconstruct from what we have or get from cache
      // In a real implementation, the client should include nonce in the payment header
      if (paymentData.nonce) {
        logger.info(`Step 11: Looking up payment instructions in cache using nonce`)
        paymentInstructions = paymentInstructionsCache.get(paymentData.nonce)
      }
      
      // If not in cache, reconstruct from signed payment (will work but nonce won't match)
      if (!paymentInstructions) {
        logger.info(`Step 12: Payment instructions not in cache, reconstructing`)
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
      logger.info(`Step 13: Error parsing payment header, returning 400 error`)
      res.status(400).json({
        success: false,
        error: 'Invalid X-PAYMENT header format',
      })
      return
    }

    // Log payment signing (if agent_id in query)
    const agentId = req.query.agent_id as string | undefined
    if (agentId) {
      logger.info(`Step 13: Logging payment signing action for agent: ${agentId}`)
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
    logger.info(`Step 14: Verifying payment with facilitator`)
    const verificationResult = await x402Service.verifyPayment(
      signedPayment,
      paymentInstructions
    )
    logger.info(`Step 15: Payment verification result: ${verificationResult.valid ? 'valid' : 'invalid'}`)
    
    if (!verificationResult.valid) {
      if (agentId) {
        logger.info(`Step 16: Payment verification failed, logging error action`)
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
      logger.info(`Step 17: Returning 402 payment failed response`)
      res.status(402).json({
        success: false,
        error: verificationResult.error || 'Payment verification failed',
      })
      return
    }

    // Payment verified and settled on-chain by facilitator
    // Log payment sent and settled
    if (agentId) {
      logger.info(`Step 16: Payment verified, logging payment sent action`)
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
        logger.info(`Step 17: Logging payment settled action`)
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
    logger.info(`Step 18: Attaching dataset and payment info to request`)
    ;(req as any).dataset = dataset
    ;(req as any).payment = signedPayment
    ;(req as any).agentId = agentId // Pass agent ID to controller
    logger.info(`Step 19: Payment verification complete, proceeding to next middleware`)
    next()
  } catch (error) {
    logger.info(`Step 1: x402 middleware error occurred`)
    logger.info(`Step 2: Error message: ${error instanceof Error ? error.message : 'Unknown error'}`)
    logger.info(`Step 3: Returning 500 error response`)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

