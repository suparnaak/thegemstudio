const User = require('../../models/userSchema');
const Product = require('../../models/productsSchema');
const Category = require('../../models/categorySchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require('dotenv').config();

// Page not found
const pageNotFound = async (req, res) => {
    try {
        res.render('page-404');
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

// Load home page
const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        if (user) {
            // Directly use the user data from the session to render the homepage
            res.render("home", { user: user });
        } else {
            // If no user is in the session, render the homepage without user data
            res.render("home", { user: null });
        }
    } catch (error) {
        console.log("Home page not found:", error);
        res.status(500).send('Server Error');
    }
};




// Load signup page
const loadSignup = async (req, res) => {
    try {
        return res.render("signup");
    } catch (error) {
        console.log("Sign up page not found");
        res.status(500).send('Server Error');
    }
};

// OTP generation
function generateOtp() {
    return Math.random().toString().substr(2, 6)
}

// Send email OTP
async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify Your Mail",
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,
        });
        return info.accepted.length > 0;//array of addresses. Atleast 1 should be there
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
}

//signup
 const signup = async (req, res) => {
    try {
        const { name,phone,email, password, cpassword } = req.body;
        if (password !== cpassword) {
            return res.render('signup',{message:'Passwords do not match'});
        }
        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render('signup',{message: "User already exists.Try another email" });
        }
        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json('email-error');
        }
        req.session.userOtp = otp;
        req.session.userData = {name,phone,email, password };
        
        res.render('verify_otp');
        console.log('OTP sent',otp)
    } catch (error) {
        console.error("Sign up Error", error);
        res.redirect('/pageNotFound')
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
                password: passwordHash
            });
            await saveUserData.save();
            req.session.user = saveUserData._id;
            return res.json({ success: true, redirectUrl: '/' });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid OTP, Please try again' });
        }
    } catch (error) {
        console.error("Error verifying OTP", error);
        return res.status(500).json({ success: false, message: 'An error occurred' });
    }
};

//resend otp
const resendOtp = async (req,res)=>{
    try {
        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false, message:"Email not found in session"});
        }
        const otp = generateOtp();
        req.session.userOtp = otp;
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend Otp",otp);
            res.status(200).json({success:true,message:"OTP resend successfully"});
        }
        else{
            res.status(500).json({success:false,message:"Failed to resend otp. Please try again"});
        }
    } catch (error) {
        console.error("Error resending otp",error);
        res.status(500).json({success:false,message:"Internal Server error.Please try again"});
    }
}

// Google OAuth callback logic
const googleCallback = (req, res) => {
    req.session.user = req.user;  
    res.redirect('/'); 
};


