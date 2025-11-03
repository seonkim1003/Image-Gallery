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

// Ensure uploads directory exists and is writable
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory:', uploadsDir);
}

// Verify uploads directory is writable (critical for persistence)
try {
    const testFile = path.join(uploadsDir, '.persistence-test');
    fs.writeFileSync(testFile, 'test', 'utf8');
    fs.unlinkSync(testFile);
    console.log('✓ Uploads directory is writable - images will persist to disk');
} catch (error) {
    console.error('✗ WARNING: Uploads directory is not writable! Images may not persist:', error.message);
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

// Save metadata to file (atomic write for data safety)
function saveMetadata(metadata) {
    try {
        // Write to temporary file first, then rename (atomic operation)
        const tempFile = metadataFile + '.tmp';
        fs.writeFileSync(tempFile, JSON.stringify(metadata, null, 2), 'utf8');
        fs.renameSync(tempFile, metadataFile);
        console.log('Metadata saved successfully');
    } catch (error) {
        console.error('Error saving metadata:', error);
        // Try to remove temp file if it exists
        try {
            const tempFile = metadataFile + '.tmp';
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        } catch (cleanupError) {
            console.error('Error cleaning up temp file:', cleanupError);
        }
    }
}

// Validate and sync metadata with actual files on disk (run on startup)
function syncMetadataWithFiles() {
    try {
        console.log('Syncing metadata with files on disk...');
        
        // Ensure uploads directory exists before syncing
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
            console.log('Created uploads directory during sync');
        }
        
        const metadata = loadMetadata();
        const files = fs.readdirSync(uploadsDir);
        const fileSet = new Set(files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext);
        }));
        
        let updated = false;
        
        // Remove metadata entries for files that no longer exist (except external links)
        Object.keys(metadata).forEach(key => {
            const meta = metadata[key];
            // Only check physical files, not external links
            if (!meta?.isExternal && !fileSet.has(key)) {
                console.log(`Removing orphaned metadata entry: ${key}`);
                delete metadata[key];
                updated = true;
            }
        });
        
        // Add metadata entries for files that exist but aren't in metadata
        fileSet.forEach(file => {
            if (!metadata[file]) {
                console.log(`Adding missing metadata entry for file: ${file}`);
                metadata[file] = {
                    category: 'fun',
                    description: '',
                    uploadDate: fs.statSync(path.join(uploadsDir, file)).mtime.toISOString(),
                    type: file.match(/\.(mp4|webm|ogg|mov|avi)$/i) ? 'video' : 'image',
                    groupId: null,
                    order: 999
                };
                updated = true;
            }
        });
        
        if (updated) {
            saveMetadata(metadata);
            console.log('Metadata synced successfully');
        } else {
            console.log('Metadata is already in sync');
        }
        
        // Log persistence status
        const imageCount = files.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        }).length;
        const videoCount = files.filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ['.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext);
        }).length;
        const externalCount = Object.values(metadata).filter(m => m?.isExternal).length;
        
        console.log(`\n✓ Image persistence verified:`);
        console.log(`  - ${imageCount} images stored on disk`);
        console.log(`  - ${videoCount} videos stored on disk`);
        console.log(`  - ${externalCount} external links in metadata`);
        console.log(`  - ${Object.keys(metadata).length} total items in metadata`);
        console.log(`  - All files persist to disk and will survive server restarts\n`);
        
    } catch (error) {
        console.error('Error syncing metadata:', error);
        // Ensure uploads directory exists even if sync fails
        if (!fs.existsSync(uploadsDir)) {
            try {
                fs.mkdirSync(uploadsDir, { recursive: true });
                console.log('Recreated uploads directory after sync error');
            } catch (mkdirError) {
                console.error('Failed to recreate uploads directory:', mkdirError);
            }
        }
    }
}

