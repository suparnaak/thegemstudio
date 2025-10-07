const Category = require("../../models/categorySchema");
const Product = require("../../models/productsSchema");
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")
// List categories
const listCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const categories = await Category.find(query)
    .sort({ createdOn: -1 }) 
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(query);
    const totalPages = Math.ceil(totalCategories / limit);

    res.render("categories-list", {
      categories,
      currentPage: page,
      totalPages,
      search, 
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
const isValidCategoryName = (name) => /^[a-zA-Z0-9 ]+$/.test(name);
const addCategory = async (req, res) => {
  try {
    let { name, description, offer } = req.body;
    const formattedName = name.trim().toLowerCase();

    if (!isValidCategoryName(formattedName)) {
      return res.json({ error: MESSAGES.CATEGORY.INVALID });
    }

    const existingCategory = await Category.findOne({ name: formattedName });
    if (existingCategory) {
      res.json({ error: MESSAGES.CATEGORY.ALREADY_EXISTS });
    } else {
      const newCategory = new Category({
        name: name,
        description,
        offer,
      });
      await newCategory.save();
      res.json({ success: true });
    }
  } catch (error) {
    console.log("Error adding category:", error);
    res.json({ error: MESSAGES.GENERAL.SERVER_ERROR });
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
//edit category
const editCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, offer } = req.body;
    const formattedName = name.trim().toLowerCase();

    if (!isValidCategoryName(formattedName)) {
      return res.json({ error: MESSAGES.CATEGORY.INVALID });
    }

    const existingCategory = await Category.findOne({ name: formattedName });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res.json({ error: MESSAGES.CATEGORY.ALREADY_EXISTS });
    }

    await Category.findByIdAndUpdate(id, { name, description, offer });

    res.json({ success: true, message: MESSAGES.CATEGORY.UPDATED });
  } catch (error) {
    console.log("Error editing category:", error);
    res.json({ error: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

// Soft delete a category
const blockCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await Category.findByIdAndUpdate(id, { isListed: false });
    res.json({ success: true, isListed: false });

  } catch (error) {
    console.log("Error deleting category:", error);
    res.redirect("/admin/pageerror");
  }
};
// unblock a category
const unblockCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await Category.findByIdAndUpdate(id, { isListed: true });
    res.json({ success: true, isListed: true });
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
  blockCategory,
  loadEditCategory,
  unblockCategory
};
