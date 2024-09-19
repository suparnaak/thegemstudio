const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const cartController = require('../controllers/user/cartController');
const userProfileController = require('../controllers/user/userProfileController')
const passport = require('../config/passport');
const { userAuth,isLoggedIn } = require("../middlewares/auth");

router.get('/pageNotFound', userController.pageNotFound)

router.get('/', userController.loadHomepage);

// signup
router.get('/signup', isLoggedIn,userController.loadSignup);
router.post('/signup',isLoggedIn, userController.signup);
router.post('/verify_otp',isLoggedIn, userController.verifyOtp);
router.post('/resend-otp',isLoggedIn, userController.resendOtp);

// google auth routes
router.get('/auth/google',  isLoggedIn,passport.authenticate('google', {scope: ['profile', 'email']}));
router.get('/auth/google/callback', 
    
    passport.authenticate('google', { failureRedirect: '/signup' }), 
    isLoggedIn,userController.googleCallback
);

// login and logout
router.get('/login',  isLoggedIn,userController.loadLogin);
router.post('/login', isLoggedIn, userController.login);
router.get('/logout', userAuth, userController.logout); 

//forgot and reset password
router.get('/forgot-password',userProfileController.loadForgotPassword);
router.post('/forgot-password',userProfileController.forgotPassword)
router.post('/verify_otp_forgotpassword', userProfileController.verifyOtp);
router.post('/forgotpassword-resend-otp',userProfileController.resendOtp);
router.get('/reset-password',userProfileController.loadResetPassword);
router.post('/reset-password',userProfileController.resetPassword);

// products display
router.get('/products', userController.loadProducts);
router.get('/product_page/:id', userController.loadProductPage);

//cart management
router.post('/cart/add', userAuth, cartController.addToCart);
router.get('/cart', userAuth, cartController.loadCart); 
router.post('/cart/update', userAuth, cartController.updateCartItem);
router.post('/cart/remove', userAuth, cartController.removeFromCart);
module.exports = router;