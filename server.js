const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Metadata file to store image categories
const metadataFile = path.join(__dirname, 'image-metadata.json');

// Load metadata from file
function loadMetadata() {
    try {
        if (fs.existsSync(metadataFile)) {
            const data = fs.readFileSync(metadataFile, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading metadata:', error);
    }
    return {};
}

// Save metadata to file
function saveMetadata(metadata) {
    try {
        fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
        console.error('Error saving metadata:', error);
    }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Get all images
app.get('/api/images', (req, res) => {
    try {
        const metadata = loadMetadata();
        const files = fs.readdirSync(uploadsDir);
        const images = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
            })
            .map(file => ({
                id: file,
                url: `/uploads/${file}`,
                filename: file,
                category: metadata[file]?.category || 'fun',
                description: metadata[file]?.description || '',
                uploadDate: metadata[file]?.uploadDate || new Date().toISOString()
            }))
            .sort((a, b) => {
                // Sort by filename (which contains timestamp)
                return b.filename.localeCompare(a.filename);
            });
        
        res.json({ images });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load images' });
    }
});

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }
    
    const category = req.body.category || 'fun';
    const description = req.body.description || '';
    const filename = req.file.filename;
    const uploadDate = new Date().toISOString();
    
    // Save metadata with category, description, and date
    const metadata = loadMetadata();
    metadata[filename] = { 
        category,
        description,
        uploadDate
    };
    saveMetadata(metadata);
    
    res.json({
        id: filename,
        url: `/uploads/${filename}`,
        filename: filename,
        category: category,
        description: description,
        uploadDate: uploadDate
    });
});

// Delete image
app.delete('/api/images/:id', (req, res) => {
    try {
        const imagePath = path.join(uploadsDir, req.params.id);
        const filename = req.params.id;
        
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
            
            // Remove from metadata
            const metadata = loadMetadata();
            if (metadata[filename]) {
                delete metadata[filename];
                saveMetadata(metadata);
            }
            
            res.json({ message: 'Image deleted successfully' });
        } else {
            res.status(404).json({ error: 'Image not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
