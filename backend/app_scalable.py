from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import PyPDF2
import io
import logging
import os
import json
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SmartFinder Scalable API", description="Semantic file search with auto-scaling")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the sentence transformer model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Configuration
IN_MEMORY_THRESHOLD = 100  # Switch to vector DB after 100 files
VECTOR_DB_ENABLED = os.getenv('VECTOR_DB_ENABLED', 'false').lower() == 'true'

class FileProcessor:
    """Handles file content extraction for different file types"""
    
    @staticmethod
    def extract_text_from_txt(file_content: bytes) -> str:
        """Extract text from .txt files"""
        try:
            return file_content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return file_content.decode('latin-1')
            except:
                return "Error: Could not decode text file"
    
    @staticmethod
    def extract_text_from_pdf(file_content: bytes) -> str:
        """Extract text from .pdf files"""
        try:
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting PDF text: {e}")
            return "Error: Could not extract text from PDF"
    
    @staticmethod
    def extract_text_from_md(file_content: bytes) -> str:
        """Extract text from .md files"""
        try:
            return file_content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return file_content.decode('latin-1')
            except:
                return "Error: Could not decode markdown file"

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Calculate cosine similarity between two vectors"""
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    
    if norm_a == 0 or norm_b == 0:
        return 0.0
    
    return dot_product / (norm_a * norm_b)

class InMemorySearch:
    """In-memory search for small datasets (< 100 files)"""
    
    def __init__(self, model):
        self.model = model
        self.file_embeddings = {}  # filename -> embedding
        self.file_contents = {}    # filename -> content
    
    def add_files(self, file_contents: List[dict]):
        """Add files to in-memory storage"""
        for content in file_contents:
            filename = content['filename']
            text = content['content']
            
            # Generate embedding
            embedding = self.model.encode([text])[0]
            
            # Store in memory
            self.file_embeddings[filename] = embedding
            self.file_contents[filename] = text
            
        logger.info(f"Added {len(file_contents)} files to in-memory storage")
    
    def search(self, query: str, top_k: int = 10) -> List[dict]:
        """Search in-memory files"""
        if not self.file_embeddings:
            return []
        
        # Generate query embedding
        query_embedding = self.model.encode([query])[0]
        
        # Calculate similarities
        results = []
        for filename, file_embedding in self.file_embeddings.items():
            similarity = cosine_similarity(query_embedding, file_embedding)
            
            if similarity >= 0.1:  # Minimum threshold
                snippet = self.file_contents[filename][:300].replace('\n', ' ').strip()
                if len(self.file_contents[filename]) > 300:
                    snippet += "..."
                
                results.append({
                    'filename': filename,
                    'content_snippet': snippet,
                    'similarity_score': float(similarity),
                    'file_path': filename
                })
        
        # Sort by similarity and return top_k
        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        return results[:top_k]
    
    def get_file_content(self, filename: str) -> Optional[str]:
        """Get full file content"""
        return self.file_contents.get(filename)

class VectorDatabaseSearch:
    """Vector database search for large datasets (>= 100 files)"""
    
    def __init__(self, model):
        self.model = model
        self.vector_db = {}  # Simple in-memory vector DB (replace with Pinecone/Weaviate)
        self.file_contents = {}
        logger.info("Initialized vector database search")
    
    def add_files(self, file_contents: List[dict]):
        """Add files to vector database"""
        for content in file_contents:
            filename = content['filename']
            text = content['content']
            
            # Generate embedding
            embedding = self.model.encode([text])[0]
            
            # Store in vector DB
            self.vector_db[filename] = {
                'embedding': embedding,
                'metadata': {
                    'filename': filename,
                    'content_length': len(text),
                    'uploaded_at': datetime.now().isoformat()
                }
            }
            self.file_contents[filename] = text
            
        logger.info(f"Added {len(file_contents)} files to vector database")
    
    def search(self, query: str, top_k: int = 10) -> List[dict]:
        """Search vector database"""
        if not self.vector_db:
            return []
        
        # Generate query embedding
        query_embedding = self.model.encode([query])[0]
        
        # Calculate similarities with vector DB
        results = []
        for filename, data in self.vector_db.items():
            similarity = cosine_similarity(query_embedding, data['embedding'])
            
            if similarity >= 0.1:  # Minimum threshold
                snippet = self.file_contents[filename][:300].replace('\n', ' ').strip()
                if len(self.file_contents[filename]) > 300:
                    snippet += "..."
                
                results.append({
                    'filename': filename,
                    'content_snippet': snippet,
                    'similarity_score': float(similarity),
                    'file_path': filename
                })
        
        # Sort by similarity and return top_k
        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        return results[:top_k]
    
    def get_file_content(self, filename: str) -> Optional[str]:
        """Get full file content"""
        return self.file_contents.get(filename)

class ScalableSearchEngine:
    """Automatically switches between in-memory and vector DB based on file count"""
    
    def __init__(self, model):
        self.model = model
        self.in_memory_search = InMemorySearch(model)
        self.vector_db_search = VectorDatabaseSearch(model)
        self.current_mode = "in_memory"
        self.file_count = 0
        
    def add_files(self, file_contents: List[dict]):
        """Add files and automatically choose storage method"""
        self.file_count += len(file_contents)
        
        # Decide which storage to use
        if self.file_count <= IN_MEMORY_THRESHOLD and not VECTOR_DB_ENABLED:
            # Use in-memory for small datasets
            if self.current_mode != "in_memory":
                logger.info(f"Switching to in-memory mode ({self.file_count} files)")
                self.current_mode = "in_memory"
            
            self.in_memory_search.add_files(file_contents)
        else:
            # Use vector database for large datasets
            if self.current_mode != "vector_db":
                logger.info(f"Switching to vector database mode ({self.file_count} files)")
                self.current_mode = "vector_db"
            
            self.vector_db_search.add_files(file_contents)
    
    def search(self, query: str, top_k: int = 10) -> List[dict]:
        """Search using current storage method"""
        if self.current_mode == "in_memory":
            return self.in_memory_search.search(query, top_k)
        else:
            return self.vector_db_search.search(query, top_k)
    
    def get_file_content(self, filename: str) -> Optional[str]:
        """Get file content from current storage"""
        if self.current_mode == "in_memory":
            return self.in_memory_search.get_file_content(filename)
        else:
            return self.vector_db_search.get_file_content(filename)
    
    def get_status(self) -> dict:
        """Get current search engine status"""
        return {
            "mode": self.current_mode,
            "file_count": self.file_count,
            "threshold": IN_MEMORY_THRESHOLD,
            "vector_db_enabled": VECTOR_DB_ENABLED
        }

# Initialize scalable search engine
search_engine = ScalableSearchEngine(model)

@app.get("/")
async def root():
    """Health check endpoint"""
    status = search_engine.get_status()
    return {
        "message": "SmartFinder Scalable API is running",
        "status": status
    }

@app.get("/status")
async def get_status():
    """Get search engine status"""
    return search_engine.get_status()

@app.post("/search")
async def search_files(
    query: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Search uploaded files using scalable semantic search"""
    try:
        logger.info(f"Received search request with query: '{query}' and {len(files)} files")
        
        # Process uploaded files
        file_contents = []
        processor = FileProcessor()
        
        for file in files:
            logger.info(f"Processing file: {file.filename}")
            
            # Read file content
            content = await file.read()
            
            # Extract text based on file extension
            filename = file.filename.lower()
            if filename.endswith('.txt'):
                text = processor.extract_text_from_txt(content)
            elif filename.endswith('.pdf'):
                text = processor.extract_text_from_pdf(content)
            elif filename.endswith('.md'):
                text = processor.extract_text_from_md(content)
            else:
                logger.warning(f"Unsupported file type: {filename}")
                continue
            
            # Skip files with no content or errors
            if not text or text.startswith("Error:"):
                logger.warning(f"Could not extract text from {filename}")
                continue
            
            file_contents.append({
                'filename': file.filename,
                'content': text,
                'file_path': file.filename
            })
        
        logger.info(f"Successfully processed {len(file_contents)} files")
        
        if not file_contents:
            return JSONResponse(
                status_code=400,
                content={"error": "No valid files to search"}
            )
        
        # Add files to search engine (auto-scales)
        search_engine.add_files(file_contents)
        
        # Perform search
        results = search_engine.search(query, file_contents)
        
        logger.info(f"Search completed, returning {len(results)} results")
        return results
        
    except Exception as e:
        logger.error(f"Search error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Search failed: {str(e)}"}
        )

@app.get("/file/{filename}")
async def get_file_content(filename: str):
    """Get the full content of a specific file"""
    try:
        content = search_engine.get_file_content(filename)
        if content:
            return {
                "filename": filename,
                "content": content
            }
        else:
            return JSONResponse(
                status_code=404,
                content={"error": f"File {filename} not found"}
            )
    except Exception as e:
        logger.error(f"File retrieval error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"File retrieval failed: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 