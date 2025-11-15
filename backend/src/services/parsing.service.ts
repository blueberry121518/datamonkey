import axios from 'axios'
import { X402Service } from './x402.service.js'
import { WalletService } from './wallet.service.js'

export interface ParsingRequest {
  fileType: string
  mimeType: string
  fileData: Buffer | string
  options?: {
    extractText?: boolean
    extractMetadata?: boolean
    categorize?: boolean
  }
}

export interface ParsingResult {
  structuredData: any[]
  category?: string
  metadata: Record<string, any>
  fields: string[]
  recordCount: number
}

export class ParsingService {
  private x402Service: X402Service
  private walletService: WalletService
  private x402Client: any

  constructor() {
    this.x402Service = new X402Service()
    this.walletService = new WalletService()
    this.setupX402Client()
  }

  /**
   * Setup x402 client for calling AI parsing services
   * Uses x402 Bazaar to find parsing services
   */
  private async setupX402Client() {
    // This would use x402-axios or similar
    // For now, we'll implement manual x402 handling
  }

  /**
   * Discover parsing services from x402 Bazaar
   */
  async discoverParsingServices(fileType: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${process.env.X402_BAZAAR_URL || 'https://bazaar.x402.org'}/services`,
        {
          params: {
            q: `parse ${fileType} unstructured data`,
            category: 'data-processing',
          },
        }
      )
      return response.data.services || []
    } catch (error) {
      console.error('Failed to discover parsing services:', error)
      // Fallback: return empty array, will use basic parsing
      return []
    }
  }

  /**
   * Parse unstructured data using x402 AI services
   * Falls back to basic parsing if no x402 service available
   */
  async parseUnstructuredData(
    agentWalletId: string,
    request: ParsingRequest
  ): Promise<ParsingResult> {
    // 1. Discover parsing services from x402 Bazaar
    const services = await this.discoverParsingServices(request.fileType)

    if (services.length === 0) {
      // Fallback to basic parsing
      return this.basicParse(request)
    }

    // 2. Select best parsing service
    const service = this.selectBestService(services, request.fileType)

    // 3. Call x402 service for parsing
    try {
      const result = await this.callX402ParsingService(agentWalletId, service, request)
      return result
    } catch (error) {
      console.error('x402 parsing failed, falling back to basic:', error)
      return this.basicParse(request)
    }
  }

  /**
   * Call x402 parsing service
   */
  private async callX402ParsingService(
    agentWalletId: string,
    service: any,
    request: ParsingRequest
  ): Promise<ParsingResult> {
    // Make request to x402 service
    let response = await axios.post(service.endpoint, {
      fileType: request.fileType,
      mimeType: request.mimeType,
      fileData: request.fileData.toString('base64'),
      options: request.options,
    })

    // Handle HTTP 402 payment
    if (response.status === 402) {
      const paymentInstructions = response.data

      // Sign payment with agent wallet
      const signed = await this.walletService.signPaymentPayload(agentWalletId, {
        amount: paymentInstructions.amount,
        recipient: paymentInstructions.recipient,
        nonce: paymentInstructions.nonce,
        timestamp: paymentInstructions.timestamp,
      })

      // Retry with X-PAYMENT header
      response = await axios.post(
        service.endpoint,
        {
          fileType: request.fileType,
          mimeType: request.mimeType,
          fileData: request.fileData.toString('base64'),
          options: request.options,
        },
        {
          headers: {
            'X-PAYMENT': JSON.stringify({
              scheme: 'x402',
              amount: paymentInstructions.amount,
              recipient: paymentInstructions.recipient,
              signature: signed.signature,
            }),
          },
        }
      )
    }

    // Parse response
    const parsed = response.data

    return {
      structuredData: parsed.data || [],
      category: parsed.category,
      metadata: parsed.metadata || {},
      fields: parsed.fields || [],
      recordCount: parsed.data?.length || 0,
    }
  }

  /**
   * Basic parsing fallback (no AI)
   */
  private basicParse(request: ParsingRequest): ParsingResult {
    // Basic parsing based on file type
    if (request.fileType === 'image') {
      return {
        structuredData: [
          {
            type: 'image',
            mimeType: request.mimeType,
            size: request.fileData.length,
          },
        ],
        category: 'Images',
        metadata: {
          fileType: 'image',
          mimeType: request.mimeType,
        },
        fields: ['type', 'mimeType', 'size'],
        recordCount: 1,
      }
    }

    if (request.fileType === 'json') {
      try {
        const data = JSON.parse(request.fileData.toString())
        const records = Array.isArray(data) ? data : [data]
        const fields = records.length > 0 ? Object.keys(records[0]) : []

        return {
          structuredData: records,
          category: 'Structured Data',
          metadata: {
            fileType: 'json',
            recordCount: records.length,
          },
          fields,
          recordCount: records.length,
        }
      } catch (error) {
        // Invalid JSON
        return {
          structuredData: [],
          category: 'Unknown',
          metadata: { error: 'Invalid JSON' },
          fields: [],
          recordCount: 0,
        }
      }
    }

    // Default: treat as text
    return {
      structuredData: [
        {
          type: 'text',
          content: request.fileData.toString().substring(0, 1000), // First 1000 chars
          mimeType: request.mimeType,
        },
      ],
      category: 'Text',
      metadata: {
        fileType: 'text',
        mimeType: request.mimeType,
      },
      fields: ['type', 'content', 'mimeType'],
      recordCount: 1,
    }
  }

  /**
   * Select best parsing service from discovered services
   */
  private selectBestService(services: any[], fileType: string): any {
    // Simple selection: prefer services that match file type
    const matching = services.filter((s) =>
      s.name.toLowerCase().includes(fileType.toLowerCase())
    )

    if (matching.length > 0) {
      // Sort by price, select cheapest
      return matching.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0]
    }

    // Fallback to cheapest overall
    return services.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0]
  }
}

