const Product = require("../../models/productsSchema");
const Category = require("../../models/categorySchema");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

// List all products
const listProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const regex = new RegExp(search, 'i');

    const products = await Product.find({
      $or: [
        { name: regex },
        { brand: regex },
        // Add more fields to search if needed
      ]
    })
      .populate({ path: "category", match: { name: regex, isListed: true } }) // Update this line
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments({
      $or: [
        { name: regex },
        { brand: regex },
        // Add more fields to search if needed
      ]
    });
    const totalPages = Math.ceil(totalProducts / limit);
    res.render("products-list", { products, currentPage: page, totalPages, search });
  } catch (error) {
    console.log("Error listing products:", error);
    res.redirect("/admin/pageerror");
  }
};

//Load Add Product
const loadAddProducts = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });

    res.render("product-add", { categories: categories });
    //res.render("product-add", { title: "Add New Product" });
  } catch (error) {
    console.log("Error rendering add category page:", error);
    res.redirect("/admin/pageerror");
  }
};
//add product
const addProduct = async (req, res) => {
  try {
    // Ensure `req.files` contains at least 3 images
    if (req.files.length < 3) {
      return res.status(400).send("Please upload at least 3 images.");
    }
    console.log("Files uploaded:", req.files);
    const {
      name,
      description,
      brand,
      category,
      price,
      discount,
      quantity,
      color,
      material,
    } = req.body;
    // Extract image filenames if uploaded
    let images = [];
    if (req.files) {
      images = req.files.map((file) => file.filename);
    }
    const product = new Product({
      name,
      description,
      brand,
      category,
      price,
      discount,
      quantity,
      color,
      material,
      status: "Available",
      images, // Assign array of image paths
    });
    console.log("Product to be saved:", product);
    // Save product to the database
    await product.save();
    res.redirect("/admin/products");
  } catch (error) {
    console.log("Error adding product:", error);
    res.redirect("/admin/pageerror");
  }
};
// Load all categories
const loadCategories = async () => {
  try {
    const categories = await Category.find({ isListed: true }).select(
      "name _id"
    );
    return categories;
  } catch (error) {
    console.log("Error loading categories:", error);
    return [];
  }
};
// Load product edit
const loadEditProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate("category");
    const categories = await loadCategories();
    res.render("product-edit", { product, categories });
  } catch (error) {
    console.log("Error rendering edit product page:", error);
    res.redirect("/admin/pageerror");
  }
};
//edit product
const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      brand,
      category,
      price,
      discount,
      quantity,
      color,
      material,
      // status  // Remove this line if it exists
    } = req.body;
    
    const product = await Product.findById(id);
    
    // Handle image deletion
    if (product.images && product.images.length > 0) {
      product.images.forEach((image) => {
        const imagePath = path.join(
          __dirname,
          "../../public/uploads/products/",
          image
        );
        try {
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (err) {
          console.error(`Error deleting image: ${imagePath}. Error: ${err}`);
        }
      });
    }
    
    // Handle new images
    let newImages = [];
    if (req.files && req.files.length > 0) {
      newImages = req.files.map((file) => file.filename);
    }
    
    // Determine status based on quantity
    const status = parseInt(quantity) === 0 ? 'Out of Stock' : 'Available';
    
    const updateProduct = {
      name,
      description,
      brand,
      category,
      price,
      discount,
      quantity,
      color,
      material,
      images: newImages,
      status  // This will override any status from the form
    };
    
    await Product.findByIdAndUpdate(id, { $set: updateProduct });

    res.redirect("/admin/products");
  } catch (error) {
    console.log("Error editing product:", error);
    res.redirect("/admin/pageerror");
  }
};
// Soft delete a product
const blockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndUpdate(id, { isListed: false });
    res.redirect("/admin/products");
  } catch (error) {
    console.log("Error deleting product:", error);
    res.redirect("/admin/pageerror");
  }
};
const unblockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndUpdate(id, { isListed: true });
    res.redirect("/admin/products");
  } catch (error) {
    console.log("Error unblocking product:", error);
    res.redirect("/admin/pageerror");
  }
};
module.exports = {
  listProducts,
  loadAddProducts,
  addProduct,
  loadEditProduct,
  editProduct,
  blockProduct,
  unblockProduct
};
