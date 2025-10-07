const Product = require("../../models/productsSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const path = require("path");
const fs = require("fs");
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")

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
      .sort({ createdOn: -1 })
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
    if (!req.files || req.files.length < 3) {
      return res.status(STATUSCODES.BAD_REQUEST).json({
        status: "failure",
        message: MESSAGES.PRODUCT.IMAGE_LIMIT,
      });
    }

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

    const images = req.files.map((file) => file.path);

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

    await product.save();

    res.status(STATUSCODES.OK).json({
      status: "success",
      message: MESSAGES.PRODUCT.CREATED,
      product: product,
    });
  } catch (error) {
    console.log("Error adding product:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({
      status: "failure",
      message: MESSAGES.GENERAL.SERVER_ERROR,
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
    const product = await Product.findById(id)
      .populate("category")
      .populate("brand");
    const categories = await loadCategories();
    const brands = await loadBrands();
    res.render("product-edit", {
      product,
      categories,
      brands,
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
    const rawName = req.body.name ?? "";
    const rawDescription = req.body.description ?? "";
    const rawBrand = req.body.brand ?? "";
    const rawCategory = req.body.category ?? "";
    const rawPrice = req.body.price ?? "";
    const rawDiscount = req.body.discount ?? "";
    const rawQuantity = req.body.quantity ?? "";
    const rawColor = req.body.color ?? "";
    const rawMaterial = req.body.material ?? "";

    const name = String(rawName).trim();
    const description = String(rawDescription).trim();
    const brand = rawBrand;
    const category = rawCategory;
    const price = parseFloat(rawPrice) || 0;
    const discount = parseFloat(rawDiscount) || 0;
    const quantity = parseInt(rawQuantity) || 0;
    const color = String(rawColor).trim();
    const material = String(rawMaterial).trim();

    const product = await Product.findById(id);
    if (!product) {
      return res.redirect("/admin/products?status=failure&message=Product not found");
    }

    const errors = {};
    if (!name) errors.name = "Product name is required.";
    if (!description) errors.description = "Description is required.";

    const colorMaterialRegex = /^[a-zA-Z\s\-]+$/;
    if (!color) {
      errors.color = "Color is required.";
    } else if (!colorMaterialRegex.test(color)) {
      errors.color = "Color can only contain letters, spaces, and hyphens.";
    }

    if (!material) {
      errors.material = "Material is required.";
    } else if (!colorMaterialRegex.test(material)) {
      errors.material = "Material can only contain letters, spaces, and hyphens.";
    }

    if (price < 0) errors.price = "Price must be >= 0.";
    if (discount < 0 || discount > 90) errors.discount = "Discount must be between 0 and 90.";
    if (quantity < 0) errors.quantity = "Quantity must be >= 0.";

    let imagesToRemove = [];
    if (req.body.removeImages) {
      imagesToRemove = Array.isArray(req.body.removeImages)
        ? req.body.removeImages
        : [req.body.removeImages];
    }

    const remainingExistingImages = product.images.filter(img => !imagesToRemove.includes(img)).length;

    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const newImagesCount = uploadedFiles.length;

    const totalAfterUpdate = remainingExistingImages + newImagesCount;
    if (totalAfterUpdate < 3) {
      errors.imageCount = `At least 3 images are required. You will have ${totalAfterUpdate} image(s) after update.`;
    }

    if (Object.keys(errors).length > 0) {
      for (const f of uploadedFiles) {
        try {
          if (f && f.path && fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
          }
        } catch (e) {
          console.warn("Failed to cleanup uploaded file:", f?.path, e.message);
        }
      }

      const formData = {
        name,
        description,
        brand,
        category,
        price,
        discount,
        quantity,
        color,
        material
      };

      const categories = await loadCategories();
      const brands = await loadBrands();

      return res.status(STATUSCODES.BAD_REQUEST).render("product-edit", {
        product,        
        categories,
        brands,
        admin: true,
        pageTitle: "Edit Product",
        errors,
        formData,
        removedImages: imagesToRemove
      });
    }

    const imagesToKeep = product.images.filter(img => !imagesToRemove.includes(img));
    const newImagePaths = uploadedFiles.map(f => f.path);
    const updatedImages = [...imagesToKeep, ...newImagePaths];

    const status = quantity === 0 ? "Out of Stock" : "Available";

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

    return res.redirect("/admin/products?status=success&message=Product has been updated successfully.");
  } catch (error) {
    console.error("Error editing product:", error);
    if (req.files && req.files.length) {
      for (const f of req.files) {
        try { if (f && f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch (e) {}
      }
    }
    return res.redirect(`/admin/products/edit/${req.params.id}?status=failure&message=Error occurred while updating the product.`);
  }
};


// Soft delete a product
const blockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndUpdate(id, { isListed: false });
    res.status(STATUSCODES.OK).json({
      success: true,
      message: MESSAGES.PRODUCT.BLOCKED,
    });
  } catch (error) {
    console.log("Error deleting product:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.GENERAL.SERVER_ERROR,
    });
  }
};
const unblockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndUpdate(id, { isListed: true });
    res.status(STATUSCODES.OK).json({
      success: true,
      message: MESSAGES.PRODUCT.UNBLOCKED,
    });
  } catch (error) {
    console.log("Error unblocking product:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: MESSAGES.GENERAL.SERVER_ERROR,
    });
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
