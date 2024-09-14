const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
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

// products display
router.get('/products', userController.loadProducts);
router.get('/product_page/:id', userController.loadProductPage);

module.exports = router;