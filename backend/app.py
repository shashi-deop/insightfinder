from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List
import os
import tempfile
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import PyPDF2
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SmartFinder API", description="Semantic file search API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the sentence transformer model
# Using a lightweight model for better performance
model = SentenceTransformer('all-MiniLM-L6-v2')

class FileProcessor:
    """Handles file content extraction for different file types"""
    
    @staticmethod
    def extract_text_from_txt(file_content: bytes) -> str:
        """Extract text from .txt files"""
        try:
            return file_content.decode('utf-8')
        except UnicodeDecodeError:
            # Try with different encoding if utf-8 fails
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
            # For markdown, we can treat it as plain text
            # In a more advanced version, you might want to strip markdown syntax
            return file_content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                return file_content.decode('latin-1')
            except:
                return "Error: Could not decode markdown file"

class SemanticSearch:
    """Handles semantic search functionality"""
    
    def __init__(self, model):
        self.model = model
    
    def create_embeddings(self, texts: List[str]) -> np.ndarray:
        """Create embeddings for a list of texts"""
        embeddings = self.model.encode(texts)
        return embeddings
    
    def search(self, query: str, file_contents: List[dict], top_k: int = 10) -> List[dict]:
        """
        Perform semantic search on file contents
        
        Args:
            query: Search query
            file_contents: List of dicts with 'filename', 'content', 'file_path'
            top_k: Number of top results to return
            
        Returns:
            List of search results with similarity scores
        """
        if not file_contents:
            return []
        
        # Create embeddings for query and all file contents
        texts = [content['content'] for content in file_contents]
        all_texts = [query] + texts
        
        embeddings = self.create_embeddings(all_texts)
        query_embedding = embeddings[0:1]  # First embedding is the query
        content_embeddings = embeddings[1:]  # Rest are file contents
        
        # Calculate cosine similarities
        similarities = cosine_similarity(query_embedding, content_embeddings)[0]
        
        # Create results with similarity scores
        results = []
        for i, (similarity, content) in enumerate(zip(similarities, file_contents)):
            # Create a snippet from the content (first 200 characters)
            snippet = content['content'][:300].replace('\n', ' ').strip()
            if len(content['content']) > 300:
                snippet += "..."
            
            results.append({
                'filename': content['filename'],
                'content_snippet': snippet,
                'similarity_score': float(similarity),
                'file_path': content['file_path']
            })
        
        # Sort by similarity score (descending) and return top_k
        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        return results[:top_k]

# Initialize semantic search
semantic_search = SemanticSearch(model)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "SmartFinder API is running"}

@app.post("/search")
async def search_files(
    query: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """
    Search uploaded files using semantic similarity
    
    Args:
        query: Natural language search query
        files: List of uploaded files (.txt, .pdf, .md)
        
    Returns:
        List of matching files with similarity scores
    """
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
                'file_path': file.filename  # In a real app, this would be the actual path
            })
        
        logger.info(f"Successfully processed {len(file_contents)} files")
        
        if not file_contents:
            return JSONResponse(
                status_code=400,
                content={"error": "No valid files to search"}
            )
        
        # Perform semantic search
        results = semantic_search.search(query, file_contents)
        
        logger.info(f"Search completed, returning {len(results)} results")
        return results
        
    except Exception as e:
        logger.error(f"Search error: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Search failed: {str(e)}"}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 