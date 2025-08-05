'use client';

import { useState, useRef } from 'react';
import { API_ENDPOINTS } from './config';

interface SearchResult {
  filename: string;
  content_snippet: string;
  similarity_score: number;
  file_path: string;
  full_path?: string;
  confidence_level?: string;
  match_type?: string;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to highlight search content in file
  const highlightSearchContent = (fileContent: string, snippet: string, searchQuery: string): string => {
    try {
      // Escape HTML characters in the content
      const escapeHtml = (text: string) => {
        return text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      let highlightedContent = escapeHtml(fileContent);

      // Highlight the snippet if it exists and is actually in the content
      if (snippet && snippet.trim()) {
        const escapedSnippet = escapeHtml(snippet.trim());
        const regex = new RegExp(`(${escapedSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        if (highlightedContent.match(regex)) {
          highlightedContent = highlightedContent.replace(regex, '<span class="highlight">$1</span>');
        }
      }

      // Highlight individual words from the search query that actually exist in content
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      searchWords.forEach(word => {
        const escapedWord = escapeHtml(word);
        const wordRegex = new RegExp(`(${escapedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        if (highlightedContent.match(wordRegex)) {
          highlightedContent = highlightedContent.replace(wordRegex, '<span class="highlight">$1</span>');
        }
      });

      // If no highlights found, highlight the snippet area for context
      if (!highlightedContent.includes('class="highlight"') && snippet) {
        const escapedSnippet = escapeHtml(snippet.trim());
        const snippetWords = escapedSnippet.split(/\s+/).filter(word => word.length > 3);
        snippetWords.forEach(word => {
          const wordRegex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          if (highlightedContent.match(wordRegex)) {
            highlightedContent = highlightedContent.replace(wordRegex, '<span class="highlight">$1</span>');
          }
        });
      }

      return highlightedContent;
    } catch (error) {
      console.error('Error highlighting content:', error);
      // Fallback to just escaping HTML
      return fileContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(files);
    
    // Extract folder path from the first file
    if (files.length > 0) {
      const firstFile = files[0];
      const path = firstFile.webkitRelativePath || firstFile.name;
      const folderPath = path.split('/').slice(0, -1).join('/');
      setSelectedFolder(folderPath || 'Selected Files');
    }
  };

  const handleFolderSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('webkitdirectory', '');
      fileInputRef.current.setAttribute('directory', '');
      fileInputRef.current.click();
    }
  };

  const handleSearch = async () => {
    console.log('Search triggered with:', { query, fileCount: uploadedFiles.length });
    
    if (!query.trim()) {
      alert('Please enter a search query.');
      return;
    }
    
    if (uploadedFiles.length === 0) {
      alert('Please select some files first.');
      return;
    }
    setIsLoading(true);
    try {
      // First check if backend is running
      try {
        const statusResponse = await fetch(API_ENDPOINTS.STATUS);
        if (!statusResponse.ok) {
          throw new Error('Backend server is not responding properly');
        }
        const status = await statusResponse.json();
        console.log('Backend status:', status);
      } catch (statusError) {
        console.error('Backend status check failed:', statusError);
        alert('Backend server is not running. Please start the backend server at http://localhost:8000');
        setIsLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('query', query);
      uploadedFiles.forEach(file => {
        formData.append('files', file);
      });
  
      console.log('Sending request to backend...');
      const response = await fetch(API_ENDPOINTS.SEARCH, {
        method: 'POST',
        body: formData,
      });
  
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error:', errorText);
        throw new Error(`Search failed: ${response.status} ${errorText}`);
      }
  
      const searchResults = await response.json();
      console.log('Search results:', searchResults);
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Search failed: ${errorMessage}. Make sure the backend server is running at http://localhost:8000`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewFile = async (result: SearchResult) => {
    try {
      // Extract just the filename without the path
      const fullPath = result.filename;
      const fileName = fullPath.split('/').pop() || fullPath;
      
      console.log('Attempting to view file:', fileName);
      console.log('Original filename:', fullPath);
      console.log('Search result:', result);
      
      const response = await fetch(API_ENDPOINTS.FILE(fileName));
      
      if (!response.ok) {
        if (response.status === 404) {
          // Try with the full path
          console.log('Trying with full path:', fullPath);
          const fullPathResponse = await fetch(API_ENDPOINTS.FILE(fullPath));
          
          if (!fullPathResponse.ok) {
            throw new Error(`File '${result.filename}' is no longer available. Please upload your files again and search.`);
          }
          
          const fileData = await fullPathResponse.json();
          console.log('Successfully retrieved file data with full path:', fileData.filename);
          
          // Highlight the matching content
          const highlightedContent = highlightSearchContent(fileData.content, result.content_snippet, query);
          
          const newWindow = window.open('', '_blank');
          if (newWindow) {
            newWindow.document.write(`
              <html>
                <head>
                  <title>${fileData.filename}</title>
                  <style>
                    body { 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                      max-width: 800px; 
                      margin: 0 auto; 
                      padding: 20px; 
                      line-height: 1.6;
                      background-color: #f9fafb;
                    }
                    .header { 
                      background: white; 
                      padding: 20px; 
                      border-radius: 8px; 
                      margin-bottom: 20px; 
                      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    }
                    .content { 
                      background: white; 
                      padding: 20px; 
                      border-radius: 8px; 
                      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                      white-space: pre-wrap; 
                      font-family: 'Courier New', monospace;
                      font-size: 14px;
                      line-height: 1.5;
                    }
                    .highlight { 
                      background-color: #fef3c7; 
                      padding: 2px 4px; 
                      border-radius: 3px; 
                      font-weight: bold;
                      border: 1px solid #f59e0b;
                    }
                    .search-info {
                      background: #dbeafe;
                      padding: 10px;
                      border-radius: 6px;
                      margin-bottom: 15px;
                      border-left: 4px solid #2563eb;
                    }
                    h1 { color: #1f2937; margin: 0 0 10px 0; }
                    .score { color: #2563eb; font-weight: bold; }
                    .error { color: #dc2626; background: #fef2f2; padding: 10px; border-radius: 4px; }
                  </style>
                </head>
                <body>
                  <div class="header">
                    <h1>${fileData.filename}</h1>
                    <p class="score">Similarity Score: ${(result.similarity_score * 100).toFixed(1)}%</p>
                  </div>
                  <div class="search-info">
                    <strong>Search Query:</strong> "${query}"<br>
                    <strong>Matching Content:</strong> "${result.content_snippet}"<br>
                    <strong>Match Type:</strong> ${result.match_type || 'Semantic Match'}<br>
                    <strong>Confidence:</strong> ${result.confidence_level || 'Unknown'}
                  </div>
                  <div class="content">${highlightedContent}</div>
                </body>
              </html>
            `);
            newWindow.document.close();
          }
          return;
        }
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      
      const fileData = await response.json();
      console.log('Successfully retrieved file data:', fileData.filename);
      
      // Highlight the matching content
      const highlightedContent = highlightSearchContent(fileData.content, result.content_snippet, query);
      
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head>
              <title>${fileData.filename}</title>
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                  max-width: 800px; 
                  margin: 0 auto; 
                  padding: 20px; 
                  line-height: 1.6;
                  background-color: #f9fafb;
                }
                .header { 
                  background: white; 
                  padding: 20px; 
                  border-radius: 8px; 
                  margin-bottom: 20px; 
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .content { 
                  background: white; 
                  padding: 20px; 
                  border-radius: 8px; 
                  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                  white-space: pre-wrap; 
                  font-family: 'Courier New', monospace;
                  font-size: 14px;
                  line-height: 1.5;
                }
                .highlight { 
                  background-color: #fef3c7; 
                  padding: 2px 4px; 
                  border-radius: 3px; 
                  font-weight: bold;
                  border: 1px solid #f59e0b;
                }
                .search-info {
                  background: #dbeafe;
                  padding: 10px;
                  border-radius: 6px;
                  margin-bottom: 15px;
                  border-left: 4px solid #2563eb;
                }
                h1 { color: #1f2937; margin: 0 0 10px 0; }
                .score { color: #2563eb; font-weight: bold; }
                .error { color: #dc2626; background: #fef2f2; padding: 10px; border-radius: 4px; }
              </style>
            </head>
            <body>
                                <div class="header">
                    <h1>${fileData.filename}</h1>
                    <p class="score">Similarity Score: ${(result.similarity_score * 100).toFixed(1)}%</p>
                  </div>
                  <div class="search-info">
                    <strong>Search Query:</strong> "${query}"<br>
                    <strong>Matching Content:</strong> "${result.content_snippet}"<br>
                    <strong>Match Type:</strong> ${result.match_type || 'Semantic Match'}<br>
                    <strong>Confidence:</strong> ${result.confidence_level || 'Unknown'}
                  </div>
              <div class="content">${highlightedContent}</div>
            </body>
          </html>
        `);
        newWindow.document.close();
      }
    } catch (error) {
      console.error('Error fetching file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to load file content: ${errorMessage}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Fixed Header */}
      <div style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        padding: '1rem 0',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0 1rem' }}>
          {/* Header Content */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: '1.5rem'
          }}>
            {/* Logo and Title */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1.5rem'
            }}>
              {/* Cognizant Logo */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                padding: '16px 24px',
                borderRadius: '12px',
                flexShrink: 0
              }}>
                {/* Cognizant Logo Image */}
                <img 
                  src="/cognizant-logo.png"
                  alt="Cognizant"
                  style={{
                    width: '180px',
                    height: '180px',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    // Fallback to a simple text logo if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div style="
                          display: flex;
                          align-items: center;
                          gap: 16px;
                          padding: 16px 24px;
                          background: linear-gradient(135deg, #0ea5e9 0%, #1e3a8a 100%);
                          border-radius: 12px;
                          color: white;
                          font-weight: bold;
                          font-size: 24px;
                          font-family: Arial, sans-serif;
                        ">
                          <div style="
                            width: 48px;
                            height: 48px;
                            background: white;
                            border-radius: 6px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #1e3a8a;
                            font-size: 20px;
                            font-weight: bold;
                          ">C</div>
                          cognizant
                        </div>
                      `;
                    }
                  }}
                />
              </div>
              
              {/* App Title */}
              <div style={{ textAlign: 'left' }}>
                <h1 style={{ 
                  fontSize: '1.75rem', 
                  fontWeight: 'bold', 
                  color: '#111827', 
                  margin: '0 0 0.25rem 0'
                }}>
                  InsightFinder
                </h1>
                <p style={{ 
                  color: '#6b7280', 
                  fontSize: '0.875rem', 
                  margin: '0',
                  fontStyle: 'italic'
                }}>
                  Powered by Cognizant
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem'
            }}>
              {/* Header Description */}
              <div style={{ 
                textAlign: 'right',
                maxWidth: '300px'
              }}>
                <p style={{ 
                  color: '#6b7280', 
                  fontSize: '0.875rem', 
                  margin: '0',
                  lineHeight: '1.4'
                }}>
                  Search through your documents using natural language queries
                </p>
              </div>

              {/* Contact Us Link */}
              <div style={{
                position: 'relative',
                display: 'inline-block'
              }}>
                <button
                  onClick={() => setShowContact(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = '#e5e7eb';
                    (e.target as HTMLElement).style.color = '#374151';
                  }}
                  onMouseOut={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = '#f3f4f6';
                    (e.target as HTMLElement).style.color = '#6b7280';
                  }}
                  title="Contact Us"
                >
                  Contact Us
                </button>
              </div>

              {/* Help Icon */}
              <div style={{
                position: 'relative',
                display: 'inline-block'
              }}>
                <button
                  onClick={() => setShowHelp(true)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#f3f4f6',
                    color: '#6b7280',
                    border: '1px solid #d1d5db',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = '#e5e7eb';
                    (e.target as HTMLElement).style.color = '#374151';
                  }}
                  onMouseOut={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = '#f3f4f6';
                    (e.target as HTMLElement).style.color = '#6b7280';
                  }}
                  title="Help & Information"
                >
                  ?
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}
        onClick={() => setShowHelp(false)}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '2rem',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                margin: 0
              }}>
                How InsightFinder Works
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = '#f3f4f6'}
              >
                ×
              </button>
            </div>

            <div style={{ lineHeight: '1.6', color: '#374151' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem', color: '#111827' }}>
                Features
              </h3>
              <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                <li><strong>Semantic Search:</strong> Use natural language queries like "meeting notes from January"</li>
                <li><strong>Multiple Formats:</strong> Supports .txt, .pdf, and .md files</li>
                <li><strong>Smart Ranking:</strong> Results sorted by relevance using AI-powered similarity</li>
                <li><strong>Fast Processing:</strong> Built with modern technologies for quick searches</li>
              </ul>

              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem', color: '#111827' }}>
                How to Use
              </h3>
              <ol style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                <li>Click "Choose Files" to select your documents</li>
                <li>Enter a natural language search query (e.g., "project planning documents")</li>
                <li>Click "Search" to find relevant files</li>
                <li>View results with similarity scores and content snippets</li>
                <li>Click "View" to see the full content of any file</li>
              </ol>

              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem', color: '#111827' }}>
                How It Works
              </h3>
              <ol style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                <li><strong>File Processing:</strong> Your files are securely processed in memory</li>
                <li><strong>Text Extraction:</strong> Content is extracted from .txt, .pdf, and .md files</li>
                <li><strong>AI Embeddings:</strong> Both your query and file contents are converted to semantic vectors</li>
                <li><strong>Similarity Search:</strong> Advanced algorithms find the most relevant matches</li>
                <li><strong>Smart Ranking:</strong> Results are sorted by relevance score</li>
              </ol>

              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.75rem', color: '#111827' }}>
                Technology
              </h3>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Frontend:</strong> Next.js, React, TypeScript
              </p>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>Backend:</strong> Python FastAPI with sentence-transformers
              </p>
              <p style={{ marginBottom: '0.5rem' }}>
                <strong>AI Model:</strong> all-MiniLM-L6-v2 for semantic understanding
              </p>
              <p>
                <strong>Search Algorithm:</strong> Cosine similarity for accurate matching
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contact Us Modal */}
      {showContact && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}
        onClick={() => setShowContact(false)}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '2rem',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#111827',
                margin: 0
              }}>
                Contact Us
              </h2>
              <button
                onClick={() => setShowContact(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#e5e7eb'}
                onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = '#f3f4f6'}
              >
                ×
              </button>
            </div>

            <div style={{ lineHeight: '1.6', color: '#374151' }}>
              <p style={{ marginBottom: '1rem' }}>
                For any questions or feedback, please reach out to:
              </p>
              <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
                <li><strong>Shashi:</strong> Shashi.Deopa@cognizant.com</li>
                <li><strong>Yogesh:</strong> yogesh.kaushik2@cognizant.com</li>
              </ul>
              <p>
                We are here to help you make the most of InsightFinder.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div style={{ padding: '2rem 0' }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '0 1rem' }}>
          {/* Search Interface */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '0.75rem', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
            padding: '2rem', 
            marginBottom: '2rem' 
          }}>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: '#111827', 
              marginBottom: '1.5rem',
              margin: '0 0 1.5rem 0'
            }}>
              Select Files & Search
            </h2>
            
            {/* Search Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Folder Selection */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept=".txt,.pdf,.md,.docx"
                  style={{ display: 'none' }}
                />
                <button
                  onClick={handleFolderSelect}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    borderRadius: '0.5rem',
                    border: '1px solid #d1d5db',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#d1d5db'}
                  onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = '#e5e7eb'}
                >
                  Choose Files
                </button>
                
                {/* Information Icon */}
                <div style={{
                  position: 'relative',
                  display: 'inline-block'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'help',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = '#2563eb';
                    const tooltip = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                    if (tooltip) tooltip.style.display = 'block';
                  }}
                  onMouseOut={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = '#3b82f6';
                    const tooltip = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                    if (tooltip) tooltip.style.display = 'none';
                  }}
                  title="Supported file types"
                  >
                    i
                  </div>
                  
                  {/* Tooltip */}
                  <div style={{
                    position: 'absolute',
                    top: '30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#1f2937',
                    color: 'white',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.4',
                    whiteSpace: 'nowrap',
                    zIndex: 20,
                    display: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    border: '1px solid #374151'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                      Supported File Types:
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>
                      • Text files (.txt)<br/>
                      • PDF documents (.pdf)<br/>
                      • Markdown files (.md)<br/>
                      • Word documents (.docx)
                    </div>
                    <div style={{
                      position: 'absolute',
                      top: '-5px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '0',
                      height: '0',
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderBottom: '5px solid #1f2937'
                    }}></div>
                  </div>
                </div>
                
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  {uploadedFiles.length} file(s) selected
                </span>
              </div>

              {/* Selected Folder Path */}
              {selectedFolder && (
                <div style={{ 
                  backgroundColor: '#f0f9ff', 
                  borderRadius: '0.5rem', 
                  padding: '1rem',
                  border: '1px solid #bae6fd'
                }}>
                  <h3 style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '500', 
                    color: '#0369a1', 
                    marginBottom: '0.5rem',
                    margin: '0 0 0.5rem 0'
                  }}>
                    📁 Selected Folder Path:
                  </h3>
                  <div style={{ 
                    backgroundColor: '#ffffff',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    border: '1px solid #bae6fd',
                    marginBottom: '0.5rem'
                  }}>
                    <p style={{ 
                      color: '#0c4a6e', 
                      fontSize: '0.875rem',
                      margin: '0',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all',
                      fontWeight: '500'
                    }}>
                      📂 {selectedFolder || 'No folder selected'}
                    </p>
                    <p style={{ 
                      color: '#6b7280', 
                      fontSize: '0.75rem',
                      margin: '0.25rem 0 0 0',
                      fontFamily: 'monospace'
                    }}>
                      📍 Folder selected for semantic search
                    </p>
                  </div>
                </div>
              )}

              {/* Search Input and Button */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your search query..."
                  style={{
                    flex: '1',
                    padding: '0.75rem 1rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    color: '#111827',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLElement).style.borderColor = '#3b82f6';
                    (e.target as HTMLElement).style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLElement).style.borderColor = '#d1d5db';
                    (e.target as HTMLElement).style.boxShadow = 'none';
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  style={{
                    padding: '0.75rem 2rem',
                    backgroundColor: isLoading ? '#93c5fd' : '#2563eb',
                    color: 'white',
                    borderRadius: '0.5rem',
                    border: 'none',
                    fontWeight: '500',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (!isLoading) (e.target as HTMLElement).style.backgroundColor = '#1d4ed8';
                  }}
                  onMouseOut={(e) => {
                    if (!isLoading) (e.target as HTMLElement).style.backgroundColor = '#2563eb';
                  }}
                >
                  {isLoading ? 'Searching...' : 'Search'}
                </button>
                
                {/* Debug Button */}
                <button
                  onClick={async () => {
                    try {
                      console.log('=== Debug Backend ===');
                      const response = await fetch('http://localhost:8000/test');
                      const data = await response.json();
                      console.log('Backend test:', data);
                      alert(`Backend Status:\nStored files: ${data.stored_files.length}\nFiles: ${data.stored_files.join(', ')}`);
                    } catch (error) {
                      console.error('Debug failed:', error);
                      alert('Backend not responding. Please restart the backend server.');
                    }
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    borderRadius: '0.5rem',
                    border: 'none',
                    fontWeight: '500',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                  title="Debug Backend"
                >
                  Debug
                </button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '0.75rem', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', 
            padding: '2rem'
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 'bold', 
              color: '#111827', 
              marginBottom: '1.5rem',
              margin: '0 0 1.5rem 0'
            }}>
              Results
            </h2>
            
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{
                  display: 'inline-block',
                  width: '2rem',
                  height: '2rem',
                  border: '2px solid #e5e7eb',
                  borderTop: '2px solid #2563eb',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <p style={{ marginTop: '0.5rem', color: '#6b7280' }}>Searching files...</p>
                <style jsx>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            ) : results.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {results.map((result, index) => {
                  const similarityPercent = (result.similarity_score * 100).toFixed(1);
                  const confidenceLevel = result.confidence_level || 'Unknown';
                  const matchType = result.match_type || 'Semantic Match';
                  
                  // Determine relevance based on new threshold (15%)
                  const isHighRelevance = result.similarity_score >= 0.5;
                  const isMediumRelevance = result.similarity_score >= 0.3;
                  const isLowRelevance = result.similarity_score >= 0.15;
                  
                  // Get color based on confidence
                  const getConfidenceColor = (level: string) => {
                    switch (level) {
                      case 'Very High': return '#10b981';
                      case 'High': return '#059669';
                      case 'Medium': return '#f59e0b';
                      case 'Low': return '#f97316';
                      default: return '#ef4444';
                    }
                  };
                  
                  return (
                    <div
                      key={index}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        padding: '1rem',
                        transition: 'background-color 0.2s',
                        borderLeft: isHighRelevance ? '4px solid #10b981' : 
                                   isMediumRelevance ? '4px solid #f59e0b' : 
                                   isLowRelevance ? '4px solid #f97316' : '4px solid #ef4444'
                      }}
                      onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = 'white'}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start', 
                        marginBottom: '0.5rem' 
                      }}>
                        <h3 style={{ 
                          fontSize: '1.125rem', 
                          fontWeight: '600', 
                          color: '#111827',
                          margin: '0'
                        }}>
                          {result.filename}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ 
                              fontSize: '0.875rem', 
                              color: getConfidenceColor(confidenceLevel), 
                              fontWeight: '500',
                              display: 'block'
                            }}>
                              {similarityPercent}% match
                            </span>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              color: '#6b7280',
                              display: 'block'
                            }}>
                              {confidenceLevel} • {matchType}
                            </span>
                          </div>
                          <button
                            onClick={() => handleViewFile(result)}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#2563eb',
                              color: 'white',
                              fontSize: '0.875rem',
                              borderRadius: '0.25rem',
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              position: 'relative',
                              zIndex: 10
                            }}
                            onMouseOver={(e) => {
                              e.stopPropagation();
                              (e.target as HTMLElement).style.backgroundColor = '#1d4ed8';
                            }}
                            onMouseOut={(e) => {
                              e.stopPropagation();
                              (e.target as HTMLElement).style.backgroundColor = '#2563eb';
                            }}
                          >
                            View
                          </button>
                        </div>
                      </div>
                      <p style={{ 
                        color: '#6b7280', 
                        fontSize: '0.875rem', 
                        lineHeight: '1.5',
                        margin: '0'
                      }}>
                        ...{result.content_snippet}...
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : query && !isLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                <p>No matching files found. Try a different search query.</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                <p>Select some files and enter a search query to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
