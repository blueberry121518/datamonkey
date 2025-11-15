import { Request, Response } from 'express'
import { supabase } from '../config/supabase.js'
import { LLMParsingService } from '../services/llm-parsing.service.js'
import { DataStorageService } from '../services/data-storage.service.js'
import { getFileType } from '../middleware/upload.middleware.js'
import logger from '../utils/logger.js'

const llmParsingService = new LLMParsingService()
const dataStorageService = new DataStorageService()

export class FileUploadController {
  /**
   * Upload unstructured files (images, documents, etc.)
   * POST /api/seller/files/upload
   * Uses x402 Bazaar for AI parsing
   */
  async uploadFiles(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const files = req.files as Express.Multer.File[]
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No files uploaded',
        })
        return
      }

      // Get metadata from request body if provided (for unstructured uploads)
      let userMetadata: Record<string, any> = {}
      if (req.body.metadata) {
        try {
          userMetadata = typeof req.body.metadata === 'string' 
            ? JSON.parse(req.body.metadata) 
            : req.body.metadata
        } catch {
          // Ignore parse errors
        }
      }

      const results = []

      for (const file of files) {
        const fileType = getFileType(file.mimetype)

        logger.info(`Processing file: ${file.originalname} (${fileType}, ${(file.size / 1024).toFixed(2)} KB)`)

        // Create file record with user metadata
        const { data: fileRecord, error: fileError } = await supabase
          .from('uploaded_files')
          .insert({
            seller_id: req.userId,
            original_filename: file.originalname,
            file_type: fileType,
            mime_type: file.mimetype,
            file_size: file.size,
            storage_path: `data/${req.userId}/${file.originalname}`, // In production, upload to S3/storage
            parsing_status: 'parsing',
            metadata: userMetadata,
            category: userMetadata.category || null,
          })
          .select()
          .single()

        if (fileError) {
          logger.error(`Failed to create file record for ${file.originalname}:`, fileError)
          continue
        }

        try {
          // Parse unstructured data using LLM (Claude or x402)
          const parsed = await llmParsingService.parseUnstructuredData({
            fileType,
            mimeType: file.mimetype,
            fileData: file.buffer,
            filename: file.originalname,
          })

          logger.info(`Parsed ${file.originalname}: ${parsed.recordCount} records, category: ${parsed.category}`)

          // Merge user-provided metadata with parsed metadata
          let finalMetadata: Record<string, any> = {
            ...parsed.metadata,
            fields: parsed.fields,
            recordCount: parsed.recordCount,
          }

          // Add user-provided metadata if available
          if (fileRecord.metadata && typeof fileRecord.metadata === 'object') {
            finalMetadata = {
              ...finalMetadata,
              ...fileRecord.metadata,
            }
          }

          // Update file record with parsed data
          await supabase
            .from('uploaded_files')
            .update({
              parsed_data: parsed.structuredData, // Store parsed data in JSONB column
              category: fileRecord.metadata?.category || parsed.category,
              parsing_status: 'completed',
              metadata: finalMetadata,
            })
            .eq('id', fileRecord.id)

          // Store parsed data in seller_data_storage
          let datasetListingId: string | null = null
          if (parsed.structuredData.length > 0) {
            await dataStorageService.uploadData(
              req.userId,
              null, // No dataset listing yet - will be assigned automatically
              parsed.structuredData,
              {
                source_file: fileRecord.id,
                original_filename: file.originalname,
                file_type: fileType,
                category: parsed.category || 'General',
              }
            )

            // Automatically create/update endpoints for warehouse data
            await this.ensureWarehouseEndpoints(req.userId)
          }

          results.push({
            file_id: fileRecord.id,
            filename: file.originalname,
            file_type: fileType,
            status: 'completed',
            records_created: parsed.recordCount,
            category: parsed.category,
          })
        } catch (error) {
          // Update status to failed
          await supabase
            .from('uploaded_files')
            .update({
              parsing_status: 'failed',
              metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
            })
            .eq('id', fileRecord.id)

          results.push({
            file_id: fileRecord.id,
            filename: file.originalname,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      res.status(201).json({
        success: true,
        data: {
          uploaded: files.length,
          results,
        },
        message: `Processed ${files.length} file(s)`,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Get all seller's data with stats
   * GET /api/seller/data/view
   */
  async viewAllData(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      // Get all uploaded files
      const { data: files, error: filesError } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('seller_id', req.userId)
        .order('created_at', { ascending: false })

      if (filesError) {
        throw new Error(`Failed to get files: ${filesError.message}`)
      }

      // Get all data records
      const dataCount = await dataStorageService.getSellerDataCount(req.userId)

      // Calculate stats
      const stats = {
        total_files: files?.length || 0,
        total_records: dataCount,
        by_category: {} as Record<string, number>,
        by_file_type: {} as Record<string, number>,
        parsing_status: {
          completed: 0,
          parsing: 0,
          failed: 0,
          pending: 0,
        },
      }

      files?.forEach((file: any) => {
        // Count by category
        if (file.category) {
          stats.by_category[file.category] = (stats.by_category[file.category] || 0) + 1
        }

        // Count by file type
        if (file.file_type) {
          stats.by_file_type[file.file_type] = (stats.by_file_type[file.file_type] || 0) + 1
        }

        // Count by parsing status
        if (file.parsing_status) {
          stats.parsing_status[file.parsing_status as keyof typeof stats.parsing_status]++
        }
      })

      res.status(200).json({
        success: true,
        data: {
          files: files || [],
          stats,
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Get data records with pagination
   * GET /api/seller/data/records
   */
  async getDataRecords(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const limit = parseInt(req.query.limit as string) || 50
      const offset = parseInt(req.query.offset as string) || 0
      const datasetListingId = req.query.dataset_listing_id as string | undefined

      const records = await dataStorageService.getDataRecords(
        req.userId,
        datasetListingId || null,
        limit,
        offset
      )

      const total = await dataStorageService.getSellerDataCount(req.userId, datasetListingId)

      res.status(200).json({
        success: true,
        data: {
          records,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
          },
        },
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }

  /**
   * Analyze files and suggest metadata
   * POST /api/seller/files/suggest-metadata
   * Query param: ?type=structured|unstructured
   */
  async suggestMetadata(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      const files = req.files as Express.Multer.File[]
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No files provided',
        })
        return
      }

      // Check if structured or unstructured
      const isStructured = req.query.type === 'structured'

      // Use the first file for metadata suggestion
      const file = files[0]
      const fileType = getFileType(file.mimetype)

      logger.info(`Suggesting metadata for: ${file.originalname} (${isStructured ? 'structured' : 'unstructured'})`)

      // Get metadata suggestion from LLM
      const suggestion = await llmParsingService.suggestMetadata({
        fileType,
        mimeType: file.mimetype,
        fileData: file.buffer,
        filename: file.originalname,
      }, isStructured)

      res.json({
        success: true,
        data: suggestion,
      })
    } catch (error) {
      logger.error('Metadata suggestion error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to suggest metadata',
      })
    }
  }

  async ensureWarehouseEndpoints(sellerId: string): Promise<void> {
    try {
      logger.info(`[FileUploadController] Ensuring endpoints for seller: ${sellerId}`)
      
      const { DatasetService } = await import('../services/dataset.service.js')
      const datasetService = new DatasetService()
      const { supabase } = await import('../config/supabase.js')

      // First, check total data count in seller_data_storage
      const { count: totalDataCount } = await supabase
        .from('seller_data_storage')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
      
      logger.info(`[FileUploadController] Total data records in seller_data_storage: ${totalDataCount || 0}`)

      // Delete all old warehouse endpoints (those created from warehouse data) FIRST
      const { data: allEndpoints } = await supabase
        .from('dataset_listings')
        .select('id, name, metadata')
        .eq('seller_id', sellerId)

      logger.info(`[FileUploadController] Total existing endpoints: ${allEndpoints?.length || 0}`)

      const warehouseEndpoints = (allEndpoints || []).filter(ep => {
        const metadata = ep.metadata as Record<string, any> | null
        const hasWarehouseSource = metadata?.source === 'warehouse'
        const isGeneralWarehouse = ep.name === 'General Warehouse Data'
        const endsWithDataset = ep.name.endsWith(' Dataset') && ep.name !== 'General Warehouse Data'
        return hasWarehouseSource || isGeneralWarehouse || endsWithDataset
      })

      logger.info(`[FileUploadController] Warehouse endpoints to delete: ${warehouseEndpoints.length}`)
      warehouseEndpoints.forEach(ep => {
        logger.info(`[FileUploadController]   - ${ep.name} (${ep.id})`)
      })

      const warehouseEndpointIds = warehouseEndpoints.map(ep => ep.id)

      if (warehouseEndpointIds.length > 0) {
        // Count how many records are linked to these endpoints
        const { count: linkedCount } = await supabase
          .from('seller_data_storage')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', sellerId)
          .in('dataset_listing_id', warehouseEndpointIds)
        
        logger.info(`[FileUploadController] Records linked to warehouse endpoints: ${linkedCount || 0}`)

        // Unlink all data from old warehouse endpoints
        const { data: unlinkedData, count: unlinkedCount } = await supabase
          .from('seller_data_storage')
          .update({ dataset_listing_id: null })
          .eq('seller_id', sellerId)
          .in('dataset_listing_id', warehouseEndpointIds)
          .select('id', { count: 'exact' })
        
        logger.info(`[FileUploadController] Unlinked ${unlinkedCount || unlinkedData?.length || 0} records from warehouse endpoints`)
        
        // Delete old warehouse endpoints
        await supabase
          .from('dataset_listings')
          .delete()
          .in('id', warehouseEndpointIds)

        logger.info(`[FileUploadController] Deleted ${warehouseEndpointIds.length} old warehouse endpoints`)
      }

      // Check unlinked data count
      const { count: unlinkedDataCount } = await supabase
        .from('seller_data_storage')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
        .is('dataset_listing_id', null)
      
      logger.info(`[FileUploadController] Unlinked data records after cleanup: ${unlinkedDataCount || 0}`)

      // NOW get ALL seller data categorized (after unlinking, so we can count all warehouse data)
      const categorized = await dataStorageService.getAllSellerDataCategorized(sellerId)
      
      logger.info(`[FileUploadController] General data: ${categorized.general.recordCount} records`)
      logger.info(`[FileUploadController] Structured datasets: ${categorized.structured.size}`)
      if (categorized.general.recordCount === 0) {
        logger.warn(`[FileUploadController] ⚠️  No general data found! This means no general endpoint will be created.`)
      }

      // Create/update ONE general endpoint for all general data
      if (categorized.general.recordCount > 0) {
        // FIRST: Delete ALL existing "General Warehouse Data" endpoints to prevent duplicates
        const { data: existingGeneralEndpoints } = await supabase
          .from('dataset_listings')
          .select('id')
          .eq('seller_id', sellerId)
          .eq('name', 'General Warehouse Data')

        if (existingGeneralEndpoints && existingGeneralEndpoints.length > 0) {
          const existingIds = existingGeneralEndpoints.map(ep => ep.id)
          logger.info(`[FileUploadController] Found ${existingIds.length} existing General Warehouse Data endpoints, deleting duplicates`)

          // Unlink data from these endpoints
          await supabase
            .from('seller_data_storage')
            .update({ dataset_listing_id: null })
            .eq('seller_id', sellerId)
            .in('dataset_listing_id', existingIds)

          // Delete duplicate endpoints
          await supabase
            .from('dataset_listings')
            .delete()
            .in('id', existingIds)

          logger.info(`[FileUploadController] Deleted ${existingIds.length} duplicate General Warehouse Data endpoints`)
        }

        // NOW create/update ONE general endpoint
        const generalEndpoint = await datasetService.findOrCreateEndpointForCategory(
          sellerId,
          'General',
          {
            recordCount: categorized.general.recordCount,
            sampleRecords: categorized.general.sampleRecords,
            fields: categorized.general.fields,
          },
          true
        )

        logger.info(`[FileUploadController] General endpoint: ${generalEndpoint.id}`)

        // Link all general data to the general endpoint
        await supabase
          .from('seller_data_storage')
          .update({ dataset_listing_id: generalEndpoint.id })
          .eq('seller_id', sellerId)
          .is('dataset_listing_id', null)

        logger.info(`[FileUploadController] Linked ${categorized.general.recordCount} general records`)
      } else {
        logger.info(`[FileUploadController] No general data, skipping general endpoint creation`)
      }

      // For structured data, ensure each dataset has an endpoint
      // Structured datasets should already have endpoints, but verify they exist
      for (const [datasetListingId, structuredData] of categorized.structured.entries()) {
        const { data: existingDataset } = await supabase
          .from('dataset_listings')
          .select('id')
          .eq('id', datasetListingId)
          .single()

        if (!existingDataset) {
          // Structured dataset endpoint doesn't exist, skip (shouldn't happen)
          logger.warn(`[FileUploadController] Structured dataset ${datasetListingId} has no endpoint`)
        }
      }

      logger.info(`[FileUploadController] Done - ${categorized.general.recordCount > 0 ? '1' : '0'} general endpoint, ${categorized.structured.size} structured endpoints`)
    } catch (error) {
      logger.error(`[FileUploadController] Error:`, error)
      throw error // Re-throw so the caller knows it failed
    }
  }
}

