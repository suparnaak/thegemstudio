const Brand = require("../../models/brandSchema");
// List categories
const listBrands = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    // Fetch all brands without checking for isListed field
    const brands = await Brand.find({})
      .skip(skip)
      .limit(limit);
    
    const totalBrands = await Brand.countDocuments({});
    const totalPages = Math.ceil(totalBrands / limit);

    // Render the brands-list view with the brand data
    res.render("brands-list", {
      brands,  // Changed from categories to brands
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.log("Error listing Brands:", error);
    res.redirect("/admin/pageerror");
  }
};

// load add category
const loadAddBrands = async (req, res) => {
  try {
    res.render("brand-add", { title: "Add New Brands" });
  } catch (error) {
    console.log("Error rendering add category page:", error);
    res.redirect("/admin/pageerror");
  }
};

const addBrands = async (req, res) => {
  try {
    const { brandName, description } = req.body;

    if (!brandName || !description) {
      return res.status(400).json({ error: "Brand name and description are required." });
    }

    const existingBrand = await Brand.findOne({ brandName: { $regex: `^${brandName.trim()}$`, $options: 'i' } });
    if (existingBrand) {
      return res.status(400).json({ error: "Brand with this name already exists." });
    }

    const newBrand = new Brand({
      brandName: brandName.trim(),
      description: description.trim(),
    });

    await newBrand.save();

    res.status(201).json({ message: "Brand added successfully!" });
  } catch (error) {
    console.error("Error adding brand:", error);
    res.status(500).json({ error: "An error occurred while adding the brand." });
  }
};

// Soft delete a brand
const blockBrand = async (req, res) => {
  try {
    const { id } = req.params;
    await Brand.findByIdAndUpdate(id, { isListed: false });
   
    res.redirect("/admin/brands");
  } catch (error) {
    console.log("Error deleting Brands:", error);
    res.redirect("/admin/pageerror");
  }
};
// unblock a brand 
const unblockBrand = async (req, res) => {
  try {
    const { id } = req.params;
    await Brand.findByIdAndUpdate(id, { isListed: true });
   
    res.redirect("/admin/brands");
  } catch (error) {
    console.log("Error deleting Brands:", error);
    res.redirect("/admin/pageerror");
  }
};

//load edit brands
const loadEditBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findById(id);
    res.render("brand-edit", { brand });
  } catch (error) {
    console.log("Error rendering edit brand page:", error);
    res.redirect("/admin/pageerror");
  }
};
const editBrand = async(req,res)=> {
try {
  const brandId = req.params.id; // Get brand ID from URL
  const { brandName, description } = req.body; // Get updated brand data from form

  // Check if the brand name already exists (excluding the current brand being edited)
  const existingBrand = await Brand.findOne({
    brandName: brandName,
    _id: { $ne: brandId }, // Exclude the current brand
  });

  if (existingBrand) {
    return res.json({ error: "Brand name already exists. Please choose a different name." });
  }

  // Update the brand
  const updatedBrand = await Brand.findByIdAndUpdate(
    brandId,
    { brandName, description },
    { new: true } // Return the updated brand
  );

  if (!updatedBrand) {
    return res.status(404).json({ error: "Brand not found" });
  }

  // Redirect to the brand list page after successful update
  res.json({ success: true });
} catch (error) {
  console.error("Error editing brand:", error);
  res.status(500).json({ error: "An error occurred while editing the brand" });
}
};


 module.exports = {
  listBrands,
  loadAddBrands,
  addBrands,
  blockBrand,
  unblockBrand,
  loadEditBrand,
  editBrand
 }