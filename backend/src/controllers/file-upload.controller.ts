import { Request, Response } from 'express'
import { supabase } from '../config/supabase.js'
import { ParsingService } from '../services/parsing.service.js'
import { DataStorageService } from '../services/data-storage.service.js'
import { getFileType } from '../middleware/upload.middleware.js'
import { WalletService } from '../services/wallet.service.js'

const parsingService = new ParsingService()
const dataStorageService = new DataStorageService()
const walletService = new WalletService()

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

      // Get seller's wallet for x402 payments (if needed for parsing)
      const sellerWallet = await walletService.getWallet(req.userId)
      const agentWalletId = sellerWallet?.id || ''

      const results = []

      for (const file of files) {
        const fileType = getFileType(file.mimetype)

        // Create file record
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
            metadata: {},
          })
          .select()
          .single()

        if (fileError) {
          console.error('Failed to create file record:', fileError)
          continue
        }

        try {
          // Parse unstructured data using x402 AI services
          const parsed = await parsingService.parseUnstructuredData(agentWalletId, {
            fileType,
            mimeType: file.mimetype,
            fileData: file.buffer,
            options: {
              extractText: true,
              extractMetadata: true,
              categorize: true,
            },
          })

          // Update file record with parsed data
          await supabase
            .from('uploaded_files')
            .update({
              parsed_data: parsed.structuredData,
              category: parsed.category,
              parsing_status: 'completed',
              metadata: {
                ...parsed.metadata,
                fields: parsed.fields,
                recordCount: parsed.recordCount,
              },
            })
            .eq('id', fileRecord.id)

          // Store parsed data in seller_data_storage
          if (parsed.structuredData.length > 0) {
            await dataStorageService.uploadData(
              req.userId,
              null, // No dataset listing yet
              parsed.structuredData,
              {
                source_file: fileRecord.id,
                original_filename: file.originalname,
                file_type: fileType,
                category: parsed.category,
              }
            )
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
}

