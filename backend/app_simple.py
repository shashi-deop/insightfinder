import os
import io
from typing import List, Dict, Any
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from sentence_transformers import SentenceTransformer
import numpy as np
import PyPDF2
from docx import Document
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="InsightFinder API", description="Semantic file search API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the sentence transformer model
model = SentenceTransformer('all-MiniLM-L6-v2')

# In-memory storage for uploaded files
uploaded_files_storage = {}

class FileProcessor:
    @staticmethod
    def extract_text_from_txt(file_content: bytes) -> str:
        """Extract text from .txt files with encoding detection"""
        try:
            # Try UTF-8 first
            return file_content.decode('utf-8')
        except UnicodeDecodeError:
            try:
                # Try with error handling
                return file_content.decode('utf-8', errors='ignore')
            except:
                # Fallback to latin-1
                return file_content.decode('latin-1', errors='ignore')

    @staticmethod
    def extract_text_from_pdf(file_content: bytes) -> str:
        """Extract text from PDF files"""
        try:
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            return ""

    @staticmethod
    def extract_text_from_md(file_content: bytes) -> str:
        """Extract text from markdown files"""
        try:
            return file_content.decode('utf-8')
        except UnicodeDecodeError:
            return file_content.decode('utf-8', errors='ignore')

    @staticmethod
    def extract_text_from_docx(file_content: bytes) -> str:
        """Extract text from .docx files"""
        try:
            doc = Document(io.BytesIO(file_content))
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting text from DOCX: {e}")
            return ""

    @staticmethod
    def process_file(file: UploadFile) -> Dict[str, Any]:
        """Process a file and extract its text content"""
        try:
            file_content = file.file.read()
            file_extension = file.filename.lower().split('.')[-1]
            
            # Extract text based on file type
            if file_extension == 'txt':
                content = FileProcessor.extract_text_from_txt(file_content)
            elif file_extension == 'pdf':
                content = FileProcessor.extract_text_from_pdf(file_content)
            elif file_extension == 'md':
                content = FileProcessor.extract_text_from_md(file_content)
            elif file_extension == 'docx':
                content = FileProcessor.extract_text_from_docx(file_content)
            else:
                logger.warning(f"Unsupported file type: {file_extension}")
                return None
            
            if not content.strip():
                logger.warning(f"Empty content extracted from {file.filename}")
                return None
            
            return {
                'filename': file.filename,
                'content': content,
                'file_path': file.filename,
                'full_path': file.filename  # Store the full path
            }
            
        except Exception as e:
            logger.error(f"Error processing file {file.filename}: {e}")
            return None

