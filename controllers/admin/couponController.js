const Coupon = require("../../models/couponSchema");
const crypto = require('crypto');

// List coupons with pagination
// List coupons with pagination and automatic status update
const listCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    // Fetch all coupons for pagination
    const coupons = await Coupon.find({ is_deleted: { $ne: true } }).skip(skip).limit(limit);

    // Get today's date without the time component (midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Iterate through each coupon and update its status based on the current date and usage count
    for (const coupon of coupons) {
      if (coupon.is_deleted) continue; // Skip deleted coupons

      const startDate = new Date(coupon.start_date);
      const endDate = new Date(coupon.end_date);

      let newStatus;
      if (startDate <= today && endDate >= today && coupon.used_count < coupon.usage_limit) {
        newStatus = "active";
      } else if (today < startDate) {
        newStatus = "inactive";
      } else if (today > endDate || coupon.used_count >= coupon.usage_limit) {
        newStatus = "expired";
      }

      if (newStatus && coupon.status !== newStatus) {
        coupon.status = newStatus;
        await coupon.save();
      }
    }

    // Get the total number of non-deleted coupons for pagination
    const totalCoupons = await Coupon.countDocuments({ is_deleted: { $ne: true } });
    const totalPages = Math.ceil(totalCoupons / limit);

    // Render the coupons list
    res.render("coupons-list", {
      coupons,
      currentPage: page,
      totalPages,
    });

  } catch (error) {
    console.log("Error listing coupons", error);
    res.redirect("/admin/pageerror");
  }
};


//add coupons
const loadAddCoupons = async (req, res) => {
  try {
    const couponCode = generateCouponCode(); // Generate a random coupon code
    res.render("coupon-add", { couponCode }); // Pass the coupon code to the frontend
  } catch (error) {
    console.log("Error rendering add category page:", error);
    res.redirect("/admin/pageerror");
  }
};

// Function to generate a random coupon code with 6 characters
function generateCouponCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return code;
}
const addCoupons = async (req, res) => {
  try {
    // Log incoming request data
    console.log("Request body:", req.body);

    const { code, min_order_price, discount_rs, start_date, end_date, description, usage_limit } = req.body;

    // Basic server-side validation
    if (!code.trim()) {
      return res.status(400).json({ message: 'Coupon code cannot be empty or spaces only' });
    }
    if (min_order_price <= 0 || discount_rs <= 0 || usage_limit <= 0) {
      return res.status(400).json({ message: 'Price, discount, and usage limit must be positive values' });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const today = new Date();

    // Reset all dates to midnight for consistent comparison
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    // Date validation
    if (startDate < today) {
      return res.status(400).json({ message: 'Start date should not be before today' });
    }
    if (endDate < today || endDate < startDate) {
      return res.status(400).json({ message: 'End date should not be before today or the start date' });
    }

    // Check if the coupon code already exists
    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }

    // Create new coupon object
    const newCoupon = new Coupon({
      code,
      min_order_price,
      discount_rs,  // Make sure this matches the schema
      start_date: startDate,
      end_date: endDate,
      description,
      usage_limit,
      status: startDate <= today ? "active" : "inactive"  // Set status based on start date
    });

    // Log coupon data before saving
    console.log("New coupon to be saved:", newCoupon);

    // Save coupon to the database
    await newCoupon.save();

    res.json({ success: true, message: 'Coupon added successfully', coupon: newCoupon });
  } catch (error) {
    console.error("Error adding coupon:", error);
    res.status(500).json({ success: false, message: 'Failed to add coupon', error: error.message });
  }
};

//delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    console.log(`Attempting to delete coupon with ID: ${couponId}`);

    // Update the coupon to mark it as deleted
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      { 
        is_deleted: true,
        status: 'deleted'
      },
      { new: true }
    );

    if (!updatedCoupon) {
      console.log(`No coupon found with ID: ${couponId}`);
      return res.status(404).json({ message: 'Coupon not found' });
    }

    console.log('Updated coupon:', updatedCoupon);

    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Error in deleteCoupon:', err);
    res.status(500).json({ message: 'An error occurred while deleting the coupon', error: err.message });
  }
};
module.exports = {
  listCoupons,
  loadAddCoupons,
  addCoupons,
  deleteCoupon
}