// helpers/multer-config.js
const multer = require('multer');
const path = require('path');


// Define storage location and naming for images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/products');
  },
  filename: (req, file, cb) => {
    const uniqueString = Math.random().toString(36).substr(2, 4);
    const filename = `${Date.now()}${uniqueString}${path.extname(file.originalname)}`;
    cb(null, filename);
  }
});


// Filter file types for images only
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = /jpeg|jpg|png/;
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);


  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Only images (jpg, jpeg, png) are allowed!');
  }
};


const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: fileFilter
});


module.exports = upload;
 
