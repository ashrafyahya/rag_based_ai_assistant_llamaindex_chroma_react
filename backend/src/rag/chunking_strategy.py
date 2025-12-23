"""
Chunking Strategy Module
Provides configurable document chunking strategies for RAG systems
"""
import hashlib
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, List, Optional

import tiktoken
from llama_index.core import Document


@dataclass
class ChunkingConfig:
    """Configuration for chunking strategies"""
    chunk_size: int = 512
    chunk_overlap: int = 50
    strategy: str = "sentence"
    separator: str = " "
    min_chunk_size: int = 100
    max_chunk_size: int = 2048


class ChunkingStrategy(ABC):
    """Base class for document chunking strategies"""
    
    def __init__(self, config: ChunkingConfig):
        """
        Initialize the chunking strategy with configuration.
        
        Args:
            config: ChunkingConfig instance with chunking parameters
        """
        self.config = config
        self.encoding = tiktoken.get_encoding("cl100k_base")  # GPT-4 tokenizer
    
    @abstractmethod
    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into chunks according to the strategy.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
        pass
    
    def chunk_document(self, document: Document) -> List[Document]:
        """
        Chunk a document into multiple Document objects with metadata.
        
        Args:
            document: Original Document object
            
        Returns:
            List of Document objects (chunks)
        """
        if not document.text or len(document.text.strip()) == 0:
            return []
        
        # Get chunks from text
        text_chunks = self.chunk_text(document.text)
        
        # Filter out chunks that are too small
        text_chunks = [
            chunk for chunk in text_chunks 
            if len(chunk.strip()) >= self.config.min_chunk_size
        ]
        
        if not text_chunks:
            # If all chunks were filtered out, return at least one chunk
            if len(document.text.strip()) > 0:
                text_chunks = [document.text]
        
        # Create Document objects with enhanced metadata
        chunked_documents = []
        total_chunks = len(text_chunks)
        
        for idx, chunk_text in enumerate(text_chunks):
            # Preserve original metadata
            chunk_metadata = document.metadata.copy()
            
            # Add chunk-specific metadata
            chunk_metadata.update({
                "chunk_index": idx,
                "total_chunks": total_chunks,
                "chunk_size": len(chunk_text),
                "chunk_strategy": self.config.strategy,
                "chunk_overlap": self.config.chunk_overlap
            })
            
            # Create new Document with chunked text
            chunk_doc = Document(
                text=chunk_text,
                metadata=chunk_metadata,
                doc_id=document.doc_id  # Will be overridden in rag_system
            )
            chunked_documents.append(chunk_doc)
        
        return chunked_documents
    
    def _apply_overlap(self, chunks: List[str]) -> List[str]:
        """
        Apply overlap between chunks to preserve context.
        
        Args:
            chunks: List of text chunks
            
        Returns:
            List of chunks with overlap applied
        """
        if len(chunks) <= 1 or self.config.chunk_overlap <= 0:
            return chunks
        
        overlapped_chunks = []
        
        for i, chunk in enumerate(chunks):
            if i == 0:
                # First chunk: add overlap from next chunk if available
                if len(chunks) > 1:
                    next_chunk_start = chunks[1][:self.config.chunk_overlap]
                    overlapped_chunks.append(chunk + " " + next_chunk_start)
                else:
                    overlapped_chunks.append(chunk)
            elif i == len(chunks) - 1:
                # Last chunk: add overlap from previous chunk
                prev_chunk_end = chunks[i-1][-self.config.chunk_overlap:]
                overlapped_chunks.append(prev_chunk_end + " " + chunk)
            else:
                # Middle chunks: add overlap from both sides
                prev_chunk_end = chunks[i-1][-self.config.chunk_overlap:]
                next_chunk_start = chunks[i+1][:self.config.chunk_overlap]
                overlapped_chunks.append(
                    prev_chunk_end + " " + chunk + " " + next_chunk_start
                )
        
        return overlapped_chunks


