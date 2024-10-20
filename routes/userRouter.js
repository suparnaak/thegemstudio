const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const cartController = require('../controllers/user/cartController');
const userProfileController = require('../controllers/user/userProfileController')
const addressController = require('../controllers/user/addressController');
const orderController = require('../controllers/user/orderController');
const wishlistController = require('../controllers/user/wishlistController');
const walletController = require('../controllers/user/walletController');
const invoiceController = require('../controllers/user/invoiceController');
const paymentController = require('../controllers/user/paymentController');
const miscellaneousController = require('../controllers/user/miscellaneousController');
const reviewController = require('../controllers/user/reviewController');
const passport = require('../config/passport');
const { userAuth,isLoggedIn } = require("../middlewares/auth");
const { fetchCartData } = require("../middlewares/fetchCartData");

router.get('/pageNotFound', fetchCartData,miscellaneousController.pageNotFound)

router.get('/', fetchCartData,userController.loadHomepage);

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
router.get('/logout', /* userAuth, */ userController.logout); 

//forgot and reset password
router.get('/forgot-password',userProfileController.loadForgotPassword);
router.post('/forgot-password',userProfileController.forgotPassword)
router.post('/verify_otp_forgotpassword', userProfileController.verifyOtp);
router.post('/forgotpassword-resend-otp',userProfileController.resendOtp);
router.get('/reset-password',userProfileController.loadResetPassword);
router.post('/reset-password',userProfileController.resetPassword);

// products display
router.get('/products',fetchCartData, userController.loadProducts);
router.get('/product_page/:id',fetchCartData, userController.loadProductPage);

//cart management
router.post('/cart/add', userAuth,fetchCartData, cartController.addToCart);
router.get('/cart', userAuth,fetchCartData, cartController.loadCart); 
router.post('/cart/update', userAuth,fetchCartData, cartController.updateCartItem);
router.post('/cart/remove', userAuth, fetchCartData,cartController.removeFromCart);


//checkout management
//router.get('/checkout', userAuth,fetchCartData, orderController.loadCheckout);
router.post('/checkout', userAuth,fetchCartData, orderController.loadCheckout);
router.post('/add-address', userAuth,fetchCartData, addressController.addAddress);
router.post('/checkout/placeOrder', userAuth,fetchCartData, orderController.placeOrder);
router.post('/checkout/confirmOrder', userAuth,fetchCartData, orderController.confirmOrder);
router.get('/payment/verify', userAuth,fetchCartData, orderController.verifyPayment);


//account management
router.get('/account',userAuth,fetchCartData,userProfileController.loadMyAccount);
router.post('/update-profile',userAuth,fetchCartData, userProfileController.updateProfile);
router.get('/change-password',userAuth,fetchCartData,userProfileController.loadChangePassword);
router.post('/change-password',userAuth,fetchCartData,userProfileController.changePassword);
router.get('/manage-addresses',userAuth,fetchCartData,addressController.loadManageAddresses);
router.get('/manage-addresses/add-address',userAuth,fetchCartData,addressController.loadAddAddress);
router.post('/manage-addresses/add-address',userAuth,fetchCartData,addressController.addAddress);
router.get('/manage-addresses/edit-address/:addressId/',userAuth,fetchCartData,addressController.loadEditAddress);

router.post('/manage-addresses/edit-address/:addressId',userAuth,fetchCartData,addressController.editAddress);
router.delete('/manage-addresses/delete-address/:addressId',fetchCartData, addressController.deleteAddress);

router.get('/my-orders',userAuth,fetchCartData,userProfileController.loadMyOrders);
router.get('/my-orders/cancel-order/:orderId/:productId',userAuth,fetchCartData,orderController.loadCancelOrder);
router.post('/my-orders/cancel-order/:orderId/:productId',userAuth,fetchCartData,orderController.cancelOrder);
router.get('/my-orders/cancel-confirmation/:orderId/:productId', userAuth,fetchCartData, orderController.loadCancelConfirmation);
//invoice download
router.get('/my-orders/download-invoice/:orderId/:productId',userAuth,fetchCartData, invoiceController.downloadInvoice)
//review
router.get('/products/:productId/review',fetchCartData, reviewController.loadReview);
router.post('/products/:productId/review',fetchCartData, reviewController.submitReview);

// Payment retry routes
router.post('/retry-payment', userAuth, fetchCartData, paymentController.retryPayment);
router.post('/verify-retry-payment', userAuth, fetchCartData, paymentController.verifyRetryPayment);

//return order
router.get('/my-orders/return-order/:orderId/:productId',userAuth,fetchCartData,orderController.loadReturnOrder);
router.post('/my-orders/return-order/:orderId/:productId',userAuth,fetchCartData,orderController.returnOrder);
router.get('/my-orders/return-confirmation/:orderId/:productId', userAuth,fetchCartData, orderController.loadReturnConfirmation);


//wishlist management
router.post('/wishlist/add', userAuth,fetchCartData, wishlistController.addToWishlist);
router.get('/wishlist',userAuth,fetchCartData,wishlistController.loadWishlist);
router.post('/wishlist/remove', userAuth,fetchCartData, wishlistController.removeFromWishlist);
router.post('/wishlist/add-to-cart', userAuth,fetchCartData, wishlistController.addToCart);

//wallet
router.get('/wallet',userAuth,fetchCartData,walletController.loadWallet);
router.post('/add-money-to-wallet',userAuth,fetchCartData, walletController.addMoneyToWallet);
router.post('/verify-wallet-payment',userAuth,fetchCartData, walletController.verifyWalletPayment);

//miscellaneous
router.get('/aboutus', fetchCartData,miscellaneousController.loadAboutUs);
router.get('/privacy-policy', fetchCartData,miscellaneousController.loadPrivacyPolicy);
router.get('/terms-and-conditions', fetchCartData,miscellaneousController.loadTermsAndconditions);
router.get('/return-policy', fetchCartData,miscellaneousController.loadReturnPolicy);
router.get('/contact-us', fetchCartData,miscellaneousController.loadContactUs);

//router.get('*', fetchCartData, miscellaneousController.pageNotFound);

module.exports = router;