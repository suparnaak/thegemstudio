const Coupon = require("../../models/couponSchema");
const crypto = require("crypto");

//list coupons
const listCoupons = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    const query = {
      is_deleted: { $ne: true },
      ...(search && { code: { $regex: search, $options: "i" } }),
    };

    const coupons = await Coupon.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const coupon of coupons) {
      const startDate = new Date(coupon.start_date);
      const endDate = new Date(coupon.end_date);

      let newStatus;
      if (
        startDate <= today &&
        endDate >= today &&
        coupon.used_count < coupon.usage_limit
      ) {
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

    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit);

    res.render("coupons-list", {
      coupons,
      currentPage: page,
      totalPages,
      search,
    });
  } catch (error) {
    console.log("Error listing coupons", error);
    res.redirect("/admin/pageerror");
  }
};


//add coupons
const loadAddCoupons = async (req, res) => {
  try {
    const couponCode = generateCouponCode();
    res.render("coupon-add", { couponCode });
  } catch (error) {
    console.log("Error rendering add category page:", error);
    res.redirect("/admin/pageerror");
  }
};

//generate coupon code
function generateCouponCode() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return code;
}
//add coupons
const addCoupons = async (req, res) => {
  try {
    const {
      code,
      min_order_price,
      discount_rs,
      start_date,
      end_date,
      description,
      usage_limit,
    } = req.body;

    if (!code.trim()) {
      return res
        .status(400)
        .json({ message: "Coupon code cannot be empty or spaces only" });
    }
    if (min_order_price <= 0 || discount_rs <= 0 || usage_limit <= 0) {
      return res.status(400).json({
        message: "Price, discount, and usage limit must be positive values",
      });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    const today = new Date();

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      return res
        .status(400)
        .json({ message: "Start date should not be before today" });
    }
    if (endDate < today || endDate < startDate) {
      return res.status(400).json({
        message: "End date should not be before today or the start date",
      });
    }

    const existingCoupon = await Coupon.findOne({ code });
    if (existingCoupon) {
      return res.status(400).json({ message: "Coupon code already exists" });
    }

    const newCoupon = new Coupon({
      code,
      min_order_price,
      discount_rs,
      start_date: startDate,
      end_date: endDate,
      description,
      usage_limit,
      status: startDate <= today ? "active" : "inactive",
    });

    await newCoupon.save();

    res.json({
      success: true,
      message: "Coupon added successfully",
      coupon: newCoupon,
    });
  } catch (error) {
    console.error("Error adding coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add coupon",
      error: error.message,
    });
  }
};

//delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        is_deleted: true,
        status: "deleted",
      },
      { new: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    res.json({ success: true, message: "Coupon deleted successfully" });
  } catch (err) {
    console.error("Error in deleteCoupon:", err);
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting the coupon",
    });
  }
};

module.exports = {
  listCoupons,
  loadAddCoupons,
  addCoupons,
  deleteCoupon,
};
