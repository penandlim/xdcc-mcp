import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Import schema and types from the logic file
import { BaseErrorCode, McpError } from "../../../types-global/errors.js";
import { ErrorHandler } from "../../../utils/errorHandler.js";
import { logger } from "../../../utils/logger.js";
// Import the core logic function
import { getDownloadStatus, GetDownloadStatusToolInput, GetDownloadStatusToolInputSchema } from "./getDownloadStatusLogic.js";

// Define context for logging within this tool module
const toolModuleContext = {
  module: 'GetDownloadStatusToolRegistration'
};

/**
 * Registers the 'get_download_status' tool and its handler with the provided MCP server instance.
 * Defines the tool's input schema, description, and the core request handling logic.
 * Error handling is integrated using ErrorHandler.
 *
 * @async
 * @function registerGetDownloadStatusTool
 * @param {McpServer} server - The MCP server instance to register the tool with.
 * @returns {Promise<void>} A promise that resolves when the tool registration is complete.
 * @throws {McpError} Throws an McpError if the registration process fails critically.
 */
export const registerGetDownloadStatusTool = async (server: McpServer): Promise<void> => {
  const toolName = "get_download_status"; // The unique identifier for the tool
  const registrationContext = { ...toolModuleContext, toolName };

  logger.info(`Registering tool: ${toolName}`, registrationContext);

  // Use ErrorHandler to wrap the entire registration process
  await ErrorHandler.tryCatch(
    async () => {
      // Register the tool using server.tool()
      server.tool(
        toolName,
        // --- Tool Input Schema (Raw Shape) ---
        // Pass the raw shape of the Zod schema. The SDK uses this for validation.
        // Descriptions from the schema's .describe() calls are likely used for metadata.
        GetDownloadStatusToolInputSchema.shape,
        // --- Tool Handler ---
        // The core logic executed when the tool is called.
        // Params are automatically validated against the provided schema shape by the SDK.
        async (params: GetDownloadStatusToolInput) => {
          const handlerContext = { ...registrationContext, operation: 'handleRequest', params };
          logger.debug("Handling get download status tool request", handlerContext);

          // Wrap the handler logic in tryCatch for robust error handling
          return await ErrorHandler.tryCatch(
            async () => {
              // Delegate the core processing logic
              const response = getDownloadStatus(params);
              logger.debug("Get Download Status tool processed successfully", handlerContext);

              // Return the response in the standard MCP tool result format
              return {
                content: [{
                  type: "text", // Content type is text
                  // The actual content is a JSON string representing the GetDownloadStatusToolResponse
                  text: JSON.stringify(response, null, 2)
                }]
              };
            },
            {
              // Configuration for the error handler specific to this tool call
              operation: 'processing get download status handler',
              context: handlerContext, // Pass handler-specific context
              input: params, // Log input parameters on error
              // Provide a custom error mapping for more specific error reporting
              errorMapper: (error) => new McpError(
                // Use VALIDATION_ERROR if the error likely stems from processing invalid (though schema-valid) input
                error instanceof McpError ? error.code : BaseErrorCode.INTERNAL_ERROR,
                `Error processing get download status tool: ${error instanceof Error ? error.message : 'Unknown error'}`,
                { ...handlerContext } // Include context in the McpError
              )
            }
          );
        }
      ); // End of server.tool call

      logger.info(`Tool registered successfully: ${toolName}`, registrationContext);
    },
    {
      // Configuration for the error handler wrapping the entire registration
      operation: `registering tool ${toolName}`,
      context: registrationContext, // Context for registration-level errors
      errorCode: BaseErrorCode.INTERNAL_ERROR, // Default error code for registration failure
      // Custom error mapping for registration failures
      errorMapper: (error) => new McpError(
        error instanceof McpError ? error.code : BaseErrorCode.INTERNAL_ERROR,
        `Failed to register tool '${toolName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        { ...registrationContext } // Include context in the McpError
      ),
      critical: true // Mark registration failure as critical to halt startup
    }
  ); // End of ErrorHandler.tryCatch for registration
};
