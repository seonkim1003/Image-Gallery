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
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for videos
    fileFilter: (req, file, cb) => {
        const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
        const allowedVideoTypes = /mp4|webm|ogg|mov|avi/;
        const ext = path.extname(file.originalname).toLowerCase();
        const extname = allowedImageTypes.test(ext) || allowedVideoTypes.test(ext);
        const mimetype = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
        
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed!'));
        }
    }
});

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// Get all images and groups
app.get('/api/images', (req, res) => {
    try {
        const metadata = loadMetadata();
        const files = fs.readdirSync(uploadsDir);
        const mediaFiles = files
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext);
            });
        
        // Separate individual files and groups
        const groups = {};
        const individualFiles = [];
        
        mediaFiles.forEach(file => {
            const fileMeta = metadata[file];
            if (fileMeta?.groupId) {
                // This file belongs to a group
                if (!groups[fileMeta.groupId]) {
                    groups[fileMeta.groupId] = {
                        id: fileMeta.groupId,
                        files: [],
                        category: fileMeta.category || 'fun',
                        description: fileMeta.description || '',
                        uploadDate: fileMeta.uploadDate || new Date().toISOString(),
                        titleImage: null
                    };
                }
                groups[fileMeta.groupId].files.push({
                    id: file,
                    url: `/uploads/${file}`,
                    filename: file,
                    type: fileMeta.type || 'image'
                });
                // First file is the title image
                if (!groups[fileMeta.groupId].titleImage) {
                    groups[fileMeta.groupId].titleImage = {
                        id: file,
                        url: `/uploads/${file}`,
                        filename: file
                    };
                }
            } else {
                // Individual file
                individualFiles.push({
                    id: file,
                    url: `/uploads/${file}`,
                    filename: file,
                    category: fileMeta?.category || 'fun',
                    description: fileMeta?.description || '',
                    uploadDate: fileMeta?.uploadDate || new Date().toISOString(),
                    type: fileMeta?.type || 'image',
                    isGroup: false
                });
            }
        });
        
        // Convert groups to items
        const groupItems = Object.values(groups).map(group => ({
            id: group.id,
            url: group.titleImage.url,
            filename: group.titleImage.filename,
            category: group.category,
            description: group.description,
            uploadDate: group.uploadDate,
            type: 'group',
            isGroup: true,
            files: group.files
        }));
        
        // Combine and sort
        const allItems = [...individualFiles, ...groupItems].sort((a, b) => {
            return b.uploadDate.localeCompare(a.uploadDate);
        });
        
        res.json({ images: allItems });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load images' });
    }
});

// Upload image/video (supports batch uploads with grouping)
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
    }
    
    const category = req.body.category || 'fun';
    const description = req.body.description || '';
    const filename = req.file.filename;
    const uploadDate = new Date().toISOString();
    const groupId = req.body.groupId || null;
    const fileType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    
    // Save metadata with category, description, date, and group
    const metadata = loadMetadata();
    metadata[filename] = { 
        category,
        description,
        uploadDate,
        type: fileType,
        groupId: groupId
    };
    saveMetadata(metadata);
    
    res.json({
        id: filename,
        url: `/uploads/${filename}`,
        filename: filename,
        category: category,
        description: description,
        uploadDate: uploadDate,
        type: fileType,
        groupId: groupId
    });
});

// Get group details
app.get('/api/groups/:groupId', (req, res) => {
    try {
        const metadata = loadMetadata();
        const files = fs.readdirSync(uploadsDir);
        const groupId = req.params.groupId;
        const groupFiles = [];
        
        files.forEach(file => {
            const fileMeta = metadata[file];
            if (fileMeta?.groupId === groupId) {
                const ext = path.extname(file).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext)) {
                    groupFiles.push({
                        id: file,
                        url: `/uploads/${file}`,
                        filename: file,
                        type: fileMeta.type || 'image'
                    });
                }
            }
        });
        
        if (groupFiles.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        const firstFile = groupFiles[0];
        const fileMeta = metadata[firstFile.id];
        
        res.json({
            id: groupId,
            files: groupFiles,
            category: fileMeta?.category || 'fun',
            description: fileMeta?.description || '',
            uploadDate: fileMeta?.uploadDate || new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load group' });
    }
});

// Delete image or group
app.delete('/api/images/:id', (req, res) => {
    try {
        const metadata = loadMetadata();
        const itemId = req.params.id;
        
        // Check if it's a group ID (starts with 'group-')
        if (itemId.startsWith('group-')) {
            // Delete entire group
            const groupId = itemId;
            const files = fs.readdirSync(uploadsDir);
            let deletedCount = 0;
            
            files.forEach(file => {
                const fileMeta = metadata[file];
                if (fileMeta?.groupId === groupId) {
                    const filePath = path.join(uploadsDir, file);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        delete metadata[file];
                        deletedCount++;
                    }
                }
            });
            
            saveMetadata(metadata);
            res.json({ message: `Group deleted successfully (${deletedCount} files)` });
        } else {
            // Delete single file
            const imagePath = path.join(uploadsDir, itemId);
            const filename = itemId;
            
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
                
                // Remove from metadata
                if (metadata[filename]) {
                    delete metadata[filename];
                    saveMetadata(metadata);
                }
                
                res.json({ message: 'File deleted successfully' });
            } else {
                res.status(404).json({ error: 'File not found' });
            }
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
