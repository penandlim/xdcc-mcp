import { z } from 'zod';

/**
 * Input schema for the initiate download tool
 */
export const InitiateDownloadToolInputSchema = z.object({
  host: z.string().min(1).describe(
    'IRC server hostname'
  ),
  port: z.number().int().min(1).max(65535).optional().default(6667).describe(
    'IRC server port (default: 6667)'
  ),
  channel: z.string().min(1).describe(
    'IRC channel to join (e.g., "#channel")'
  ),
  bot: z.string().min(1).describe(
    'XDCC bot nickname'
  ),
  packs: z.string().min(1).describe(
    'Pack numbers to download (e.g., "1-3,5,7-9")'
  ),
  download_path: z.string().optional().default('./downloads').describe(
    'Directory to save files (default: "./downloads")'
  ),
  nickname: z.string().optional().default('MCPBot').describe(
    'IRC nickname to use for the connection (default: "MCPBot")'
  )
});

export type InitiateDownloadToolInput = z.infer<typeof InitiateDownloadToolInputSchema>;

/**
 * Response structure for the initiate download tool
 */
export interface InitiateDownloadToolResponse {
  job_id: string;
  message: string;
  status: 'started' | 'failed';
}

/**
 * Download job status type
 */
export type DownloadJobStatus = 'in_progress' | 'completed' | 'failed' | 'partially_completed';

/**
 * Download job information structure
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
  errors: string[];
  startTime: string;
  endTime?: string;
  status: DownloadJobStatus;
}