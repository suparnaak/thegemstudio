const User = require("../../models/userSchema");
const Product = require("../../models/productsSchema");
const Category = require("../../models/categorySchema");
const Review = require("../../models/reviewSchema");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
// Load home page
const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    console.log("Aftersignup user",user)
    const featuredProducts = await Product.find({ isListed: true })
      .sort({ createdOn: -1 })  
      .limit(6)
      .populate('category');  
    const productsWithFinalPrice = featuredProducts.map(product => {
      const productDiscount = product.discount || 0; 
      const categoryOffer = product.category.offer || 0; 
      const maxDiscount = Math.max(productDiscount, categoryOffer);
      const discountedPrice = product.price - (product.price * (maxDiscount / 100));
      return {
        ...product.toObject(),  
        finalPrice: discountedPrice.toFixed(2),  
        maxDiscount  
      };
    });
    res.render("home", { 
      user: user || null, 
      featuredProducts: productsWithFinalPrice 
    });
  } catch (error) {
    console.log("Home page not found:", error);
    res.status(500).send("Server Error");
  }
};
// Load signup page
const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Sign up page not found");
    res.status(500).send("Server Error");
  }
};

// OTP generation
function generateOtp() {
  return Math.random().toString().substr(2, 6);
}

// Send email OTP
async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify Your Mail",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

//signup
const signup = async (req, res) => {
  try {
    const { name, phone, email, password, cpassword } = req.body;
    if (password !== cpassword) {
      return res.render("signup", { message: "Passwords do not match" });
    }
    const findUser = await User.findOne({ email });
    if (findUser) {
      return res.render("signup", {
        message: "User already exists.Try another email",
      });
    }
    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.json("email-error");
    }
    req.session.userOtp = otp;
    req.session.userData = { name, phone, email, password };

    res.render("verify_otp");
    console.log("OTP sent", otp);
  } catch (error) {
    console.error("Sign up Error", error);
    res.redirect("/pageNotFound");
  }
};

// Secure password
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.error("Error hashing password", error);
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Received OTP:", otp);
    if (otp === req.session.userOtp) {
      const user = req.session.userData;
      const passwordHash = await securePassword(user.password);
      const saveUserData = new User({
        name: user.name,
        email: user.email,
        phone: user.phone,
        password: passwordHash,
      });
      await saveUserData.save();
      req.session.user = saveUserData;
      return res.json({ success: true, redirectUrl: "/" });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP, Please try again" });
    }
  } catch (error) {
    console.error("Error verifying OTP", error);
    return res
      .status(500)
      .json({ success: false, message: "An error occurred" });
  }
};

//resend otp
const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }
    const otp = generateOtp();
    req.session.userOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend Otp", otp);
      res
        .status(200)
        .json({ success: true, message: "OTP resend successfully" });
    } else {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to resend otp. Please try again",
        });
    }
  } catch (error) {
    console.error("Error resending otp", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal Server error.Please try again",
      });
  }
};

// Google OAuth callback logic
const googleCallback = (req, res) => {
  req.session.user = req.user;
  res.redirect("/");
};

//load login
const loadLogin = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.render("login");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    res.redirect("pageNotFound");
  }
};
//login post
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const findUser = await User.findOne({ isAdmin: 0, email: email });
    if (!findUser) {
      return res.render("login", { message: "User not found" });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: "Blocked by Admin" });
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("login", { message: "Incorrect Password" });
    }

    req.session.user = findUser;
    res.redirect("/");
  } catch (error) {
    console.error("login error", error);
    res.render("login", { message: "Login failed. Please try again later" });
  }
};

//logout
const logout = async (req, res) => {
  try {
    req.user = null;

    req.session.destroy((err) => {
      if (err) {
        console.error("Error in destroying session:", err);
        return res.status(500).send("Error logging out. Please try again.");
      }

      res.clearCookie("connect.sid");

      res.redirect("/login");
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).send("An unexpected error occurred. Please try again.");
  }
};
const loadProducts = async (req, res) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const sortOption = req.query.sort || "newest";
    const selectedCategory = req.query.category || null;
    const searchQuery = req.query.search || "";
    const itemsPerPage = 9;

    const categories = await Category.find({ isListed: true });

    // Base query for products
    const productQuery = {
      isListed: true,
      category: { $exists: true, $ne: null },
      brand: { $exists: true, $ne: null },
    };

    // Search query
    if (searchQuery) {
      productQuery.name = { $regex: new RegExp(searchQuery, "i") };
    }

    // Filter by selected category if provided
    if (selectedCategory) {
      productQuery.category = selectedCategory;
    }

    // Fetch products with populated category and brand
    let products = await Product.find(productQuery)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isListed: true },
      });

    // Filter out products with unlisted categories or brands
    products = products.filter((product) => product.category && product.brand);

    // Calculate final prices
    const productsWithFinalPrice = products.map((product) => {
      const productDiscount = product.discount || 0;
      const categoryOffer = product.category.offer || 0;
      const brandOffer = product.brand.offer || 0;

      const maxDiscount = Math.max(productDiscount, categoryOffer, brandOffer);
      const finalPrice = product.price - product.price * (maxDiscount / 100);

      return {
        ...product._doc,
        finalPrice: finalPrice.toFixed(2),
        maxDiscount,
      };
    });

    // Sort the products based on selected option
    switch (sortOption) {
      case "price-asc":
        productsWithFinalPrice.sort((a, b) => a.finalPrice - b.finalPrice);
        break;
      case "price-desc":
        productsWithFinalPrice.sort((a, b) => b.finalPrice - a.finalPrice);
        break;
      case "newest":
      default:
        productsWithFinalPrice.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        break;
    }

    // Pagination logic
    const totalProducts = productsWithFinalPrice.length;
    const paginatedProducts = productsWithFinalPrice.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    // Render the products page with pagination and other filters
    res.render("products", {
      user: user || null,
      products: paginatedProducts,
      categories: categories,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / itemsPerPage),
      sortOption: sortOption,
      selectedCategory: selectedCategory,
      searchQuery: searchQuery,
    });
  } catch (error) {
    console.log("Products page not found:", error);
    res.status(500).send("Server Error");
  }
};

