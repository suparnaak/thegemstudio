const Category = require("../../models/categorySchema");
const Product = require("../../models/productsSchema");

// List categories
const listCategories = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
    const categories = await Category.find({ isListed: true }).skip(skip).limit(limit);
    const totalCategories = await Category.countDocuments({ isListed: true });
    const totalPages = Math.ceil(totalCategories / limit);
    res.render("categories-list", { categories,
      currentPage: page,
      totalPages,
     });
  } catch (error) {
    console.log("Error listing categories:", error);
    res.redirect("/admin/pageerror");
  }
};

// load add category
const loadAddCategory = async (req, res) => {
  try {
    res.render("category-add", { title: "Add New Category" });
  } catch (error) {
    console.log("Error rendering add category page:", error);
    res.redirect("/admin/pageerror");
  }
};

// Add a new category
const isValidCategoryName = (name) => /^[a-zA-Z0-9 ]+$/.test(name);

const addCategory = async (req, res) => {
  try {
    let { name, description, offer } = req.body;
    const formattedName = name.trim().toLowerCase();

    
    if (!isValidCategoryName(formattedName)) {
      return res.json({ error: "Invalid Category Name." });
    }

    const existingCategory = await Category.findOne({ name: formattedName });
    if (existingCategory) {
      res.json({ error: "Category name already exists" });
    } else {
      const newCategory = new Category({
        name: formattedName,
        description,
        offer
      });
      await newCategory.save();
      res.json({ success: true });
    }
  } catch (error) {
    console.log("Error adding category:", error);
    res.json({ error: "Error adding category" });
  }
};

//load edit category
const loadEditCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    res.render("category-edit", { category });
  } catch (error) {
    console.log("Error rendering edit category page:", error);
    res.redirect("/admin/pageerror");
  }
};

// Edit a category
/* const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, offer } = req.body;
    await Category.findByIdAndUpdate(id, { name, description, offer });
    res.redirect("/admin/categories");
  } catch (error) {
    console.log("Error editing category:", error);
    res.redirect("/admin/pageerror");
  }
}; */
 
const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, offer } = req.body;
    const formattedName = name.trim().toLowerCase();

    if (!isValidCategoryName(formattedName)) {
      return res.json({ error: "Invalid Category Name." });
    }

    const existingCategory = await Category.findOne({ name: formattedName });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res.json({ error: "Category name already exists" });
    }

    // Update the category
    await Category.findByIdAndUpdate(id, { name, description, offer });

    // Send JSON response indicating success
    res.json({ success: true, message: "Category updated successfully" });
  } catch (error) {
    console.log("Error editing category:", error);
    res.json({ error: "Error updating category" });
  }
};

 
// Soft delete a category
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await Category.findByIdAndUpdate(id, { isListed: false });
    await Product.updateMany({ category: id }, { isListed: false });
    res.redirect("/admin/categories");
  } catch (error) {
    console.log("Error deleting category:", error);
    res.redirect("/admin/pageerror");
  }
};

module.exports = {
  loadAddCategory,
  addCategory,
  listCategories,
  editCategory,
  deleteCategory,
  loadEditCategory,
};
