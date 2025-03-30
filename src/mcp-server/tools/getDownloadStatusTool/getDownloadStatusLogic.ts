
import { logger } from '../../../utils/logger.js';
import { DownloadJob, DownloadJobStatus } from '../initiateDownloadTool/initiateDownloadLogic.js';
import { downloadJobs } from '../initiateDownloadTool/initiateDownloadLogic.js';
import { z } from 'zod';

// Define context for logging within this tool logic module
const toolLogicContext = {
  module: 'GetDownloadStatusToolLogic'
};

// --- Schema and Type Definitions (Moved from types.ts) ---

/**
 * Input schema for the get download status tool
 */
export const GetDownloadStatusToolInputSchema = z.object({
  job_id: z.string().min(1).describe(
    'ID of the download job to check'
  )
});

export type GetDownloadStatusToolInput = z.infer<typeof GetDownloadStatusToolInputSchema>;

/**
 * Response structure for the get download status tool
 */
export interface GetDownloadStatusToolResponse {
  job_id: string;
  status: DownloadJobStatus;
  completedPacks: number[];
  failedPacks: number[];
  progress: string;
  message: string;
  errors: { message: string; stack?: string }[];
  startTime?: string;
  endTime?: string;
}

// --- Core Logic Function ---
/**
 * Retrieves the status of a download job.
 *
 * @param {GetDownloadStatusToolInput} params - The input parameters for the get download status tool.
 * @returns {GetDownloadStatusToolResponse} The response containing the download job status and details.
 */
export const getDownloadStatus = (
  params: GetDownloadStatusToolInput
): GetDownloadStatusToolResponse => {
  const processingContext = { ...toolLogicContext, operation: 'getDownloadStatus', jod_id: params.job_id }
  logger.debug("Processing get download status logic", processingContext);
  // Retrieve job information
  const job = downloadJobs.get(params.job_id);

  const response: GetDownloadStatusToolResponse = {
    job_id: params.job_id,
    status: 'in_progress',
    completedPacks: [],
    failedPacks: [],
    progress: '0%',
    message: 'Download job in progress',
    errors: []
  };

  if (!job) {
    logger.warn("Download job not found", {
      job_id: params.job_id,
      processingContext
    });
    response.status = 'failed';
    response.message = `Download job with ID ${params.job_id} not found`;
    return response;
  }

  // Calculate progress percentage
  let progressPercent = 0;
  const totalRequested = job.requestedPacks.size;
  const totalCompleted = job.completedPacks.size;

  if (totalRequested > 0) {
    progressPercent = Math.round((totalCompleted / totalRequested) * 100);
  }

  // Generate a human-readable message based on status
  let message = '';
  switch (job.status) {
    case 'in_progress':
      message = `Download in progress: ${totalCompleted}/${totalRequested} packs completed (${progressPercent}%)`;
      break;
    case 'completed':
      message = `Download completed: all ${totalRequested} packs downloaded successfully`;
      break;
    case 'failed':
      message = `Download failed: ${job.errors.length} errors occurred`;
      break;
    case 'partially_completed':
      message = `Download partially completed: ${totalCompleted}/${totalRequested} packs downloaded, ${job.failedPacks.size} packs failed`;
      break;
  }

  // Create the response
  response.status = job.status;
  response.completedPacks = Array.from(job.completedPacks);
  response.failedPacks = Array.from(job.failedPacks);
  response.progress = `${progressPercent}% (${totalCompleted}/${totalRequested})`;
  response.message = message;
  response.errors = job.errors;
  response.startTime = job.startTime;

  if (job.status !== 'in_progress') {
    response.endTime = job.endTime;
  }

  logger.info("Download status retrieved", {
    job_id: job.id,
    status: job.status,
    progress: `${progressPercent}%`,
    processingContext
  });

  return response;
};

