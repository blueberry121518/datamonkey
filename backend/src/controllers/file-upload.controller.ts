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
      logger.info(`Step 1: File upload request received`)
      if (!req.userId) {
        logger.info(`Step 2: User not authenticated, returning 401 error`)
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
        })
        return
      }

      logger.info(`Step 2: User authenticated - userId: ${req.userId}`)
      const files = req.files as Express.Multer.File[]
      if (!files || files.length === 0) {
        logger.info(`Step 3: No files provided, returning 400 error`)
        res.status(400).json({
          success: false,
          error: 'No files uploaded',
        })
        return
      }

      logger.info(`Step 3: Processing ${files.length} file(s)`)
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
        logger.info(`Step 4: Processing file: ${file.originalname}`)
        const fileType = getFileType(file.mimetype)
        logger.info(`Step 5: File type determined: ${fileType}, size: ${(file.size / 1024).toFixed(2)} KB`)

        // Create file record with user metadata
        logger.info(`Step 6: Creating file record in database`)
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
          logger.info(`Step 7: Failed to create file record, skipping file`)
          continue
        }
        logger.info(`Step 7: File record created - fileId: ${fileRecord.id}`)

        try {
          // Parse unstructured data using LLM (Claude or x402)
          logger.info(`Step 8: Parsing file data using LLM service`)
          const parsed = await llmParsingService.parseUnstructuredData({
            fileType,
            mimeType: file.mimetype,
            fileData: file.buffer,
            filename: file.originalname,
          })
          logger.info(`Step 9: File parsed successfully - ${parsed.recordCount} records extracted, category: ${parsed.category}`)

          // Merge user-provided metadata with parsed metadata
          logger.info(`Step 10: Merging metadata`)
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
          logger.info(`Step 11: Updating file record with parsed data`)
          await supabase
            .from('uploaded_files')
            .update({
              parsed_data: parsed.structuredData, // Store parsed data in JSONB column
              category: fileRecord.metadata?.category || parsed.category,
              parsing_status: 'completed',
              metadata: finalMetadata,
            })
            .eq('id', fileRecord.id)
          logger.info(`Step 12: File record updated successfully`)

          // Store parsed data in seller_data_storage
          let datasetListingId: string | null = null
          if (parsed.structuredData.length > 0) {
            logger.info(`Step 13: Checking if endpoint exists for category: ${parsed.category || 'General'}`)
            
            // Check if there's already an endpoint for this category
            const { DatasetService } = await import('../services/dataset.service.js')
            const datasetService = new DatasetService()
            const existingDatasets = await datasetService.getSellerDatasets(req.userId)
            
            // Filter to only structured endpoints (not warehouse)
            const structuredEndpoints = existingDatasets.filter(d => !d.id.startsWith('warehouse-'))
            
            // Try to find a matching endpoint by category or name
            let matchingEndpoint = null
            const category = parsed.category || 'General'
            if (category && structuredEndpoints.length > 0) {
              matchingEndpoint = structuredEndpoints.find(d => 
                (d.category && d.category === category) || 
                d.name.toLowerCase().includes(category.toLowerCase()) ||
                category.toLowerCase().includes(d.name.toLowerCase())
              )
            }
            
            // Fallback: If no match but there's only one structured endpoint with no data, use it
            if (!matchingEndpoint && structuredEndpoints.length === 1) {
              const singleEndpoint = structuredEndpoints[0]
              // Check if this endpoint has any linked data
              const { count: linkedCount } = await supabase
                .from('seller_data_storage')
                .select('*', { count: 'exact', head: true })
                .eq('seller_id', req.userId)
                .eq('dataset_listing_id', singleEndpoint.id)
              
              if (linkedCount === 0) {
                matchingEndpoint = singleEndpoint
                logger.info(`Step 13b: Using single structured endpoint ${singleEndpoint.id} (has no data yet)`)
              }
            }
            
            if (matchingEndpoint && !matchingEndpoint.id.startsWith('warehouse-')) {
              datasetListingId = matchingEndpoint.id
              logger.info(`Step 13b: Found existing endpoint ${datasetListingId} for category ${category}`)
            } else {
              logger.info(`Step 13b: No existing endpoint found, will create one`)
            }
            
            logger.info(`Step 13c: Storing parsed data in seller data storage with dataset_listing_id: ${datasetListingId || 'NULL'}`)
            await dataStorageService.uploadData(
              req.userId,
              datasetListingId, // Link to existing endpoint if found, otherwise null
              parsed.structuredData,
              {
                source_file: fileRecord.id,
                original_filename: file.originalname,
                file_type: fileType,
                category: parsed.category || 'General',
              }
            )
            logger.info(`Step 14: Data stored in seller data storage`)

            // Automatically create/update endpoints for warehouse data (and link data to new endpoints)
            logger.info(`Step 15: Ensuring warehouse endpoints are created`)
            await this.ensureWarehouseEndpoints(req.userId)
            logger.info(`Step 16: Warehouse endpoints ensured`)
          }

          logger.info(`Step 17: File processing completed successfully`)
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
          logger.info(`Step 8: Error parsing file, updating status to failed`)
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

      logger.info(`Step 18: All files processed, returning response`)
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

      logger.info(`Step 4: Suggesting metadata for file: ${file.originalname} (${isStructured ? 'structured' : 'unstructured'})`)

      // Get metadata suggestion from LLM
      logger.info(`Step 5: Calling LLM service to suggest metadata`)
      const suggestion = await llmParsingService.suggestMetadata({
        fileType,
        mimeType: file.mimetype,
        fileData: file.buffer,
        filename: file.originalname,
      }, isStructured)
      logger.info(`Step 6: Metadata suggestion received from LLM`)
      logger.info(`Step 7: Returning metadata suggestion response`)

      res.json({
        success: true,
        data: suggestion,
      })
    } catch (error) {
      logger.info(`Step 1: Error suggesting metadata: ${error instanceof Error ? error.message : 'Unknown error'}`)
      res.status(500).json({
        success: false,
        error: 'Failed to suggest metadata',
      })
    }
  }

  async ensureWarehouseEndpoints(sellerId: string): Promise<void> {
    try {
      logger.info(`Step 1: Ensuring warehouse endpoints for seller: ${sellerId}`)
      
      const { DatasetService } = await import('../services/dataset.service.js')
      const datasetService = new DatasetService()
      const { supabase } = await import('../config/supabase.js')

      // First, check total data count in seller_data_storage
      logger.info(`Step 2: Checking total data count in seller_data_storage`)
      const { count: totalDataCount } = await supabase
        .from('seller_data_storage')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', sellerId)
      logger.info(`Step 3: Total data records found: ${totalDataCount || 0}`)

      // Warehouse endpoints are now virtual (dynamically created from data)
      // Clean up any old warehouse endpoints that might still exist in dataset_listings
      // (leftover from previous implementation)
      logger.info(`Step 4: Cleaning up any old warehouse endpoints from dataset_listings`)
      const { data: oldWarehouseEndpoints } = await supabase
        .from('dataset_listings')
        .select('id')
        .eq('seller_id', sellerId)
        .or('name.eq.General Warehouse Data,metadata->>source.eq.warehouse')
      
      if (oldWarehouseEndpoints && oldWarehouseEndpoints.length > 0) {
        const oldEndpointIds = oldWarehouseEndpoints.map(ep => ep.id)
        logger.info(`Step 5: Found ${oldEndpointIds.length} old warehouse endpoints to delete`)
        
        // Unlink data from old endpoints
        await supabase
          .from('seller_data_storage')
          .update({ dataset_listing_id: null })
          .eq('seller_id', sellerId)
          .in('dataset_listing_id', oldEndpointIds)
        
        // Delete old warehouse endpoints
        await supabase
          .from('dataset_listings')
          .delete()
          .in('id', oldEndpointIds)
        
        logger.info(`Step 6: Deleted ${oldEndpointIds.length} old warehouse endpoints`)
      } else {
        logger.info(`Step 5: No old warehouse endpoints found`)
      }

      // NOW get ALL seller data categorized (after unlinking, so we can count all warehouse data)
      logger.info(`Step 16: Categorizing seller data`)
      const categorized = await dataStorageService.getAllSellerDataCategorized(sellerId)
      logger.info(`Step 17: General data: ${categorized.general.recordCount} records, Structured datasets: ${categorized.structured.size}`)

      // Warehouse endpoint is now dynamically created from data
      // No need to create/update it in dataset_listings - it's virtual
      // Just ensure data is not linked to any endpoint (dataset_listing_id = NULL for warehouse data)
      if (categorized.general.recordCount > 0) {
        logger.info(`Step 18: Warehouse data exists (${categorized.general.recordCount} records) - endpoint will be dynamically created`)
        // Ensure all warehouse data has dataset_listing_id = NULL
        // This marks it as unstructured warehouse data
        logger.info(`Step 19: Ensuring warehouse data is unlinked (dataset_listing_id = NULL)`)
        await supabase
          .from('seller_data_storage')
          .update({ dataset_listing_id: null })
          .eq('seller_id', sellerId)
          .is('dataset_listing_id', null)
        logger.info(`Step 20: Warehouse data ready - endpoint is virtual, not stored`)
      } else {
        logger.info(`Step 18: No warehouse data - no virtual endpoint will be created`)
      }

      // First, check if existing endpoints have data - if not, try to link warehouse data to them
      logger.info(`Step 24: Checking existing structured endpoints for data`)
      const allEndpoints = await datasetService.getSellerDatasets(sellerId)
      const structuredEndpoints = allEndpoints.filter(d => !d.id.startsWith('warehouse-'))
      logger.info(`Step 24b: Found ${structuredEndpoints.length} existing structured endpoints`)
      
      // Get all unlinked warehouse data (dataset_listing_id IS NULL)
      const { data: unlinkedWarehouseData } = await supabase
        .from('seller_data_storage')
        .select('id, data_record, metadata')
        .eq('seller_id', sellerId)
        .is('dataset_listing_id', null)
        .limit(100) // Limit to avoid performance issues
      
      logger.info(`Step 24c: Found ${unlinkedWarehouseData?.length || 0} unlinked warehouse records`)
      
      // For each existing structured endpoint, check if it has data
      for (const endpoint of structuredEndpoints) {
        const { count: linkedDataCount } = await supabase
          .from('seller_data_storage')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', sellerId)
          .eq('dataset_listing_id', endpoint.id)
        
        logger.info(`Step 24d: Endpoint ${endpoint.id} (${endpoint.name}) has ${linkedDataCount || 0} linked records`)
        
        if (linkedDataCount === 0 && unlinkedWarehouseData && unlinkedWarehouseData.length > 0) {
          logger.info(`Step 24e: Endpoint ${endpoint.id} (${endpoint.name}) has no data - checking for matching warehouse data`)
          
          // Try to match warehouse data by category or name
          const endpointCategory = endpoint.category || endpoint.name.toLowerCase()
          const endpointNameWords = endpoint.name.toLowerCase().split(/\s+/)
          
          let matchingRecords = unlinkedWarehouseData.filter(record => {
            const recordCategory = record.metadata?.category || 
                                   record.data_record?.category || 
                                   record.data_record?.type ||
                                   'General'
            const recordCategoryLower = recordCategory.toLowerCase()
            const endpointCategoryLower = endpointCategory.toLowerCase()
            
            // Check if category matches
            if (recordCategoryLower.includes(endpointCategoryLower) ||
                endpointCategoryLower.includes(recordCategoryLower)) {
              return true
            }
            
            // Check if any endpoint name words appear in the record
            for (const word of endpointNameWords) {
              if (word.length > 3 && // Only check words longer than 3 chars
                  (recordCategoryLower.includes(word) ||
                   JSON.stringify(record.data_record).toLowerCase().includes(word))) {
                return true
              }
            }
            
            return false
          })
          
          // If no matches found but there's only one endpoint with no data, link all unlinked data to it
          if (matchingRecords.length === 0 && structuredEndpoints.length === 1 && unlinkedWarehouseData.length > 0) {
            logger.info(`Step 24f: No matches found, but only one endpoint exists - linking all ${unlinkedWarehouseData.length} unlinked records to it`)
            matchingRecords = unlinkedWarehouseData
          }
          
          if (matchingRecords.length > 0) {
            const recordIds = matchingRecords.map(r => r.id)
            logger.info(`Step 24g: Found ${matchingRecords.length} matching warehouse records - linking to endpoint ${endpoint.id}`)
            
            await supabase
              .from('seller_data_storage')
              .update({ dataset_listing_id: endpoint.id })
              .eq('seller_id', sellerId)
              .in('id', recordIds)
            
            logger.info(`Step 24h: Linked ${matchingRecords.length} records to endpoint ${endpoint.id}`)
            
            // Remove linked records from unlinkedWarehouseData for next iterations
            matchingRecords.forEach(r => {
              const index = unlinkedWarehouseData.findIndex(ur => ur.id === r.id)
              if (index > -1) unlinkedWarehouseData.splice(index, 1)
            })
          }
        }
      }

      // For structured data, ensure each dataset has an endpoint
      // If endpoint doesn't exist, try to match with existing endpoints or create a new one
      logger.info(`Step 25: Verifying structured dataset endpoints`)
      let createdCount = 0
      let linkedCount = 0
      
      // Re-categorize after potential linking above
      const categorizedAfterLinking = await dataStorageService.getAllSellerDataCategorized(sellerId)
      
      for (const [datasetListingId, structuredData] of categorizedAfterLinking.structured.entries()) {
        const { data: existingDataset } = await supabase
          .from('dataset_listings')
          .select('id')
          .eq('id', datasetListingId)
          .single()

        if (!existingDataset) {
          logger.info(`Step 26: Structured data group ${datasetListingId} has no endpoint - trying to match or create one`)
          
          // Try to find matching endpoint by category
          let matchedEndpoint = null
          let categoryFromData = 'General'
          if (structuredData.sampleRecords.length > 0) {
            const firstRecord = structuredData.sampleRecords[0]
            if (firstRecord.category) categoryFromData = firstRecord.category
            else if (firstRecord.type) categoryFromData = firstRecord.type
            else if (firstRecord.datasetType) categoryFromData = firstRecord.datasetType
          }
          
          // Try to match with existing endpoint by category
          matchedEndpoint = structuredEndpoints.find(ep => 
            ep.category === categoryFromData || 
            ep.name.toLowerCase().includes(categoryFromData.toLowerCase()) ||
            categoryFromData.toLowerCase().includes(ep.name.toLowerCase())
          )
          
          if (matchedEndpoint) {
            // Link data to existing endpoint
            logger.info(`Step 26b: Found matching endpoint ${matchedEndpoint.id} for category ${categoryFromData} - linking data`)
            const { data: linkedData } = await supabase
              .from('seller_data_storage')
              .update({ dataset_listing_id: matchedEndpoint.id })
              .eq('seller_id', sellerId)
              .eq('dataset_listing_id', datasetListingId)
              .select('id')
            
            logger.info(`Step 26c: Linked ${linkedData?.length || 0} records to existing endpoint ${matchedEndpoint.id}`)
            linkedCount++
          } else {
            // Create new endpoint
            logger.info(`Step 26d: No matching endpoint found - creating new one for category ${categoryFromData}`)
            const autoMetadata = datasetService.autoDetectMetadata(structuredData.sampleRecords)
            
            try {
              const newEndpoint = await datasetService.createDataset(sellerId, {
                name: categoryFromData,
                description: `${categoryFromData} data: ${structuredData.recordCount} records`,
                category: categoryFromData,
                type: 'api',
                price_per_record: 0.001,
                schema: autoMetadata.schema,
                total_rows: structuredData.recordCount,
                quality_score: autoMetadata.quality_score || 0.8,
                content_summary: autoMetadata.content_summary || `Dataset with ${structuredData.recordCount} records`,
              })
              
              // Update data to link to the new endpoint
              await supabase
                .from('seller_data_storage')
                .update({ dataset_listing_id: newEndpoint.id })
                .eq('seller_id', sellerId)
                .eq('dataset_listing_id', datasetListingId)
              
              logger.info(`Step 27: Created endpoint ${newEndpoint.id} for structured data (${structuredData.recordCount} records)`)
              createdCount++
            } catch (error) {
              logger.info(`Step 27: Failed to create endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
          }
        } else {
          logger.info(`Step 26: Structured dataset ${datasetListingId} already has endpoint`)
        }
      }

      logger.info(`Step 28: Warehouse endpoints ensured - ${categorizedAfterLinking.general.recordCount > 0 ? '1' : '0'} general endpoint, ${categorizedAfterLinking.structured.size} structured endpoints (${createdCount} created, ${linkedCount} linked)`)
    } catch (error) {
      logger.info(`Step 1: Error ensuring warehouse endpoints: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error // Re-throw so the caller knows it failed
    }
  }
}