// Configure multer for file uploads with persistence guarantee
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure directory exists before saving (defense in depth)
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
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
        
        // Also check metadata for external links (not in filesystem)
        Object.keys(metadata).forEach(linkId => {
            const fileMeta = metadata[linkId];
            if (fileMeta?.isExternal) {
                // This is an external link, treat it as a file
                const ext = '.link'; // Dummy extension for external links
                const item = {
                    id: linkId,
                    url: fileMeta.embedUrl || fileMeta.externalUrl,
                    filename: linkId,
                    category: fileMeta?.category || 'fun',
                    description: fileMeta?.description || '',
                    uploadDate: fileMeta?.uploadDate || new Date().toISOString(),
                    type: fileMeta?.type || 'video',
                    isExternal: true,
                    externalUrl: fileMeta.externalUrl,
                    embedUrl: fileMeta.embedUrl,
                    videoType: fileMeta.videoType,
                    order: fileMeta?.order !== undefined ? fileMeta.order : 999,
                    isGroup: !!fileMeta?.groupId,
                    groupId: fileMeta?.groupId || null
                };
                
                if (fileMeta?.groupId) {
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
                        id: linkId,
                        url: fileMeta.embedUrl || fileMeta.externalUrl,
                        filename: linkId,
                        type: 'video',
                        order: fileMeta?.order !== undefined ? fileMeta.order : 999,
                        isExternal: true,
                        externalUrl: fileMeta.externalUrl,
                        embedUrl: fileMeta.embedUrl,
                        videoType: fileMeta.videoType
                    });
                } else {
                    individualFiles.push(item);
                }
            }
        });
        
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
                        type: fileMeta.type || 'image',
                        isExternal: false
                    });
                }
            }
        });
        
        // Get external links in the group
        Object.keys(metadata).forEach(linkId => {
            const fileMeta = metadata[linkId];
            if (fileMeta?.isExternal && fileMeta?.groupId === groupId) {
                groupFiles.push({
                    id: linkId,
                    url: fileMeta.embedUrl || fileMeta.externalUrl,
                    filename: linkId,
                    type: 'video',
                    isExternal: true,
                    externalUrl: fileMeta.externalUrl,
                    embedUrl: fileMeta.embedUrl,
                    videoType: fileMeta.videoType
                });
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
        
        // Verify file exists (for physical files) or is external link and belongs to the group
        if (titleImageId.startsWith('link-')) {
            // External link - check if it exists in metadata
            const fileMeta = metadata[titleImageId];
            if (!fileMeta || !fileMeta.isExternal || fileMeta.groupId !== groupId) {
                return res.status(404).json({ error: 'Link not found or does not belong to group' });
            }
        } else {
            // Physical file
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'File not found' });
            }
        }
        
        const fileMeta = metadata[titleImageId];
        if (!fileMeta || fileMeta.groupId !== groupId) {
            return res.status(400).json({ error: 'File/Link does not belong to this group' });
        }
        
        // Update title image for all files in the group (both physical files and external links)
        const files = fs.readdirSync(uploadsDir);
        files.forEach(file => {
            const meta = metadata[file];
            if (meta?.groupId === groupId) {
                metadata[file].titleImageId = titleImageId;
            }
        });
        
        // Also update external links
        Object.keys(metadata).forEach(linkId => {
            const fileMeta = metadata[linkId];
            if (fileMeta?.isExternal && fileMeta?.groupId === groupId) {
                metadata[linkId].titleImageId = titleImageId;
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
        
        // Update order for all files in the group (both physical files and external links)
        const files = fs.readdirSync(uploadsDir);
        files.forEach(file => {
            const meta = metadata[file];
            if (meta?.groupId === groupId) {
                const orderIndex = fileOrder.indexOf(file);
                if (orderIndex !== -1) {
                    metadata[file].order = orderIndex;
                }
            }
        });
        
        // Also update external links
        Object.keys(metadata).forEach(linkId => {
            const fileMeta = metadata[linkId];
            if (fileMeta?.isExternal && fileMeta?.groupId === groupId) {
                const orderIndex = fileOrder.indexOf(linkId);
                if (orderIndex !== -1) {
                    metadata[linkId].order = orderIndex;
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
        const externalLinks = [];
        
        // Get all files in the group (both uploaded and external)
        files.forEach(file => {
            const fileMeta = metadata[file];
            if (fileMeta?.groupId === groupId) {
                const ext = path.extname(file).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext)) {
                    groupFiles.push({
                        id: file,
                        path: path.join(uploadsDir, file),
                        filename: file,
                        order: fileMeta?.order !== undefined ? fileMeta.order : 999
                    });
                }
            }
        });
        
        // Also check for external links in the group
        Object.keys(metadata).forEach(linkId => {
            const fileMeta = metadata[linkId];
            if (fileMeta?.isExternal && fileMeta?.groupId === groupId) {
                externalLinks.push({
                    id: linkId,
                    url: fileMeta.externalUrl,
                    embedUrl: fileMeta.embedUrl,
                    order: fileMeta?.order !== undefined ? fileMeta.order : 999
                });
            }
        });
        
        if (groupFiles.length === 0 && externalLinks.length === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Combine and sort all files by order
        const allItems = [...groupFiles, ...externalLinks].sort((a, b) => {
            if (a.order !== b.order) {
                return a.order - b.order;
            }
            return a.id.localeCompare(b.id);
        });
        
        // Get description for zip filename
        let firstFileMeta = null;
        if (groupFiles.length > 0) {
            firstFileMeta = metadata[groupFiles[0].id];
        } else if (externalLinks.length > 0) {
            firstFileMeta = metadata[externalLinks[0].id];
        }
        
        const description = firstFileMeta?.description || 'group';
        const zipFilename = description.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'group';
        
        // Create zip file
        res.attachment(`${zipFilename}.zip`);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);
        
        // Add files with numbered names based on order
        let fileIndex = 0;
        allItems.forEach((item) => {
            if (item.path) {
                // Physical file
                const ext = path.extname(item.filename);
                const numberedName = `${fileIndex + 1}${ext}`;
                archive.file(item.path, { name: numberedName });
                fileIndex++;
            } else if (item.url) {
                // External link - create a text file with the URL
                const linkName = `${fileIndex + 1}_external_link.txt`;
                archive.append(`External Video Link:\n${item.url}\n\nEmbed URL:\n${item.embedUrl || item.url}`, { name: linkName });
                fileIndex++;
            }
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
            
            // Delete physical files
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
            
            // Delete external links
            Object.keys(metadata).forEach(linkId => {
                const fileMeta = metadata[linkId];
                if (fileMeta?.isExternal && fileMeta?.groupId === groupId) {
                    delete metadata[linkId];
                    deletedCount++;
                }
            });
            
            saveMetadata(metadata);
            res.json({ message: `Group deleted successfully (${deletedCount} items)` });
        } else if (itemId.startsWith('link-')) {
            // Delete external link
            if (metadata[itemId]) {
                delete metadata[itemId];
                saveMetadata(metadata);
                res.json({ message: 'Link deleted successfully' });
            } else {
                res.status(404).json({ error: 'Link not found' });
            }
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

// Get storage usage
app.get('/api/storage', (req, res) => {
    try {
        const files = fs.readdirSync(uploadsDir);
        let totalSize = 0;
        
        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                }
            } catch (error) {
                // Skip files that can't be read
            }
        });
        
        // Storage limit: 500MB (524288000 bytes) for free tier
        const storageLimit = 500 * 1024 * 1024; // 500MB
        const used = totalSize;
        const available = Math.max(0, storageLimit - used);
        const percentage = (used / storageLimit) * 100;
        
        res.json({
            used: used,
            available: available,
            limit: storageLimit,
            percentage: Math.min(100, percentage.toFixed(2))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to calculate storage' });
    }
});

// Upload external video link (YouTube/Google Drive)
app.post('/api/upload-link', (req, res) => {
    try {
        const { url, category, description, groupId } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        // Validate URL
        let videoType = 'unknown';
        let embedUrl = url;
        
        // YouTube URL handling
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            videoType = 'youtube';
            // Extract video ID
            let videoId = null;
            if (url.includes('youtube.com/watch?v=')) {
                videoId = url.split('v=')[1]?.split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1]?.split('?')[0];
            }
            
            if (videoId) {
                embedUrl = `https://www.youtube.com/embed/${videoId}`;
            }
        } 
        // Google Drive URL handling
        else if (url.includes('drive.google.com')) {
            videoType = 'googledrive';
            // Extract file ID from Google Drive URL
            let fileId = null;
            if (url.includes('/file/d/')) {
                fileId = url.split('/file/d/')[1]?.split('/')[0];
            }
            
            if (fileId) {
                embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
            }
        }
        
        const uploadDate = new Date().toISOString();
        const linkId = 'link-' + Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalFilename = url;
        
        // Extract order from URL if it has a number
        let order = extractOrderFromFilename(originalFilename);
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
            order = maxOrder + 1;
        } else if (order === null) {
            order = 999;
        }
        
        // Save metadata for external link
        const metadata = loadMetadata();
        metadata[linkId] = {
            category: category || 'fun',
            description: description || '',
            uploadDate: uploadDate,
            type: 'video',
            groupId: groupId,
            order: order,
            isExternal: true,
            externalUrl: url,
            embedUrl: embedUrl,
            videoType: videoType
        };
        saveMetadata(metadata);
        
        res.json({
            id: linkId,
            url: embedUrl,
            filename: linkId,
            category: category || 'fun',
            description: description || '',
            uploadDate: uploadDate,
            type: 'video',
            groupId: groupId,
            order: order,
            isExternal: true,
            externalUrl: url,
            embedUrl: embedUrl,
            videoType: videoType
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save link' });
    }
});

// Enhanced health check for hosting platforms (24/7 monitoring)
app.get('/api/health', (req, res) => {
    try {
        // Verify critical directories exist
        const uploadsExists = fs.existsSync(uploadsDir);
        const metadataExists = fs.existsSync(metadataFile);
        
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            },
            disk: {
                uploadsDirectory: uploadsExists,
                metadataFile: metadataExists
            }
        };
        
        // If critical components missing, still return 200 but mark as degraded
        if (!uploadsExists) {
            health.status = 'degraded';
            health.message = 'Uploads directory missing';
        }
        
        res.json(health);
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Run metadata sync on startup
syncMetadataWithFiles();

app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║         Server running on http://localhost:${PORT}         ║`);
    console.log(`╚══════════════════════════════════════════════════════╝\n`);
    console.log(`📁 Images persist to: ${uploadsDir}`);
    console.log(`📄 Metadata persists to: ${metadataFile}`);
    console.log(`\n✓ All uploaded images are saved to disk`);
    console.log(`✓ Images will survive server restarts`);
    console.log(`✓ Images will survive offline periods`);
    console.log(`✓ Images persist even after server stops\n`);
    
    // Final persistence verification
    const fileCount = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.ogg', '.mov', '.avi'].includes(ext);
    }).length : 0;
    
    if (fileCount > 0) {
        console.log(`✓ Verified: ${fileCount} media file(s) currently stored on disk\n`);
    }
});