class SemanticSearch:
    def __init__(self, model):
        self.model = model
        self.file_contents = []
        self.embeddings = None
    
    def add_files(self, file_contents: List[dict]):
        """Add files to the search index"""
        self.file_contents = file_contents
        if file_contents:
            # Create embeddings for all file contents
            texts = [file['content'] for file in file_contents]
            self.embeddings = self.model.encode(texts, convert_to_tensor=True)
            logger.info(f"Added {len(file_contents)} files to search index")
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar files using cosine similarity"""
        if not self.file_contents or self.embeddings is None:
            return []
        
        # Encode the query
        query_embedding = self.model.encode([query], convert_to_tensor=True)
        
        # Calculate cosine similarities
        similarities = self.cosine_similarity(query_embedding, self.embeddings)
        
        # Create results with similarity scores and apply minimum threshold
        results = []
        MIN_SIMILARITY_THRESHOLD = 0.1  # Only show results with at least 10% similarity
        
        for i, (similarity, content) in enumerate(zip(similarities, self.file_contents)):
            # Only include results above the threshold
            if similarity >= MIN_SIMILARITY_THRESHOLD:
                # Create a snippet from the content (first 300 characters)
                snippet = content['content'][:300].replace('\n', ' ').strip()
                if len(content['content']) > 300:
                    snippet += "..."
                
                results.append({
                    'filename': content['filename'],
                    'content_snippet': snippet,
                    'similarity_score': float(similarity),
                    'file_path': content['file_path']
                })
        
        # Sort by similarity score (highest first)
        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        
        return results[:top_k]
    
    @staticmethod
    def cosine_similarity(a, b):
        """Calculate cosine similarity between two tensors"""
        # Normalize the vectors
        a_norm = a / np.linalg.norm(a, axis=1, keepdims=True)
        b_norm = b / np.linalg.norm(b, axis=1, keepdims=True)
        
        # Calculate cosine similarity
        similarity = np.dot(a_norm, b_norm.T)
        return similarity.flatten()

# Initialize search engine
search_engine = SemanticSearch(model)

@app.get("/")
async def root():
    return {"message": "InsightFinder API is running"}

@app.post("/search")
async def search_files(
    query: str = Form(...),
    files: List[UploadFile] = File(...)
):
    """Search through uploaded files using semantic similarity"""
    try:
        logger.info(f"Received search request with query: '{query}' and {len(files)} files")
        
        # Process all uploaded files
        processed_files = []
        for file in files:
            # Check if file type is supported
            file_extension = file.filename.lower().split('.')[-1]
            if file_extension not in ['txt', 'pdf', 'md', 'docx']:
                logger.warning(f"Skipping unsupported file type: {file.filename}")
                continue
            
            processed_file = FileProcessor.process_file(file)
            if processed_file:
                processed_files.append(processed_file)
                
                # Create multiple storage keys for flexibility
                original_filename = processed_file['filename']
                normalized_filename = original_filename.replace(' ', '_')
                
                # Store with multiple keys to handle different filename formats
                uploaded_files_storage[original_filename] = processed_file
                uploaded_files_storage[normalized_filename] = processed_file
                uploaded_files_storage[processed_file['full_path']] = processed_file
                
                # Also store with URL-encoded version
                import urllib.parse
                url_encoded = urllib.parse.quote(original_filename)
                uploaded_files_storage[url_encoded] = processed_file
                
                # Store with just the filename (without path)
                import os
                just_filename = os.path.basename(original_filename)
                uploaded_files_storage[just_filename] = processed_file
                
                logger.info(f"Stored file with keys: '{original_filename}', '{normalized_filename}', '{processed_file['full_path']}', '{url_encoded}', '{just_filename}'")
        
        logger.info(f"Total files stored: {len(uploaded_files_storage)}")
        logger.info(f"Available files: {list(uploaded_files_storage.keys())}")
        
        if not processed_files:
            raise HTTPException(status_code=400, detail="No valid files were processed")
        
        # Add files to search engine
        search_engine.add_files(processed_files)
        
        # Perform search
        results = search_engine.search(query)
        
        # Update results to include the full path for file retrieval
        for result in results:
            # Find the original file data to get the full_path
            for processed_file in processed_files:
                if processed_file['filename'] == result['filename']:
                    result['full_path'] = processed_file['full_path']
                    break
        
        logger.info(f"Search completed. Found {len(results)} results")
        return results
        
    except Exception as e:
        logger.error(f"Error during search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/file/{filename}")
async def get_file_content(filename: str):
    """Retrieve the full content of a specific file"""
    try:
        # URL decode the filename
        import urllib.parse
        decoded_filename = urllib.parse.unquote(filename)
        
        logger.info(f"Requesting file: {decoded_filename}")
        logger.info(f"Available files in storage: {list(uploaded_files_storage.keys())}")
        
        # Try to find the file with different possible keys
        file_data = None
        
        # First try the exact decoded filename
        if decoded_filename in uploaded_files_storage:
            file_data = uploaded_files_storage[decoded_filename]
            logger.info(f"Found file with exact key: {decoded_filename}")
        
        # If not found, try the original encoded filename
        if file_data is None and filename in uploaded_files_storage:
            file_data = uploaded_files_storage[filename]
            logger.info(f"Found file with encoded key: {filename}")
        
        # If not found, try with normalized filename (spaces to underscores)
        if file_data is None:
            normalized_filename = decoded_filename.replace(' ', '_')
            if normalized_filename in uploaded_files_storage:
                file_data = uploaded_files_storage[normalized_filename]
                logger.info(f"Found file with normalized key: {normalized_filename}")
        
        # If not found, try with denormalized filename (underscores to spaces)
        if file_data is None:
            denormalized_filename = decoded_filename.replace('_', ' ')
            if denormalized_filename in uploaded_files_storage:
                file_data = uploaded_files_storage[denormalized_filename]
                logger.info(f"Found file with denormalized key: {denormalized_filename}")
        
        # If not found, try to find by filename (without path)
        if file_data is None:
            import os
            just_filename = os.path.basename(decoded_filename)
            if just_filename in uploaded_files_storage:
                file_data = uploaded_files_storage[just_filename]
                logger.info(f"Found file with filename key: {just_filename}")
        
        # If still not found, try to find by matching the end of the path
        if file_data is None:
            for key in uploaded_files_storage.keys():
                if key.endswith(decoded_filename) or decoded_filename.endswith(key):
                    file_data = uploaded_files_storage[key]
                    logger.info(f"Found file with partial match: {key}")
                    break
        
        if file_data is None:
            logger.warning(f"File not found in storage: {decoded_filename}")
            logger.info(f"Available files: {list(uploaded_files_storage.keys())}")
            raise HTTPException(status_code=404, detail=f"File '{decoded_filename}' not found. Please upload the files again.")
        
        logger.info(f"Successfully retrieved file: {decoded_filename}")
        return {
            "filename": file_data['filename'],
            "content": file_data['content']
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving file {filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving file: {str(e)}")

@app.get("/status")
async def get_status():
    """Get the current status of the search engine"""
    return {
        "files_loaded": len(search_engine.file_contents),
        "model_loaded": search_engine.model is not None,
        "storage_files": len(uploaded_files_storage)
    }

@app.get("/debug/files")
async def debug_files():
    """Debug endpoint to check what files are stored"""
    return {
        "total_files": len(uploaded_files_storage),
        "files": list(uploaded_files_storage.keys()),
        "file_details": [
            {
                "key": key,
                "filename": data['filename'],
                "content_length": len(data['content'])
            }
            for key, data in uploaded_files_storage.items()
        ]
    }

@app.get("/test")
async def test_endpoint():
    """Test endpoint to debug file storage"""
    return {
        "message": "Backend is running",
        "stored_files": list(uploaded_files_storage.keys()),
        "total_files": len(uploaded_files_storage),
        "search_engine_files": len(search_engine.file_contents) if search_engine.file_contents else 0
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 