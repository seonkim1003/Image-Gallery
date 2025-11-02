const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const archiver = require('archiver');

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
                        titleImage: null,
                        titleImageId: null
                    };
                }
                groups[fileMeta.groupId].files.push({
                    id: file,
                    url: `/uploads/${file}`,
                    filename: file,
                    type: fileMeta.type || 'image',
                    order: fileMeta.order !== undefined ? fileMeta.order : 999
                });
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
        
        // Find title image for each group
        Object.values(groups).forEach(group => {
            // Sort files by order first
            group.files.sort((a, b) => {
                if (a.order !== b.order) {
                    return a.order - b.order;
                }
                return a.id.localeCompare(b.id);
            });
            
            // Find title image ID from any file in the group
            let titleImageId = null;
            for (const file of group.files) {
                const fileMeta = metadata[file.id];
                if (fileMeta?.titleImageId) {
                    titleImageId = fileMeta.titleImageId;
                    break;
                }
            }
            
            // If no title image set, use first file (after sorting by order)
            if (!titleImageId && group.files.length > 0) {
                titleImageId = group.files[0].id;
            }
            
            // Find the title image file
            const titleFile = group.files.find(f => f.id === titleImageId) || group.files[0];
            group.titleImage = {
                id: titleFile.id,
                url: titleFile.url,
                filename: titleFile.filename
            };
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

// Helper function to extract number from filename
function extractOrderFromFilename(filename) {
    // Remove extension
    const nameWithoutExt = path.parse(filename).name;
    
    // Try to find numbers in the filename
    // Look for patterns like: "1", "image1", "photo_2", "3_image", etc.
    const numberMatch = nameWithoutExt.match(/\d+/);
    if (numberMatch) {
        const number = parseInt(numberMatch[0], 10);
        // Only use if it's a reasonable number (1-9999)
        if (number >= 1 && number <= 9999) {
            return number - 1; // Convert to 0-based index
        }
    }
    
    // Also try from original filename if provided
    return null;
}

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
    
    // Extract order from original filename
    const originalFilename = req.file.originalname;
    let order = extractOrderFromFilename(originalFilename);
    
    // If no order found and we have a groupId, check existing files in group for max order
    if (order === null && groupId) {
        const metadata = loadMetadata();
        const files = fs.readdirSync(uploadsDir);
        let maxOrder = -1;
        
        files.forEach(file => {
            const fileMeta = metadata[file];
            if (fileMeta?.groupId === groupId && fileMeta.order !== undefined) {
                maxOrder = Math.max(maxOrder, fileMeta.order);
            }
        });
        
        order = maxOrder + 1; // Set to next order after max
    } else if (order === null) {
        order = 999; // Default for non-grouped files
    }
    
    // Save metadata with category, description, date, group, and order
    const metadata = loadMetadata();
    metadata[filename] = { 
        category,
        description,
        uploadDate,
        type: fileType,
        groupId: groupId,
        order: order
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
        groupId: groupId,
        order: order
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
        
        // Find the title image ID from any file in the group
        let titleImageId = null;
        for (const file of groupFiles) {
            const meta = metadata[file.id];
            if (meta?.titleImageId) {
                titleImageId = meta.titleImageId;
                break;
            }
        }
        
        // Sort files by order if available
        groupFiles.sort((a, b) => {
            const metaA = metadata[a.id];
            const metaB = metadata[b.id];
            const orderA = metaA?.order !== undefined ? metaA.order : 999;
            const orderB = metaB?.order !== undefined ? metaB.order : 999;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            return a.id.localeCompare(b.id);
        });
        
        // Mark which file is the title image
        const filesWithTitle = groupFiles.map(file => ({
            ...file,
            isTitle: titleImageId ? file.id === titleImageId : file.id === groupFiles[0].id
        }));
        
        res.json({
            id: groupId,
            files: filesWithTitle,
            category: fileMeta?.category || 'fun',
            description: fileMeta?.description || '',
            uploadDate: fileMeta?.uploadDate || new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load group' });
    }
});

// Update group title image
app.put('/api/groups/:groupId/title', (req, res) => {
    try {
        const groupId = req.params.groupId;
        const titleImageId = req.body.titleImageId;
        
        if (!titleImageId) {
            return res.status(400).json({ error: 'Title image ID required' });
        }
        
        const metadata = loadMetadata();
        const filePath = path.join(uploadsDir, titleImageId);
        
        // Verify file exists and belongs to the group
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const fileMeta = metadata[titleImageId];
        if (!fileMeta || fileMeta.groupId !== groupId) {
            return res.status(400).json({ error: 'File does not belong to this group' });
        }
        
        // Update title image for all files in the group
        const files = fs.readdirSync(uploadsDir);
        files.forEach(file => {
            const meta = metadata[file];
            if (meta?.groupId === groupId) {
                meta.titleImageId = titleImageId;
            }
        });
        
        saveMetadata(metadata);
        res.json({ message: 'Title image updated successfully', titleImageId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update title image' });
    }
});

// Update group file order
app.put('/api/groups/:groupId/order', (req, res) => {
    try {
        const groupId = req.params.groupId;
        const fileOrder = req.body.fileOrder; // Array of file IDs in order
        
        if (!Array.isArray(fileOrder)) {
            return res.status(400).json({ error: 'File order must be an array' });
        }
        
        const metadata = loadMetadata();
        
        // Update order for all files in the group
        const files = fs.readdirSync(uploadsDir);
        files.forEach(file => {
            const meta = metadata[file];
            if (meta?.groupId === groupId) {
                const orderIndex = fileOrder.indexOf(file);
                if (orderIndex !== -1) {
                    meta.order = orderIndex;
                }
            }
        });
        
        saveMetadata(metadata);
        res.json({ message: 'Order updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update order' });
    }
});

// Download group as zip
app.get('/api/groups/:groupId/download', (req, res) => {
    try {
        const groupId = req.params.groupId;
        const metadata = loadMetadata();
        const files = fs.readdirSync(uploadsDir);
        const groupFiles = [];
        
        // Get all files in the group
        files.forEach(file => {
            const fileMeta = metadata[file];
            if (fileMeta?.groupId === groupId) {
                const ext = path.extname(file).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext)) {
                    groupFiles.push({
                        id: file,
                        path: path.join(uploadsDir, file),
                        filename: file,
                        order: fileMeta?.order !== undefined ? fileMeta.order : 999 // Default to end if no order
                    });
                }
            }
        });
        
        if (groupFiles.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Sort by order, then by original filename as fallback
        groupFiles.sort((a, b) => {
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            return a.filename.localeCompare(b.filename);
        });
        
        // Get description for zip filename
        const firstFile = groupFiles[0];
        const fileMeta = metadata[firstFile.id];
        const description = fileMeta?.description || 'group';
        const zipFilename = description.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'group';
        
        // Create zip file
        res.attachment(`${zipFilename}.zip`);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);
        
        // Add files with numbered names based on order
        groupFiles.forEach((file, index) => {
            const ext = path.extname(file.filename);
            const numberedName = `${index + 1}${ext}`;
            archive.file(file.path, { name: numberedName });
        });
        
        archive.finalize();
    } catch (error) {
        res.status(500).json({ error: 'Failed to create zip file' });
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
