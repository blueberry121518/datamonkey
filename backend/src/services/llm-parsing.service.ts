import Anthropic from '@anthropic-ai/sdk'
import logger from '../utils/logger.js'

export interface ParsingRequest {
  fileType: string
  mimeType: string
  fileData: Buffer | string
  filename: string
}

export interface ParsingResult {
  structuredData: any[]
  category?: string
  metadata: Record<string, any>
  fields: string[]
  recordCount: number
}

export class LLMParsingService {
  private anthropic: Anthropic

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY must be set in environment variables')
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    logger.info('Anthropic Claude client initialized with claude-sonnet-4-20250514')
  }

  /**
   * Parse unstructured data using Claude Sonnet 4
   */
  async parseUnstructuredData(request: ParsingRequest): Promise<ParsingResult> {
    try {
      logger.info(`Parsing file with Claude: ${request.filename} (${request.fileType})`)

      // Convert file data to text representation
      // No size limit - send full file content
      let fileContent: string
      if (request.fileType === 'image') {
        // For images, just send metadata
        fileContent = `[Image file: ${request.filename}, MIME type: ${request.mimeType}]`
      } else if (request.fileType === 'pdf') {
        // PDFs are binary - we can't extract text directly without a library
        // Send minimal info to avoid token bloat from binary data
        const fileSize = request.fileData instanceof Buffer 
          ? request.fileData.length 
          : Buffer.from(request.fileData).length
        fileContent = `[PDF file: ${request.filename}, Size: ${(fileSize / 1024).toFixed(2)} KB]\n\nNote: This is a PDF file. Please extract any text content, metadata, or structured information that might be present in the document.`
      } else {
        // For text-based files, use the full content with no limit
        const text = request.fileData instanceof Buffer
          ? request.fileData.toString('utf-8')
          : String(request.fileData)
        fileContent = text
      }

      const prompt = `You are a data parsing expert. Parse the following unstructured data and extract structured information.

File: ${request.filename}
Type: ${request.fileType}
MIME Type: ${request.mimeType}

File Content:
${fileContent}

Please:
1. Extract all structured data records from this file
2. Identify the category/type of data (e.g., "Customer Data", "Product Catalog", "Transaction Records", "Text Documents", "Images")
3. Extract all fields/columns present in the data
4. Return a JSON object with this structure:
{
  "structuredData": [array of data records, each as an object],
  "category": "category name",
  "fields": ["field1", "field2", ...],
  "metadata": {
    "totalRecords": number,
    "dataQuality": "high|medium|low",
    "notes": "any relevant notes about the data"
  }
}

If the file contains images, describe what's in the images and extract any text/metadata.
If the file is already structured (JSON, CSV), parse it properly.
If the file is unstructured text, extract key information and structure it.

Return ONLY valid JSON, no markdown formatting.`

      // Use streaming for long operations (required for operations > 10 minutes)
      const stream = await this.anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 64000, // Maximum allowed for claude-sonnet-4-20250514
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      // Accumulate streamed text
      let textContent = ''

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            textContent += chunk.delta.text
          }
        }
      }

      // Get final message with usage stats
      const finalMessage = await stream.finalMessage()

      if (!textContent) {
        throw new Error('No response from Claude')
      }

      const usage = finalMessage.usage
      logger.debug('Claude parsing response received', { 
        tokens: usage?.input_tokens,
        outputTokens: usage?.output_tokens 
      })

      // Parse the JSON response
      const parsed = JSON.parse(textContent)

      return {
        structuredData: Array.isArray(parsed.structuredData) ? parsed.structuredData : [],
        category: parsed.category || 'Uncategorized',
        metadata: {
          ...parsed.metadata,
          model: 'claude-sonnet-4-20250514',
          inputTokens: usage?.input_tokens,
          outputTokens: usage?.output_tokens,
        },
        fields: Array.isArray(parsed.fields) ? parsed.fields : [],
        recordCount: parsed.structuredData?.length || 0,
      }
    } catch (error) {
      logger.error(`Claude parsing failed for ${request.filename}:`, error)
      throw error
    }
  }

  /**
   * Suggest metadata from file content
   * Used for auto-filling both structured endpoint fields and unstructured data fields
   */
  async suggestMetadata(request: ParsingRequest, isStructured: boolean = true): Promise<{
    name?: string
    description?: string
    category?: string
    pricePerRecord?: number
    tags?: string[]
  }> {
    try {
      logger.info(`Suggesting metadata for: ${request.filename}`)

      // Convert file data to text representation
      let fileContent: string
      if (request.fileType === 'image') {
        fileContent = `[Image file: ${request.filename}, MIME type: ${request.mimeType}]`
      } else if (request.fileType === 'pdf') {
        const fileSize = request.fileData instanceof Buffer
          ? request.fileData.length
          : Buffer.from(request.fileData).length
        fileContent = `[PDF file: ${request.filename}, Size: ${(fileSize / 1024).toFixed(2)} KB]`
      } else {
        const text = request.fileData instanceof Buffer
          ? request.fileData.toString('utf-8')
          : String(request.fileData)
        // Limit content to avoid token bloat - use first 5000 chars for metadata suggestion
        fileContent = text.substring(0, 5000)
      }

      const prompt = isStructured
        ? `You are a data marketplace expert. Analyze the following file and suggest metadata for creating a data endpoint.

File: ${request.filename}
Type: ${request.fileType}
MIME Type: ${request.mimeType}

File Content (sample):
${fileContent}

Please suggest:
1. A concise, descriptive endpoint name (e.g., "Customer Purchase History", "Product Catalog API")
2. A brief description of what data this endpoint provides
3. A category for the data (e.g., "Customer Data", "Product Catalog", "Transaction Records", "Text Documents", "Images")
4. A reasonable price per record in USD (suggest between 0.0001 and 0.01 based on data value)

Return ONLY valid JSON with this structure:
{
  "name": "suggested endpoint name",
  "description": "brief description of the data",
  "category": "category name",
  "pricePerRecord": 0.001
}

Return ONLY valid JSON, no markdown formatting.`
        : `You are a data marketplace expert. Analyze the following file and suggest metadata for organizing unstructured data in a data warehouse.

File: ${request.filename}
Type: ${request.fileType}
MIME Type: ${request.mimeType}

File Content (sample):
${fileContent}

Please suggest:
1. A concise, descriptive name/title for this data collection (e.g., "Customer Support Tickets", "Product Images", "Research Documents")
2. A brief description of what this data contains
3. A category for the data (e.g., "Customer Data", "Product Catalog", "Transaction Records", "Text Documents", "Images", "Documents")
4. Relevant tags (array of 3-5 keywords) to help with search and organization

Return ONLY valid JSON with this structure:
{
  "name": "suggested data collection name",
  "description": "brief description of the data",
  "category": "category name",
  "tags": ["tag1", "tag2", "tag3"]
}

Return ONLY valid JSON, no markdown formatting.`

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      const textContent = content.text
      if (!textContent) {
        throw new Error('No response from Claude')
      }

      const parsed = JSON.parse(textContent)

      if (isStructured) {
        return {
          name: parsed.name || undefined,
          description: parsed.description || undefined,
          category: parsed.category || undefined,
          pricePerRecord: parsed.pricePerRecord || 0.001,
        }
      } else {
        return {
          name: parsed.name || undefined,
          description: parsed.description || undefined,
          category: parsed.category || undefined,
          tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
        }
      }
    } catch (error) {
      logger.error(`Metadata suggestion failed for ${request.filename}:`, error)
      // Return empty suggestions on error
      return {}
    }
  }

  /**
   * Generate agent configuration from natural language description or example file
   */
  async generateAgentConfig(
    description: string,
    exampleFile?: {
      filename: string
      mimeType: string
      fileType: string
      fileData: Buffer | string
    }
  ): Promise<{
    name: string
    description?: string
    goal: string
    requirements: {
      category?: string
      requiredFields?: string[]
      format?: string
      minQuality?: number
      filters?: Record<string, any>
    }
    budget?: number
    quality_threshold?: number
    quantity_required?: number
  }> {
    try {
      logger.info('Generating agent configuration from description/file')

      let fileContent: string = ''
      if (exampleFile) {
        if (exampleFile.fileType === 'image') {
          fileContent = `[Image file: ${exampleFile.filename}, MIME type: ${exampleFile.mimeType}]`
        } else if (exampleFile.fileType === 'pdf') {
          const fileSize = exampleFile.fileData instanceof Buffer
            ? exampleFile.fileData.length
            : Buffer.from(exampleFile.fileData).length
          fileContent = `[PDF file: ${exampleFile.filename}, Size: ${(fileSize / 1024).toFixed(2)} KB]`
        } else {
          const text = exampleFile.fileData instanceof Buffer
            ? exampleFile.fileData.toString('utf-8')
            : String(exampleFile.fileData)
          // Limit to first 10000 chars for prompt
          fileContent = text.substring(0, 10000)
        }
      }

      const prompt = `You are an expert at configuring data acquisition agents. Based on the user's description${exampleFile ? ' and the example file provided' : ''}, generate a complete agent configuration.

User Description:
${description}

${exampleFile ? `Example File:
Filename: ${exampleFile.filename}
Type: ${exampleFile.fileType}
MIME Type: ${exampleFile.mimeType}

File Content (sample):
${fileContent}` : ''}

Please analyze the requirements and generate a complete agent configuration. Consider:
1. What type of data is being requested?
2. What fields/attributes are needed?
3. What quality standards should be applied?
4. What quantity might be needed (if mentioned)?
5. What budget would be reasonable (if mentioned)?

Return ONLY valid JSON with this exact structure:
{
  "name": "descriptive agent name",
  "description": "brief description of what this agent does",
  "goal": "clear, specific goal statement",
  "requirements": {
    "category": "data category (e.g., Customer Data, Product Catalog, Images, Documents)",
    "requiredFields": ["field1", "field2", ...],
    "format": "expected data format if specified",
    "minQuality": 0.0-1.0,
    "filters": {}
  },
  "budget": 0.0,
  "quality_threshold": 0.7,
  "quantity_required": 0
}

Important:
- If budget is not mentioned, set to 0 (user will fill in)
- If quantity is not mentioned, set to 0 (user will fill in)
- quality_threshold should default to 0.7 if not specified
- Extract all mentioned fields into requiredFields array
- Be specific and actionable in the goal statement

Return ONLY valid JSON, no markdown formatting.`

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      })

      const content = response.content[0]
      if (content.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      const textContent = content.text
      if (!textContent) {
        throw new Error('No response from Claude')
      }

      // Parse JSON response (handle markdown code blocks if present)
      let jsonText = textContent.trim()
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
      }

      const parsed = JSON.parse(jsonText)

      return {
        name: parsed.name || 'Data Acquisition Agent',
        description: parsed.description,
        goal: parsed.goal || description,
        requirements: {
          category: parsed.requirements?.category,
          requiredFields: parsed.requirements?.requiredFields || [],
          format: parsed.requirements?.format,
          minQuality: parsed.requirements?.minQuality,
          filters: parsed.requirements?.filters || {},
        },
        budget: parsed.budget || 0,
        quality_threshold: parsed.quality_threshold || 0.7,
        quantity_required: parsed.quantity_required || 0,
      }
    } catch (error) {
      logger.error('Agent configuration generation failed:', error)
      throw error
    }
  }
}
