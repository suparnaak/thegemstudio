const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const usersController = require("../controllers/admin/usersController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const userOrderController = require("../controllers/admin/userOrderController");
const couponController = require("../controllers/admin/couponController");
const multer = require('../helpers/multer-config');
const { adminAuth } = require("../middlewares/auth");


router.get("/pageerror", adminController.pageerror);
//admin login logout dashbaord
router.get("/login", adminController.loadLogin);
router.post("/login", adminController.login);
router.get("/logout", adminController.logout);

router.get("/dashboard", adminAuth, adminController.loadDashboard);

//user management
router.get("/users", adminAuth, usersController.listUsers); 
router.post("/users/block/:id", adminAuth, usersController.blockUser);
router.post("/users/unblock/:id", adminAuth, usersController.unblockUser); 

// Category management routes
router.get("/categories", adminAuth, categoryController.listCategories); 
router.get("/categories/add", adminAuth, categoryController.loadAddCategory); 
router.post("/categories/add", adminAuth, categoryController.addCategory); 
router.get("/categories/edit/:id", adminAuth,categoryController.loadEditCategory); 
router.post("/categories/edit/:id", adminAuth, categoryController.editCategory); 
router.post("/categories/delete/:id", adminAuth,categoryController.deleteCategory);

// Product management routes
router.get("/products", adminAuth, productController.listProducts);
router.get("/products/add", adminAuth, productController.loadAddProducts);
router.post("/products/add",  multer.array('images', 10),adminAuth, productController.addProduct); 
router.get("/products/edit/:id", adminAuth,productController.loadEditProduct); 
router.post("/products/edit/:id", multer.array('images', 10),adminAuth, productController.editProduct);
router.post("/products/block/:id", adminAuth,productController.blockProduct);
router.post('/products/unblock/:id', adminAuth,productController.unblockProduct);

//order management routes
router.get("/orders", adminAuth, userOrderController.listOrders);
router.get("/orders/:id", adminAuth, userOrderController.listOrderDetails);
router.post('/update-order-status',adminAuth, userOrderController.updateOrderStatus);

//coupons management
router.get("/coupons", adminAuth, couponController.listCoupons);
router.get("/coupons/add", adminAuth, couponController.loadAddCoupons);
router.post("/coupons/add", adminAuth, couponController.addCoupons);
router.post("/coupons/delete/:id", adminAuth,couponController.deleteCoupon);

module.exports = router;
