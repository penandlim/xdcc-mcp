import { z } from 'zod';
import { BaseErrorCode, McpError } from '../../../types-global/errors.js';
import { logger } from '../../../utils/logger.js';
import XDCC, { FileInfo, Job } from 'xdccjs';
import * as fs from 'fs';
import * as crypto from 'crypto';


// Define context for logging within this tool logic module
const toolLogicContext = {
  module: 'InitiateDownloadLogic',
  service: 'InitiateDownloadTool'
};

// --- Schema and Type Definitions ---

/**
 * Zod schema defining the input parameters for the initiate_download tool.
 */
export const InitiateDownloadToolInputSchema = z.object({
  host: z.string().min(1).describe('IRC server hostname, (e.g. "irc.example.com")'),
  port: z.number().int().min(1).max(65535).optional().default(6667).describe('IRC server port (optional, defaults to 6667)'),
  channel: z.string().min(1).describe('IRC channel name, (e.g. "#example")'),
  bot: z.string().min(1).describe('XDCC bot name you are downloading from'),
  packs: z.string().min(1).describe('Pack numbers to download (e.g. "1-3,5,7-9")'),
  download_path: z.string().min(1).optional().default('./downloads/').describe('Path to save downloaded files (optional, defaults to ./downloads/)'),
  nickname: z.string().min(1).optional().default('MCPUser').describe('IRC nickname to use (optional, defaults to unique hardware ID-based nickname)')
}).describe('Input parameters for initiating XDCC downloads');

/**
 * TypeScript type inferred from InitiateDownloadToolInputSchema
 */
export type InitiateDownloadToolInput = z.infer<typeof InitiateDownloadToolInputSchema>;

/**
 * Status of a download job
 */
export type DownloadJobStatus = 'in_progress' | 'completed' | 'failed' | 'partially_completed';

/**
 * Interface for download job tracking
 */
export interface DownloadJob {
  id: string;
  host: string;
  port: number;
  channel: string;
  bot: string;
  requestedPacks: Set<number>;
  completedPacks: Set<number>;
  failedPacks: Set<number>;
  errors: Array<{ message: string; stack?: string }>;
  startTime: string;
  endTime?: string;
  status: DownloadJobStatus;
}

/**
 * Response structure for the initiate_download tool
 */
export interface InitiateDownloadToolResponse {
  job_id: string;
  message: string;
  status: DownloadJobStatus;
}

// --- Global State Management ---

// Map to store IRC connections, keyed by host:port
const ircConnections = new Map<string, XDCC.default>();

// Map to store download jobs
export const downloadJobs = new Map<string, DownloadJob>();

// --- Helper Functions ---

/**
 * Generate a unique job ID
 */
const generateJobId = (): string => {
  return `job_${crypto.randomBytes(8).toString('hex')}`;
};

/**
 * Expand pack numbers from string format (e.g., "1-3,5,7-9") into a deduplicated set
 */
const expandPacks = (packsString: string): Set<number> => {
  const numbers = packsString.split(',').flatMap((part) => {
    const trimmed = part.trim();
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-').map(s => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end) || start > end) {
        return [];
      }
      return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    } else {
      const num = parseInt(trimmed, 10);
      return isNaN(num) ? [] : [num];
    }
  });
  
  return new Set(numbers);
};

/**
 * Get or create an XDCC connection for a host:port
 */
const getXdccConnection = (host: string, port: number, nickname: string, downloadPath: string): XDCC.default => {
  const connectionKey = `${host}:${port}`;
  
  if (!ircConnections.has(connectionKey)) {
    // Ensure download directory exists
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
    
    logger.info(`Creating new XDCC connection to ${connectionKey}`, { 
      ...toolLogicContext,
      host, 
      port, 
      nickname, 
      downloadPath 
    });
    
    const xdcc = new XDCC.default({ 
      host: host, 
      port: port, 
      nickname: nickname, 
      path: downloadPath 
    });
    
    ircConnections.set(connectionKey, xdcc);
  }
  
  return ircConnections.get(connectionKey)!;
};

/**
 * Core logic for initiating a download
 */
