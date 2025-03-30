# XDCC MCP Server

[![TypeScript](https://img.shields.io/badge/TypeScript-^5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-^1.8.0-green.svg)](https://modelcontextprotocol.io/)
[![xdccJS](https://img.shields.io/badge/xdccJS-^5.4.11-blue.svg)](https://github.com/JiPaix/xdccJS)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

An MCP (Model Context Protocol) server that enables AI agents to download files from IRC via XDCC. This server integrates with [xdccJS](https://github.com/JiPaix/xdccJS) to provide a robust and efficient XDCC download capability through the Model Context Protocol.

## Features

- **XDCC Downloads**: Initiate and manage XDCC downloads from IRC bots
- **Connection Pooling**: Efficient IRC connection management with connection reuse
- **Download Status Tracking**: Real-time monitoring of download progress
- **File Deduplication**: Prevents duplicate downloads by checking existing files
- **Async Operations**: Non-blocking download operations with job IDs
- **Dynamic Resource Exposure**: Downloaded files are automatically exposed as MCP resources
- **Error Handling**: Comprehensive error tracking and reporting

## MCP Tools

### initiate_download
Starts a new XDCC download with the following parameters:
- `host`: IRC server hostname
- `channel`: Channel name
- `bot`: Bot nickname
- `pack`: Pack number or ID
- Returns a job ID for status tracking

### get_download_status
Checks the status of an ongoing download:
- `job_id`: The ID returned by initiate_download
- Returns download progress, completion status, and any errors

## MCP Resources

Downloaded files are exposed through the `downloads://` protocol:
```
downloads://filename.ext
```

## Installation

1. Clone this repository:
```bash
git clone https://github.com/penandlim/xdcc-mcp.git
cd xdcc-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your settings
```

4. Build and start the server:
```bash
npm run build
npm start
```

## Configuration

### MCP Client Settings

Add to your MCP client configuration:
TODO: update the mcp server config
```json
{
  "mcpServers": {
    "xdcc": {
      "command": "node",
      "args": ["path/to/xdcc-mcp/dist/index.js"],
      "env": {
        "PORT": "3000"
      }
    }
  }
}
```


## Development

### Project Structure
```
src/
├── mcp-server/
│   ├── tools/
│   │   ├── initiate_download/
│   │   └── get_download_status/
│   └── resources/
│       └── downloads/
```

## Error Handling

The server implements comprehensive error handling:
- Connection failures
- Download timeouts
- File system errors
- Invalid parameters
- Bot errors

Errors are logged and tracked with the relevant download job for status reporting.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
