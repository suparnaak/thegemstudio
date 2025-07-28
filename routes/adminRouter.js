const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin/adminController");
const usersController = require("../controllers/admin/usersController");
const categoryController = require("../controllers/admin/categoryController");
const productController = require("../controllers/admin/productController");
const userOrderController = require("../controllers/admin/userOrderController");
const couponController = require("../controllers/admin/couponController");
const salesReportController = require("../controllers/admin/salesReportController");
const brandController = require("../controllers/admin/brandController");
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
router.post("/categories/block/:id", adminAuth,categoryController.blockCategory);
router.post("/categories/unblock/:id", adminAuth,categoryController.unblockCategory);

//brand management
router.get("/brands", adminAuth, brandController.listBrands); 
router.get("/brands/add", adminAuth, brandController.loadAddBrands); 
router.post("/brands/add", adminAuth, brandController.addBrands); 
router.post("/brands/block/:id", adminAuth,brandController.blockBrand);
router.post("/brands/unblock/:id", adminAuth,brandController.unblockBrand);
router.get("/brands/edit/:id", adminAuth,brandController.loadEditBrand); 
router.post("/brands/edit/:id", adminAuth, brandController.editBrand); 

// Product management routes
router.get("/products", adminAuth, productController.listProducts);
router.get("/products/add", adminAuth, productController.loadAddProducts);
//router.post("/products/add",  multer.array('images', 10),adminAuth, productController.addProduct); 
router.get("/products/edit/:id", adminAuth,productController.loadEditProduct); 
//router.post("/products/edit/:id", multer.array('images', 10),adminAuth, productController.editProduct);
router.post("/products/add", adminAuth, multer.array('images', 10), productController.addProduct); 
router.post("/products/edit/:id", adminAuth, multer.array('images', 10), productController.editProduct);

router.patch("/products/block/:id", adminAuth,productController.blockProduct);
router.patch('/products/unblock/:id', adminAuth,productController.unblockProduct);

//order management routes
router.get("/orders", adminAuth, userOrderController.listOrders);
router.get("/orders/:id", adminAuth, userOrderController.listOrderDetails);
router.post('/update-order-status',adminAuth, userOrderController.updateOrderStatus);

//coupons management
router.get("/coupons", adminAuth, couponController.listCoupons);
router.get("/coupons/add", adminAuth, couponController.loadAddCoupons);
router.post("/coupons/add", adminAuth, couponController.addCoupons);
router.post("/coupons/delete/:id", adminAuth,couponController.deleteCoupon);

//sales report
router.get("/sales-report", adminAuth, salesReportController.getSalesReport);
router.post("/filter-sales", adminAuth, salesReportController.filterSalesReport);
router.post("/download-report", adminAuth, salesReportController.downloadReport);

//dashboard data
router.get('/sales-data', adminAuth, adminController.getSalesData);
router.get('/payment-data', adminAuth, adminController.getPaymentData);

module.exports = router;