export const initiateDownload = (params: InitiateDownloadToolInput): InitiateDownloadToolResponse => {
  const processingContext = { ...toolLogicContext, operation: 'initiateDownload' };
  logger.debug("Processing initiate download request", { ...processingContext, params });

  // Sanitize string inputs for safety
  const sanitizedParams = {
    ...params,
    host: params.host.trim(),
    channel: params.channel.trim(),
    bot: params.bot.trim(),
    packs: params.packs.trim(),
    download_path: params.download_path.trim(),
    nickname: params.nickname.trim()
  };

  // Expand pack numbers
  const requestedPacks = expandPacks(sanitizedParams.packs);
  
  if (requestedPacks.size === 0) {
    throw new McpError(
      BaseErrorCode.VALIDATION_ERROR,
      'No valid pack numbers provided',
      processingContext
    );
  }
  
  // Generate a job ID and create response
  const jobId = generateJobId();
  const response: InitiateDownloadToolResponse = {
    job_id: jobId,
    message: `Download started for ${requestedPacks.size} file(s)`,
    status: 'in_progress'
  };
  
  // Create a job record
  const job: DownloadJob = {
    id: jobId,
    host: sanitizedParams.host,
    port: sanitizedParams.port,
    channel: sanitizedParams.channel,
    bot: sanitizedParams.bot,
    requestedPacks,
    completedPacks: new Set(),
    failedPacks: new Set(),
    errors: [],
    startTime: new Date().toISOString(),
    status: 'in_progress'
  };
  
  downloadJobs.set(jobId, job);
  
  // Get or create XDCC connection
  const xdcc = getXdccConnection(
    sanitizedParams.host,
    sanitizedParams.port,
    sanitizedParams.nickname,
    sanitizedParams.download_path
  );
  
  // Join the channel if needed
  xdcc.join(sanitizedParams.channel);
  
  // Start the download process asynchronously
  setTimeout(() => {
    logger.debug("Starting XDCC download", {
      ...processingContext,
      jobId,
      channel: sanitizedParams.channel,
      bot: sanitizedParams.bot,
      packs: Array.from(requestedPacks)
    });
    
    xdcc.download(sanitizedParams.bot, Array.from(requestedPacks).map(String))   
      .then((xdccJob: Job) => {
        // Register event handlers for tracking progress
        xdccJob.on('downloading', (fileInfo: FileInfo, received: number, percentage: number, eta: number) => {
          logger.debug("Download in progress", {
            ...processingContext,
            jobId,
            pack: xdccJob.show().now,
            file: fileInfo.file,
            received,
            progress: percentage,
            eta
          });
        });
        
        xdccJob.on('downloaded', (fileInfo: FileInfo) => {
          const completedPacks = xdccJob.show().success;
          completedPacks.map(Number).forEach(num => job.completedPacks.add(num));
          
          logger.info("Pack download complete", {
            ...processingContext,
            jobId,
            file: fileInfo.file,
            completedPacks: Array.from(job.completedPacks)
          });
          
          // Check if all packs are completed
          if (job.completedPacks.size === requestedPacks.size) {
            job.status = 'completed';
            logger.info("All downloads completed successfully", {
              ...processingContext,
              jobId,
              completedPacks: Array.from(job.completedPacks)
            });
          }
        });
        
        xdccJob.on('error', (errorMessage: string, fileInfo?: FileInfo) => {
          const error = {
            message: errorMessage,
            stack: new Error().stack
          };
          
          job.errors.push(error);
          
          logger.error("Download error occurred", {
            ...processingContext,
            jobId,
            error: error.message,
            stack: error.stack,
            fileInfo
          });
          
          // Mark the job as failed if there are errors
          job.status = 'failed';
        });
      })
      .catch((error: Error) => {
        job.errors.push({
          message: error.message,
          stack: error.stack
        });
        job.status = 'failed';
        
        logger.error("Failed to start download", {
          ...processingContext,
          jobId,
          error: error.message,
          stack: error.stack
        });
      });
  }, 0);

  logger.info("Download job initiated successfully", { ...processingContext, jobId });
  return response;
}; 