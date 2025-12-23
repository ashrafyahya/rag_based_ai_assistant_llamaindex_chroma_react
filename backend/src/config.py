"""
Configuration Module
Central configuration settings for the RAG system
"""

# LLM Model Configuration
MODEL_NAME = "llama-3.1-8b-instant"  # Default model for Groq API
TOKEN_LIMIT = 8000  # Maximum tokens per request
MAX_TOKENS = 2048   # Maximum tokens in response

# Memory Management Thresholds
SUMMARIZE_THRESHOLD = 0.7  # Trigger summarization at 70% of token limit
QUESTION_THRESHOLD = 0.2   # Maximum question size as fraction of token limit

# Document Chunking Configuration
CHUNK_SIZE = 512  # Default chunk size in characters (for character-based strategies) or tokens (for token-based strategies)
CHUNK_OVERLAP = 50  # Overlap between chunks in characters/tokens
CHUNK_STRATEGY = "sentence"  # Strategy type: "sentence", "token", "semantic", "fixed"
CHUNK_SEPARATOR = " "  # Separator for splitting (used in fixed strategy)
MIN_CHUNK_SIZE = 100  # Minimum chunk size to avoid tiny fragments
MAX_CHUNK_SIZE = 2048  # Maximum chunk size as safety limit