class SentenceChunkingStrategy(ChunkingStrategy):
    """Chunk documents by sentences with overlap"""
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into chunks based on sentences.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of sentence-based chunks
        """
        # Simple sentence splitting using regex
        # Matches sentence endings: . ! ? followed by space or end of string
        sentence_pattern = r'(?<=[.!?])\s+'
        sentences = re.split(sentence_pattern, text)
        
        # Filter out empty sentences
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if not sentences:
            return [text]
        
        # Group sentences into chunks
        chunks = []
        current_chunk = []
        current_size = 0
        
        for sentence in sentences:
            sentence_size = len(sentence)
            
            # If adding this sentence would exceed chunk size, start new chunk
            if current_size + sentence_size > self.config.chunk_size and current_chunk:
                chunks.append(" ".join(current_chunk))
                current_chunk = [sentence]
                current_size = sentence_size
            else:
                current_chunk.append(sentence)
                current_size += sentence_size + 1  # +1 for space
        
        # Add remaining chunk
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        # Apply overlap
        return self._apply_overlap(chunks)


class TokenChunkingStrategy(ChunkingStrategy):
    """Chunk documents by token count, respecting word boundaries"""
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into chunks based on token count.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of token-based chunks
        """
        # Tokenize the entire text
        tokens = self.encoding.encode(text)
        
        if len(tokens) <= self.config.chunk_size:
            return [text]
        
        # Split into chunks by token count
        chunks = []
        for i in range(0, len(tokens), self.config.chunk_size - self.config.chunk_overlap):
            chunk_tokens = tokens[i:i + self.config.chunk_size]
            chunk_text = self.encoding.decode(chunk_tokens)
            chunks.append(chunk_text)
        
        return chunks


class FixedChunkingStrategy(ChunkingStrategy):
    """Chunk documents into fixed-size chunks with overlap"""
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into fixed-size chunks.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of fixed-size chunks
        """
        if len(text) <= self.config.chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.config.chunk_size
            chunk = text[start:end]
            
            # Try to break at word boundary if not at end
            if end < len(text):
                # Look for last separator in the chunk
                last_separator = chunk.rfind(self.config.separator)
                if last_separator > start + self.config.min_chunk_size:
                    chunk = chunk[:last_separator]
                    end = start + last_separator
            
            chunks.append(chunk)
            start = end - self.config.chunk_overlap
        
        return chunks


class SemanticChunkingStrategy(ChunkingStrategy):
    """
    Semantic chunking strategy using sentence similarity.
    This is a simplified version - for production, consider using
    more sophisticated semantic analysis.
    """
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into semantically coherent chunks.
        Uses sentence-based approach with similarity heuristics.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of semantically coherent chunks
        """
        # For now, use sentence-based chunking as a foundation
        # In a more advanced implementation, you could:
        # 1. Compute embeddings for sentences
        # 2. Group similar sentences together
        # 3. Create chunks based on semantic similarity
        
        # Fallback to sentence chunking with larger chunk size
        sentence_strategy = SentenceChunkingStrategy(
            ChunkingConfig(
                chunk_size=self.config.chunk_size * 2,  # Larger chunks for semantic grouping
                chunk_overlap=self.config.chunk_overlap,
                strategy="sentence"
            )
        )
        
        return sentence_strategy.chunk_text(text)


def create_chunking_strategy(config: Optional[ChunkingConfig] = None) -> ChunkingStrategy:
    """
    Factory function to create a chunking strategy instance.
    
    Args:
        config: ChunkingConfig instance. If None, uses default config.
        
    Returns:
        ChunkingStrategy instance
        
    Raises:
        ValueError: If strategy type is unknown
    """
    if config is None:
        from src.config import (
            CHUNK_OVERLAP, CHUNK_SEPARATOR, CHUNK_SIZE, CHUNK_STRATEGY,
            MAX_CHUNK_SIZE, MIN_CHUNK_SIZE
        )
        config = ChunkingConfig(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            strategy=CHUNK_STRATEGY,
            separator=CHUNK_SEPARATOR,
            min_chunk_size=MIN_CHUNK_SIZE,
            max_chunk_size=MAX_CHUNK_SIZE
        )
    
    strategy_map = {
        "sentence": SentenceChunkingStrategy,
        "token": TokenChunkingStrategy,
        "semantic": SemanticChunkingStrategy,
        "fixed": FixedChunkingStrategy
    }
    
    strategy_class = strategy_map.get(config.strategy.lower())
    if not strategy_class:
        raise ValueError(
            f"Unknown chunking strategy: {config.strategy}. "
            f"Available strategies: {list(strategy_map.keys())}"
        )
    
    return strategy_class(config)

