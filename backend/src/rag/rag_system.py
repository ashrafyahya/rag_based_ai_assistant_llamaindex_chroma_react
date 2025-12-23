"""
RAG System Module
Orchestrates RAG operations: document loading, querying, and management
"""
import hashlib
import os
import tempfile
from pathlib import Path
from typing import Dict, List

from llama_index.core import Settings, SimpleDirectoryReader
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

try:
    from llama_index.readers.file import PyMuPDFReader
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    print("Warning: PyMuPDFReader not available. Using default PDF reader.")

from chroma_search import ChromaEmbeddingSearch
from chroma_setup import setup_chroma
from src.rag.chunking_strategy import create_chunking_strategy


class RAGSystem:
    """Main RAG system orchestrator"""
    
    def __init__(self):
        """
        Initialize the RAG system with embedding model and database connection.
        Sets up HuggingFace embeddings and ChromaDB for document storage/retrieval.
        """
        # Configure embedding model for document vectorization
        Settings.embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
        
        # Initialize ChromaDB client and collection
        self.chroma_client, self.collection = setup_chroma()
        print(f"ChromaDB initialized with collection: {self.collection.name}\n")
        
        self.search = ChromaEmbeddingSearch()
        
        # Initialize chunking strategy
        self.chunking_strategy = create_chunking_strategy()
        print(f"Chunking strategy initialized: {self.chunking_strategy.config.strategy} "
              f"(chunk_size={self.chunking_strategy.config.chunk_size}, "
              f"overlap={self.chunking_strategy.config.chunk_overlap})\n")
    
    def load_documents(self):
        """
        Load documents from the data directory into the database.
        Checks for existing documents to avoid duplicates.
        Uses PyMuPDFReader for PDFs to preserve layout and tables.
        
        Note:
            Documents are loaded from a 'data' directory relative to the project structure.
            Only processes new documents if the collection is empty.
        """
        data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
        
        # Configure file extractor for better PDF handling
        file_extractor = {}
        if PYMUPDF_AVAILABLE:
            file_extractor['.pdf'] = PyMuPDFReader()
            print("Using PyMuPDFReader for enhanced PDF processing")
        
        documents = SimpleDirectoryReader(
            data_path,
            file_extractor=file_extractor if file_extractor else None
        ).load_data()

        # Prevent duplicate document insertion
        existing_docs = self.search.collection.get(include=["documents"])["documents"]
        if not existing_docs:
            # Apply chunking strategy to documents
            chunked_documents = self._apply_chunking(documents)
            
            # Batch add documents to ChromaDB
            if chunked_documents:
                ids = []
                texts = []
                metadatas = []
                
                for doc in chunked_documents:
                    # Generate deterministic doc_id using SHA256
                    doc_id = self._generate_doc_id(
                        doc.metadata.get("source", ""),
                        doc.text,
                        doc.metadata.get("chunk_index", 0)
                    )
                    
                    ids.append(doc_id)
                    texts.append(doc.text)
                    metadatas.append(doc.metadata)
                
                # Batch add to ChromaDB
                self.search.collection.add(
                    ids=ids,
                    documents=texts,
                    metadatas=metadatas
                )
                print(f"Documents added to ChromaDB ({len(chunked_documents)} chunks from {len(documents)} documents)\n")
            else:
                print("No documents to add after chunking\n")
        else:
            print("Documents already exist in ChromaDB. Skipping insertion.\n")
    
    def search_documents(self, query: str, n_results: int = 3) -> Dict:
        """
        Search for documents similar to the given query.
        
        Args:
            query (str): The search query text
            n_results (int): Maximum number of results to return
            
        Returns:
            Dict: Search results containing documents, distances, and metadata
        """
        results = self.search.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        return results
    
    def format_search_results(self, results: Dict, query: str, n_results: int = 3) -> str:
        """
        Format search results into human-readable text for LLM processing.
        
        Args:
            results (Dict): Raw search results from ChromaDB
            query (str): Original query (for context)
            n_results (int): Number of results to format
            
        Returns:
            str: Formatted text containing document sources and content
        """
        if not results or 'documents' not in results or not results['documents'][0]:
            return "No relevant information found in the documents."
        
        documents = results['documents'][0]
        metadatas = results['metadatas'][0]
        
        formatted_answer = "Relevant findings:\n\n"
        
        for i, (doc, meta) in enumerate(zip(documents, metadatas)):
            formatted_answer += f"Source {i+1}: {meta['source']}\n"
            formatted_answer += f"Content:\n{doc}\n\n"
        
        return formatted_answer
    
    def upload_document(self, uploaded_file) -> str:
        """
        Upload and index a document file for searching.
        Uses PyMuPDFReader for PDFs to preserve layout and table structure.
        
        Args:
            uploaded_file: File object (supports both Streamlit and FastAPI file uploads)
            
        Returns:
            str: Success or error message
            
        Note:
            Prevents duplicate uploads by checking existing document names.
            Supports .txt, .pdf, .docx, .md, .html with enhanced PDF processing.
        """
        try:
            # Get filename - handle both Streamlit and FastAPI file objects
            filename = getattr(uploaded_file, 'filename', None) or getattr(uploaded_file, 'name', 'unknown')
            
            existing_docs = self.get_uploaded_documents()
            existing_names = [doc['name'] for doc in existing_docs]
            if filename in existing_names:
                return f"Document '{filename}' already exists. Upload cancelled."

            # Read file content - handle both Streamlit and FastAPI formats
            if hasattr(uploaded_file, 'getvalue'):
                # Streamlit UploadedFile
                file_content = uploaded_file.getvalue()
                file_size = len(file_content)
                file_type = getattr(uploaded_file, 'type', 'application/octet-stream')
            elif hasattr(uploaded_file, 'file'):
                # FastAPI UploadFile
                file_content = uploaded_file.file.read()
                uploaded_file.file.seek(0)  # Reset file pointer
                file_size = len(file_content)
                file_type = uploaded_file.content_type or 'application/octet-stream'
            else:
                return "Unsupported file format"
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as temp_file:
                temp_file.write(file_content)
                temp_file_path = temp_file.name

            print(f"[INDEXING] Starting to index file: {filename}")
            # Use enhanced PDF reader if available
            file_extractor = {}
            if PYMUPDF_AVAILABLE and filename.lower().endswith('.pdf'):
                file_extractor['.pdf'] = PyMuPDFReader()

            documents = SimpleDirectoryReader(
                input_files=[temp_file_path],
                file_extractor=file_extractor if file_extractor else None
            ).load_data()

            print(f"[INDEXING] Loaded {len(documents)} document(s) from file")

            # Apply chunking strategy
            chunked_documents = self._apply_chunking(documents)
            print(f"[INDEXING] Created {len(chunked_documents)} chunks using {self.chunking_strategy.config.strategy} strategy")

            # Prepare batch data for ChromaDB
            ids = []
            texts = []
            metadatas = []

            for doc in chunked_documents:
                # Generate deterministic doc_id using SHA256
                doc_id = self._generate_doc_id(
                    filename,
                    doc.text,
                    doc.metadata.get("chunk_index", 0)
                )
                
                # Enhance metadata with file information
                enhanced_metadata = doc.metadata.copy()
                enhanced_metadata.update({
                    "source": filename,
                    "file_type": file_type,
                    "file_size": file_size,
                    "upload_type": "user_upload"
                })
                
                ids.append(doc_id)
                texts.append(doc.text)
                metadatas.append(enhanced_metadata)

            # Batch add to ChromaDB
            if ids:
                self.search.collection.add(
                    ids=ids,
                    documents=texts,
                    metadatas=metadatas
                )

            os.unlink(temp_file_path)
            print(f"[INDEXING] ✓ Successfully indexed {filename} into vector store ({len(chunked_documents)} chunks)")
            return f"Successfully uploaded and indexed {filename} ({len(chunked_documents)} chunks)"

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"Error uploading document: {error_detail}")
            return f"Error uploading document: {str(e)}"
    
    def delete_document(self, doc_id: str) -> str:
        """
        Remove a document from the database by its unique identifier.
        
        Args:
            doc_id (str): Unique identifier of the document to delete
            
        Returns:
            str: Success or error message
        """
        try:
            print(f"[DELETE] Removing document with ID: {doc_id}")
            result = self.search.delete_document(doc_id)
            print(f"[DELETE] ✓ Document deleted from vector store")
            return result
        except Exception as e:
            return f"Error deleting document: {str(e)}"
    
    def get_uploaded_documents(self) -> List[Dict]:
        """Get list of uploaded documents grouped by filename"""
        try:
            all_docs = self.search.list_all_documents()
            uploaded_docs_dict = {}
            
            if all_docs and 'metadatas' in all_docs:
                for i, metadata in enumerate(all_docs['metadatas']):
                    if metadata and metadata.get('upload_type') == 'user_upload':
                        filename = metadata.get('source', 'Unknown')
                        file_type = metadata.get('file_type', 'Unknown')
                        file_size = metadata.get('file_size', 0)

                        if filename not in uploaded_docs_dict:
                            uploaded_docs_dict[filename] = {
                                'ids': [all_docs['ids'][i]],
                                'name': filename,
                                'type': file_type,
                                'size': file_size,
                                'chunks': 1
                            }
                        else:
                            uploaded_docs_dict[filename]['ids'].append(all_docs['ids'][i])
                            uploaded_docs_dict[filename]['chunks'] += 1
                            if file_size > uploaded_docs_dict[filename]['size']:
                                uploaded_docs_dict[filename]['size'] = file_size

            uploaded_docs = list(uploaded_docs_dict.values())
            uploaded_docs.sort(key=lambda x: x['name'])
            return uploaded_docs

        except Exception as e:
            print(f"Error retrieving documents: {str(e)}")
            return []
    
    def clear_all_documents(self) -> str:
        """Clear all documents from the database"""
        try:
            all_docs = self.search.list_all_documents()
            if all_docs and 'ids' in all_docs and all_docs['ids']:
                doc_count = len(all_docs['ids'])
                print(f"[CLEAR DATABASE] Deleting {doc_count} documents from vector store")
                for doc_id in all_docs['ids']:
                    self.search.delete_document(doc_id)
                print(f"[CLEAR DATABASE] ✓ All {doc_count} documents removed from vector store")
                return f"Successfully cleared {doc_count} documents from ChromaDB"
            else:
                print("[CLEAR DATABASE] No documents found to clear")
                return "No documents found to clear"
        except Exception as e:
            return f"Error clearing documents: {str(e)}"
    
    def _apply_chunking(self, documents: List) -> List:
        """
        Apply chunking strategy to a list of documents.
        
        Args:
            documents: List of Document objects from SimpleDirectoryReader
            
        Returns:
            List of chunked Document objects
        """
        chunked_documents = []
        
        for doc in documents:
            if not doc.text or len(doc.text.strip()) == 0:
                continue
            
            # Apply chunking strategy
            chunks = self.chunking_strategy.chunk_document(doc)
            chunked_documents.extend(chunks)
        
        return chunked_documents
    
    def _generate_doc_id(self, filename: str, text: str, chunk_index: int) -> str:
        """
        Generate a deterministic document ID using SHA256 hash.
        
        Args:
            filename: Original filename
            text: Document text content
            chunk_index: Index of the chunk
            
        Returns:
            Deterministic document ID string
        """
        # Create hash of text content
        text_hash = hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]
        
        # Generate doc_id with chunk index
        doc_id = f"{filename}_chunk_{chunk_index}_{text_hash}"
        
        return doc_id


# Global RAG system instance
_rag_system = None


def get_rag_system() -> RAGSystem:
    """Get or create the global RAG system instance"""
    global _rag_system
    if _rag_system is None:
        _rag_system = RAGSystem()
    return _rag_system
