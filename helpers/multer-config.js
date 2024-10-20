const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/products");
  },
  filename: (req, file, cb) => {
    const uniqueString = Math.random().toString(36).substr(2, 4);
    const filename = `${Date.now()}${uniqueString}${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  // Accept cropped images which might be sent as image/jpeg or image/png
  const allowedFileTypes = /jpeg|jpg|png/;
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (mimetype) {
    return cb(null, true);
  } else {
    cb(new Error("Error: Only images (jpg, jpeg, png) are allowed!"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter,
});

module.exports = upload;