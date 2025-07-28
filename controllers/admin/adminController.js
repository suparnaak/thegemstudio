const User = require("../../models/userSchema");
const Product = require("../../models/productsSchema");
const Category = require("../../models/categorySchema");
const Brand = require("../../models/brandSchema");
const Order = require("../../models/orderSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

//page error
const pageerror = async (req, res) => {
  const admin = req.session.admin;
  res.render("admin-error", { admin: admin || null });
};

//load login
const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("admin-login", { message: null });
};
//login post
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });

    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect("/admin/dashboard");
      } else {
        return res.render("admin-login", {
          message: "Invalid email or password",
        });
      }
    } else {
      return res.render("admin-login", { message: "Admin not found" });
    }
  } catch (error) {
    console.log("login error", error);
    return res.redirect("/admin/pageerror");
  }
};

//load dashboard
const loadDashboard = async (req, res) => {
  if (req.session.admin) {
    try {
      const topCategories = await Category.aggregate([
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "category",
            as: "products",
          },
        },
        { $project: { name: 1, salesCount: { $size: "$products" } } },
        { $sort: { salesCount: -1 } },
        { $limit: 10 },
      ]);

      const topProducts = await Product.find()
        .sort({ salesCount: -1 })
        .limit(10);

      const topBrands = await Order.aggregate([
        { $unwind: "$items" }, 
        {
          $lookup: {
            from: "products", 
            localField: "items.productId", 
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" }, 
        {
          $lookup: {
            from: "brands", 
            localField: "productDetails.brand", 
            foreignField: "_id",
            as: "brandDetails",
          },
        },
        { $unwind: "$brandDetails" }, 
        {
          $group: {
            _id: "$brandDetails._id", 
            brandName: { $first: "$brandDetails.brandName" }, 
            salesCount: { $sum: 1 }, 
          },
        },
        { $sort: { salesCount: -1 } }, 
        { $limit: 10 }, 
      ]);

      const categorySales = await Order.aggregate([
        { $unwind: "$items" }, 
        {
          $lookup: {
            from: "products", 
            localField: "items.productId", 
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" }, 
        {
          $lookup: {
            from: "categories", 
            localField: "productDetails.category", 
            foreignField: "_id",
            as: "categoryDetails",
          },
        },
        { $unwind: "$categoryDetails" }, 
        {
          $group: {
            _id: "$categoryDetails.name", 
            totalSales: { $sum: "$items.quantity" }, 
          },
        },
        { $sort: { totalSales: -1 } }, 
      ]);

      const paymentMethods = await Order.aggregate([
        { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
        { $project: { method: "$_id", count: 1, _id: 0 } },
      ]);
       res.render("dashboard", {
        topCategories,
        topProducts,
        topBrands,
        categorySales,
        paymentMethods,
      });
    } catch (error) {
      console.error("Error loading dashboard:", error);
      res.redirect("/pageerror");
    }
  } else {
    res.redirect("/admin/login");
  }
};

const getSalesData = async (req, res) => {
  try {
    const filter = req.query.filter || "today";
    let dateFilter = {};

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    switch (filter) {
      case "today":
        dateFilter = { createdAt: { $gte: startOfDay } };
        break;
      case "week":
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = { createdAt: { $gte: startOfWeek } };
        break;
      case "monthly":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { createdAt: { $gte: startOfMonth } };
        break;
      case "yearly":
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateFilter = { createdAt: { $gte: startOfYear } };
        break;
      default:
        dateFilter = {};
    }

    const categorySales = await Order.aggregate([
      { $match: dateFilter },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "categories",
          localField: "productDetails.category",
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $group: {
          _id: "$categoryDetails.name",
          totalSales: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    res.json(categorySales);
  } catch (error) {
    console.error("Error in getSalesData:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getPaymentData = async (req, res) => {
  try {
    const filter = req.query.filter || "today";
    let dateFilter = {};

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    switch (filter) {
      case "today":
        dateFilter = { createdAt: { $gte: startOfDay } };
        break;
      case "week":
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = { createdAt: { $gte: startOfWeek } };
        break;
      case "monthly":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { createdAt: { $gte: startOfMonth } };
        break;
      case "yearly":
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateFilter = { createdAt: { $gte: startOfYear } };
        break;
      default:
        dateFilter = {};
    }

    const paymentMethods = await Order.aggregate([
      { $match: dateFilter },
      { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
      { $project: { method: "$_id", count: 1, _id: 0 } },
    ]);

    res.json(paymentMethods);
  } catch (error) {
    console.error("Error in getPaymentData:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

//logout
const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error distryoing the session");
        return res.redirect("/pageerror");
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log("Error during logout", error);
    res.redirect("/pageerror");
  }
};

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
  getSalesData,
  getPaymentData,
};
