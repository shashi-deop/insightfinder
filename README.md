# InsightFinder - Semantic File Search

A powerful semantic search application that allows users to search through documents using natural language queries. Built with Next.js frontend and Python FastAPI backend.

## 🚀 Features

- **Semantic Search**: Search documents using natural language queries
- **Multiple File Types**: Support for `.txt`, `.pdf`, `.md`, and `.docx` files
- **Folder Upload**: Upload entire folders for batch processing
- **Real-time Results**: Instant search results with relevance scoring
- **File Preview**: View full content of search results
- **Modern UI**: Clean, responsive interface with Cognizant branding

## 🛠️ Technology Stack

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Inline CSS** - Styling
- **React Hooks** - State management

### Backend
- **Python 3.8+** - Backend language
- **FastAPI** - Web framework
- **sentence-transformers** - Semantic embeddings
- **PyPDF2** - PDF text extraction
- **python-docx** - DOCX text extraction
- **NumPy** - Numerical operations

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- Git

### Frontend Setup
```bash
# Navigate to project directory
cd smart-finder

# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Start backend server
python app_simple.py
```

## 🎯 Usage

1. **Upload Files**: Click "Browse Files" to select individual files or "Select Folder" for batch upload
2. **Enter Query**: Type your search query in natural language
3. **Search**: Click "Search" to find relevant documents
4. **View Results**: Click "View" on any result to see full content

## 🔧 Configuration

### Supported File Types
- `.txt` - Plain text files
- `.pdf` - PDF documents
- `.md` - Markdown files
- `.docx` - Microsoft Word documents

### Search Features
- **Semantic Matching**: Uses AI embeddings for intelligent search
- **Relevance Scoring**: Results ranked by similarity
- **Threshold Filtering**: Only shows relevant results (similarity > 0.1)

## 🚀 Deployment Options

### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
vercel

# Deploy backend to Railway/Render
# Upload backend folder to Railway or Render
```

### Option 2: Railway
```bash
# Deploy both frontend and backend
railway login
railway init
railway up
```

### Option 3: Render
```bash
# Create render.yaml for both services
# Deploy via Render dashboard
```

## 📁 Project Structure

```
smart-finder/
├── src/
│   └── app/
│       ├── page.tsx          # Main frontend component
│       ├── layout.tsx        # Root layout
│       └── globals.css       # Global styles
├── backend/
│   ├── app_simple.py         # Main backend API
│   ├── requirements.txt      # Python dependencies
│   └── debug_test.py        # Debug utilities
├── public/
│   ├── favicon.png          # App favicon
│   └── cognizant-logo.png   # Logo image
└── README.md
```

## 🔍 API Endpoints

- `GET /` - Health check
- `POST /upload` - Upload files
- `POST /search` - Search documents
- `GET /file/{filename}` - Get file content
- `GET /status` - Backend status
- `GET /debug/files` - List stored files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Contact

- **Shashi Deopa** - Shashi.Deopa@cognizant.com
- **Yogesh Kaushik** - yogesh.kaushik2@cognizant.com

## 📄 License

This project is proprietary to Cognizant Technology Solutions.

---

**Built with ❤️ by Cognizant Team**