//load login
const loadLogin = async (req,res)=>{
    try {
        if(!req.session.user){
            return res.render('login')
        }
        else{
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('pageNotFound')
    }
}
//login post
const login = async (req,res)=>{
    try {
        const {email,password} = req.body;
        const findUser = await User.findOne({isAdmin:0,email:email})
        if(!findUser){
            return res.render('login',{message:"User not found"})
        }
        if(findUser.isBlocked){
            return res.render('login',{message:"Blocked by Admin"})
        }
        const passwordMatch = await bcrypt.compare(password,findUser.password);
        if(!passwordMatch){
            return res.render('login',{message:"Incorrect Password"});
        }

        req.session.user = findUser;
        res.redirect('/');
    } catch (error) {
        console.error("login error",error);
        res.render('login',{message:"Login failed. Please try again later"});
    }
}

//logout
const logout = async (req, res) => {
    try {
      // Clear any additional data you might have set
      req.user = null;
  
      req.session.destroy((err) => {
        if (err) {
          console.error("Error in destroying session:", err);
          return res.status(500).send("Error logging out. Please try again.");
        }
        
        // Clear the session cookie
        res.clearCookie('connect.sid');
        
        // Redirect to login page
        res.redirect('/login');
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).send("An unexpected error occurred. Please try again.");
    }
  };
// Load products with pagination and category filtering
const loadProducts = async (req, res) => {
    try {
        const user = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const sortOption = req.query.sort || 'newest'; 
        const selectedCategory = req.query.category || null; 
        const itemsPerPage = 9;

        // Fetch categories that are listed
        const categories = await Category.find({ isListed: true });

        // Build the product query
        const productQuery = { isListed: true };
        if (selectedCategory) {
            productQuery.category = selectedCategory;
        }

        // Count total products
        const totalProducts = await Product.countDocuments(productQuery);

        // Define sorting criteria based on the user's selection
        let sortCriteria;
        switch (sortOption) {
            case 'price-asc':
                sortCriteria = { price: 1 }; 
                break;
            case 'price-desc':
                sortCriteria = { price: -1 }; 
                break;
            case 'newest':
                sortCriteria = { createdAt: -1 }; 
                break;
            default:
                sortCriteria = { createdAt: -1 }; 
                break;
        }

        // Fetch products with the current sorting and pagination
        const products = await Product.find(productQuery)
            .sort(sortCriteria)
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage)
            .populate('category'); // Ensure categories are populated for each product

        // Calculate the final price for each product
        const productsWithFinalPrice = products.map(product => {
            const productDiscount = product.discount || 0; // Product discount in percentage
            const categoryOffer = product.category.offer || 0; // Category offer in percentage
            
            // Use the higher discount between the product's discount and the category's offer
            const maxDiscount = Math.max(productDiscount, categoryOffer);

            // Calculate the final price by applying the discount
            const finalPrice = product.price - (product.price * (maxDiscount / 100));

            // Add the final price to the product object
            return {
                ...product._doc, // Spread product data
                finalPrice: finalPrice.toFixed(2), // Format finalPrice to 2 decimal places
                maxDiscount // You can also pass maxDiscount if needed
            };
        });

        // Render the product page
        res.render("products", {
            user: user || null,
            products: productsWithFinalPrice,
            categories: categories,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / itemsPerPage),
            sortOption: sortOption,
            selectedCategory: selectedCategory
        });
    } catch (error) {
        console.log("Products page not found:", error);
        res.status(500).send('Server Error');
    }
};

// Load product details page
const loadProductPage = async (req, res) => {
    try {
        const user = req.session.user;
        const productId = req.params.id;

        // Fetch the product by ID and populate the category to access the category offer
        const product = await Product.findById(productId).populate('category');
        
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Calculate the finalPrice based on the higher of the product discount or the category offer
        const productDiscount = product.discount || 0; // Product discount in percentage
        const categoryOffer = product.category.offer || 0; // Category offer in percentage
        
        // Use the higher discount between the product's discount and the category's offer
        const maxDiscount = Math.max(productDiscount, categoryOffer);

        // Calculate the final price by applying the higher discount
        const finalPrice = product.price - (product.price * (maxDiscount / 100));

        // Add the finalPrice to the product object
        const productWithFinalPrice = {
            ...product._doc, // Spread the product's data
            finalPrice: finalPrice.toFixed(2), // Format finalPrice to 2 decimal places
            maxDiscount // Optional: You can pass maxDiscount to the front-end as well
        };

        // Fetch related products from the same category (excluding the current product)
        const relatedProducts = await Product.find({ 
            category: product.category._id, 
            _id: { $ne: product._id } 
        }).limit(4);

        // Render the product page with or without user data
        res.render("product-page", {
            user: user || null, // User data if logged in, otherwise null
            product: productWithFinalPrice, // Send the product with the calculated finalPrice
            relatedProducts // Send related products
        });

    } catch (error) {
        console.log("Product page not found:", error);
        res.status(500).send('Server Error');
    }
};


module.exports = {
    pageNotFound,
    loadHomepage,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login ,
    logout,
    loadProducts,
    loadProductPage,
    googleCallback
       
};
