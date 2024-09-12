const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const passport = require('../config/passport');
const { userAuth } = require("../middlewares/auth");



router.get('/pageNotFound',userController.pageNotFound)


router.get('/',userController.loadHomepage);

//signup
router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup);
router.post('/verify_otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)


//google auth routes
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));

router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/signup' }), 
    userController.googleCallback
);


//login and logout
router.get('/login',userController.loadLogin);
router.post('/login',userController.login);
router.get('/logout',userController.logout); 

//products display
router.get('/products',userController.loadProducts);
router.get('/product_page/:id',userController.loadProductPage);



module.exports = router;