/* const loadProductPage = async (req, res) => {
  try {
    const user = req.session.user;
    const productId = req.params.id;

    const product = await Product.findById(productId).populate("category").populate("brand");

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const productDiscount = product.discount || 0;
    const categoryOffer = product.category.offer || 0;
    const brandOffer = product.brand.offer || 0;
    const maxDiscount = Math.max(productDiscount, categoryOffer, brandOffer);
    const finalPrice = product.price - product.price * (maxDiscount / 100);
    
    const productWithFinalPrice = {
      ...product._doc,
      finalPrice: finalPrice.toFixed(2),
      maxDiscount,
      brandName: product.brand.name,
    };

    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
    }).limit(4);
    const reviews = await Review.find({ productId: productId }).populate("userId", "name");
    res.render("product-page", {
      user: user || null,
      product: productWithFinalPrice,
      relatedProducts,
      reviews, 
    });
  } catch (error) {
    console.log("Product page not found:", error);
    res.status(500).send("Server Error");
  }
}; */
const loadProductPage = async (req, res) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const sortOption = req.query.sort || "newest";
    const selectedCategory = req.query.category || null;
    const searchQuery = req.query.search || "";
    const itemsPerPage = 9;

    const categories = await Category.find({ isListed: true });

    // Build query object
    const productQuery = {
      isListed: true,
      category: { $exists: true, $ne: null },
      brand: { $exists: true, $ne: null },
    };

    // Add search filter (ALWAYS apply if exists)
    if (searchQuery.trim()) {
      productQuery.name = { $regex: new RegExp(searchQuery.trim(), "i") };
    }

    // Add category filter (ALWAYS apply if exists)
    if (selectedCategory && selectedCategory !== 'all') {
      productQuery.category = selectedCategory;
    }

    // Build sort object
    let sortQuery = {};
    switch (sortOption) {
      case "price-asc":
        sortQuery = { price: 1 };
        break;
      case "price-desc":
        sortQuery = { price: -1 };
        break;
      case "name-asc":
        sortQuery = { name: 1 };
        break;
      case "name-desc":
        sortQuery = { name: -1 };
        break;
      case "newest":
      default:
        sortQuery = { createdOn: -1 };
        break;
    }

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(productQuery);

    // Fetch products with filters, sorting, and pagination
    const products = await Product.find(productQuery)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isListed: true },
      })
      .sort(sortQuery)
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage);

    // Filter out products with unlisted categories or brands
    const validProducts = products.filter((product) => product.category && product.brand);

    // Calculate final prices
    const productsWithFinalPrice = validProducts.map((product) => {
      const productDiscount = product.discount || 0;
      const categoryOffer = product.category.offer || 0;
      const brandOffer = product.brand.offer || 0;

      const maxDiscount = Math.max(productDiscount, categoryOffer, brandOffer);
      const finalPrice = product.price - product.price * (maxDiscount / 100);

      return {
        ...product._doc,
        finalPrice: finalPrice.toFixed(2),
        maxDiscount,
      };
    });

    // For price sorting, we need to sort again after calculating final prices
    if (sortOption === "price-asc" || sortOption === "price-desc") {
      productsWithFinalPrice.sort((a, b) => {
        const aPrice = parseFloat(a.finalPrice);
        const bPrice = parseFloat(b.finalPrice);
        return sortOption === "price-asc" ? aPrice - bPrice : bPrice - aPrice;
      });
    }

    res.render("products", {
      user: user || null,
      products: productsWithFinalPrice,
      categories: categories,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / itemsPerPage),
      sortOption: sortOption,
      selectedCategory: selectedCategory,
      searchQuery: searchQuery,
      totalProducts: totalProducts
    });

  } catch (error) {
    console.log("Products page not found:", error);
    res.status(500).send("Server Error");
  }
};

module.exports = {
  loadHomepage,
  loadSignup,
  signup,
  verifyOtp,
  resendOtp,
  loadLogin,
  login,
  logout,
  loadProducts,
  loadProductPage,
  googleCallback,
};
