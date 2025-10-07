const User = require("../../models/userSchema");
const Product = require("../../models/productsSchema");
const Category = require("../../models/categorySchema");
const Review = require("../../models/reviewSchema");
const MESSAGES=require("../../utilities/messages");
const STATUSCODES=require("../../utilities/statusCodes")
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const env = require("dotenv").config();
// Load home page
const loadHomepage = async (req, res) => {
  try {
    const user = req.session.user;
    
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
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
  }
};
// Load signup page
const loadSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.log("Sign up page not found");
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
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
        .status(STATUSCODES.BAD_REQUEST)
        .json({ success: false, message: MESSAGES.AUTH.INVALID_OTP });
    }
  } catch (error) {
    console.error("Error verifying OTP", error);
    return res
      .status(STATUSCODES.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

//resend otp
const resendOtp = async (req, res) => {
  try {
    const { email } = req.session.userData;
    if (!email) {
      return res
        .status(STATUSCODES.BAD_REQUEST)
        .json({ success: false, message: MESSAGES.AUTH.NO_EMAIL });
    }
    const otp = generateOtp();
    req.session.userOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if (emailSent) {
      console.log("Resend Otp", otp);
      res
        .status(STATUSCODES.OK)
        .json({ success: true, message: MESSAGES.AUTH.OTP_SEND});
    } else {
      res
        .status(STATUSCODES.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          message:MESSAGES.GENERAL.SERVER_ERROR,
        });
    }
  } catch (error) {
    console.error("Error resending otp", error);
    res
      .status(STATUSCODES.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: MESSAGES.GENERAL.SERVER_ERROR,
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
      return res.render("login", { message: MESSAGES.AUTH.NO_USER });
    }
    if (findUser.isBlocked) {
      return res.render("login", { message: MESSAGES.AUTH.BLOCKED });
    }
    const passwordMatch = await bcrypt.compare(password, findUser.password);
    if (!passwordMatch) {
      return res.render("login", { message: MESSAGES.AUTH.INVALID_CREDENTIALS });
    }

    req.session.user = findUser;
    res.redirect("/");
  } catch (error) {
    console.error("login error", error);
    res.render("login", { message: MESSAGES.GENERAL.SERVER_ERROR });
  }
};

//logout
const logout = async (req, res) => {
  try {
    req.user = null;

    req.session.destroy((err) => {
      if (err) {
        console.error("Error in destroying session:", err);
        return res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
      }

      res.clearCookie("connect.sid");

      res.redirect("/login");
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
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

    const productQuery = {
      isListed: true,
      category: { $exists: true, $ne: null },
      brand: { $exists: true, $ne: null },
    };

    if (searchQuery) {
      productQuery.name = { $regex: new RegExp(searchQuery, "i") };
    }

    if (selectedCategory) {
      productQuery.category = selectedCategory;
    }

    let products = await Product.find(productQuery)
      .populate({
        path: "category",
        match: { isListed: true },
      })
      .populate({
        path: "brand",
        match: { isListed: true },
      });

    products = products.filter((product) => product.category && product.brand);

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

    const totalProducts = productsWithFinalPrice.length;
    const paginatedProducts = productsWithFinalPrice.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
  }
};

const loadProductPage = async (req, res) => {
  try {
    const user = req.session.user;
    const productId = req.params.id;

    const product = await Product.findById(productId).populate("category").populate("brand");

    if (!product) {
      return res.status(STATUSCODES.NOT_FOUND).send(MESSAGES.GENERAL.SERVER_ERROR);
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
    res.status(STATUSCODES.INTERNAL_SERVER_ERROR).send(MESSAGES.GENERAL.SERVER_ERROR);
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
