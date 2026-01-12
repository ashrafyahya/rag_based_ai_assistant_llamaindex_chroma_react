#!/bin/bash
set -e

# Create necessary directories if they don't exist
mkdir -p /app/data /app/chroma_db

echo "Starting RAG System Backend..."
echo "API will be available at http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"

# Execute the main command
exec "$@"