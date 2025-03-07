const Product = require("../../models/productsSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const path = require("path");
const fs = require("fs");
//const sharp = require("sharp");

// List all products
const listProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
    const search = req.query.search;
    const regex = new RegExp(search, "i");

    const query = { name: regex };

    const products = await Product.find(query)
      .populate("category")
      .populate("brand")
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);
    res.render("products-list", {
      products,
      currentPage: page,
      totalPages,
      search,
    });
  } catch (error) {
    console.log("Error listing products:", error);
    res.redirect("/admin/pageerror");
  }
};
//Load Add Product
const loadAddProducts = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    const brands = await Brand.find({ isListed: true });

    res.render("product-add", { categories, brands });
  } catch (error) {
    console.log("Error rendering add category page:", error);
    res.redirect("/admin/pageerror");
  }
};
//add product
const addProduct = async (req, res) => {
  try {
    // Validate minimum image requirement
    if (!req.files || req.files.length < 3) {
      return res.status(400).json({
        status: 'failure',
        message: 'Please upload at least 3 images.'
      });
    }

    // Log uploaded files for debugging
    console.log("Files uploaded:", req.files);

    // Extract product details from request body
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

    // Process uploaded images
    const images = req.files.map((file) => file.filename);

    // Create new product instance
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
      images,
    });

    console.log("Product to be saved:", product);
    await product.save();

    // Send success response for fetch request
    res.status(200).json({
      status: 'success',
      message: 'Product has been added successfully',
      product: product
    });

  } catch (error) {
    console.log("Error adding product:", error);
    
    // Send error response for fetch request
    res.status(500).json({
      status: 'failure',
      message: error.message || 'Error occurred while adding the product'
    });
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

// Load all brands
const loadBrands = async () => {
  try {
    const brands = await Brand.find({ isListed: true }).select("brandName _id");
    return brands;
  } catch (error) {
    console.log("Error loading brands:", error);
    return [];
  }
};

// Load product edit
const loadEditProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate("category").populate("brand");
    const categories = await loadCategories();
    const brands = await loadBrands(); // Load all brands
    res.render("product-edit", {
      product,
      categories,
      brands, // Pass brands to the view
      admin: true,
      pageTitle: "Edit Product",
    });
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
    } = req.body;

    const product = await Product.findById(id);

    let imagesToKeep = product.images;
    if (req.body.removeImages) {
      const imagesToRemove = Array.isArray(req.body.removeImages)
        ? req.body.removeImages
        : [req.body.removeImages];
      imagesToKeep = product.images.filter(
        (image) => !imagesToRemove.includes(image)
      );

      imagesToRemove.forEach((image) => {
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

    let newImages = [];
    if (req.files && req.files.length > 0) {
      newImages = req.files.map((file) => file.filename);
    }

    const updatedImages = [...imagesToKeep, ...newImages];

    const status = parseInt(quantity) === 0 ? "Out of Stock" : "Available";

    const updatedProduct = {
      name,
      description,
      brand,
      category,
      price,
      discount,
      quantity,
      color,
      material,
      images: updatedImages,
      status,
    };

    await Product.findByIdAndUpdate(id, { $set: updatedProduct });

    res.redirect('/admin/products?status=success&message=Product has been updated successfully.');
  } catch (error) {
    console.log("Error editing product:", error);
    res.redirect(`/admin/products?status=failure&message=Error occurred while updating the product.`);
  }
};

// Soft delete a product
const blockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndUpdate(id, { isListed: false });
    res.redirect('/admin/products?status=success&message=Product has been blocked successfully.');
  } catch (error) {
    console.log("Error deleting product:", error);
    res.redirect(`/admin/products?status=failure&message=Error occurred while blocking the product.`);
  }
};
const unblockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndUpdate(id, { isListed: true });
    res.redirect('/admin/products?status=success&message=Product has been unblocked successfully.');
  } catch (error) {
    console.log("Error unblocking product:", error);
    res.redirect(`/admin/products?status=failure&message=Error occurred while unblocking the product.`);
  }
};
module.exports = {
  listProducts,
  loadAddProducts,
  addProduct,
  loadEditProduct,
  editProduct,
  blockProduct,
  unblockProduct,
};
