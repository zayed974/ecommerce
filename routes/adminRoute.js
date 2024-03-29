const express = require("express");
const routeAdmin = express();
const config = require("../config/config");
const User = require("../models/userModel");
const categoryModel = require('../models/categoryModel');
const bcrypt = require("bcrypt");
const adminController = require("../controller/adminConroller");
const { trusted } = require("mongoose");
const auth = require("../middleware/auth");
const Product=require("../models/productModel")
const sharp = require('sharp');
const multer=require('../middleware/multer')
const productController=require("../controller/productController")
const orderModel=require('../models/orderModal')
const couponModel=require('../models/couponModel')
const couponController = require('../controller/couponController')
const offerController = require('../controller/offerController')

routeAdmin.set("view engine", "ejs");
routeAdmin.set("views", "./views/admin");

routeAdmin.get("/",auth.isAdminLogout,adminController.adminLogin);

routeAdmin.patch('/blockusers/:id',adminController.blockUser)

routeAdmin.get("/users",auth.isAdminLogin,adminController.loadUser);

routeAdmin.get("/dashboard",auth.isAdminLogin,adminController.loadDashboard);

routeAdmin.post("/",auth.isAdminLogout,adminController.loadSignin);

routeAdmin.get('/category',auth.isAdminLogin,adminController.loadCategory);

routeAdmin.get('/addcategory',auth.isAdminLogin,adminController.addCategory)

routeAdmin.post('/addcategory',auth.isAdminLogin,adminController.addCategoryPost)

routeAdmin.get('/editcategory',auth.isAdminLogin,adminController.editCategory)

routeAdmin.post('/editcategory',auth.isAdminLogin,adminController.editCategoryPost)

routeAdmin.patch('/blockcategory/:id',adminController.blockCategory)

routeAdmin.get('/products',auth.isAdminLogin,productController.getProduct)

routeAdmin.get('/addproducts',auth.isAdminLogin,productController.addProducts)

routeAdmin.post('/addproducts',multer.uploadproduct,productController.addProductsPost)

routeAdmin.get('/editproducts',auth.isAdminLogin,productController.editProducts)

routeAdmin.post('/editproducts',multer.uploadproduct,productController.editProductsPost)

routeAdmin.patch('/blockproducts/:id',productController.blockProducts)

routeAdmin.get('/orders',adminController.showOrders)

routeAdmin.get('/coupon', couponController.coupon)

routeAdmin.get('/addcoupon',couponController.addCoupon)

routeAdmin.post('/addcoupon',couponController.addCouponPost)

routeAdmin.get('/offer', offerController.offer)

routeAdmin.get('/addoffer',offerController.addOffer)

routeAdmin.post('/addoffer',offerController.addOfferPost)

routeAdmin.patch('/deleteoffer',offerController.deleteOffer)

routeAdmin.patch('/deletecoupon',couponController.deleteCoupon)

 routeAdmin.post('/updatestatus',adminController.updateStatus)

 routeAdmin.get('/showorder', adminController.detailOrder)

 routeAdmin.patch('/applyoffer',offerController.applyOffer)

 routeAdmin.patch('/removeoffer',offerController.removeOffer)

 routeAdmin.patch('/applycategoryoffer',offerController.applyCategoryOffer)

 routeAdmin.patch('/removecategoryoffer',offerController.removeCategoryOffer)

module.exports = routeAdmin;
