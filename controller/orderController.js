const express = require("express");
const config = require("../config/config");
const User = require("../models/userModel");
const categoryModel = require('../models/categoryModel');
const bcrypt = require("bcrypt");
const adminController = require("../controller/adminConroller");
const auth = require("../middleware/auth");
const Product=require("../models/productModel")
const sharp = require('sharp');
const multer=require('../middleware/multer')
const productController=require("../controller/productController")
const session = require("express-session");
const userController = require("../controller/userController");
const cartModel=require('../models/cartModel')
const addressModel=require('../models/addressModel')
const cartController=require('../controller/cartController')
const orderModel=require('../models/orderModal')
const Razorpay = require('razorpay');
const dotenv = require('dotenv')
dotenv.config()
const crypto = require('crypto')
const couponModel = require('../models/couponModel')

const razorpay = new Razorpay({
  key_id:process.env.KEY_ID,
  key_secret: process.env.KEY_SECRET,
});


const checkout = async (req, res) => {
  try {
      const wallet = await User.findById(req.session.user_id);
      const cartData = await cartModel.findOne({ user: req.session.user_id }).populate({path: 'product.productId',model: 'Product'}).populate('couponDiscount');
      const currentDate = new Date();
    
      const address = await addressModel.findOne({ user: req.session.user_id });
      const total = cartData.product.reduce((acc, val) => acc + val.totalPrice, 0);
      const coupons = await couponModel.find({expiryDate: { $gte: currentDate },is_blocked: false});  
      const subtotal = total + cartData.shippingAmount;

      const couponDiscount = cartData.couponDiscount ? cartData.couponDiscount.discountAmount : 0;
      const discountAmount = subtotal - couponDiscount;
      

      console.log(discountAmount, "helooooo");

      res.render('checkout', { wallet, address, cartData, subtotal, coupons, discountAmount });

  } catch (error) {
      console.log(error);
  }
}

const checkoutPost = async (req, res) => {
    try {
      console.log('helo checktttttttttttttt');
      console.log("hrloooooooo",req.body);
      const userId = req.session.user_id;
      const user=await User.findOne({_id:userId})
      let addressObject;
      const selectedAddress = req.body.selectedAddress;
      const paymentMethod = req.body.payment;
      const cartData = await cartModel.findOne({ user: userId });

      let status=paymentMethod=="Cash on delivery"?"placed":"pending"
      const orderItems = [];

      for (const product of cartData.product) {
        const { productId, quantity, price } = product;
      
        for (let i = 0; i < quantity; i++) {
          const item = {
            productId,
            quantity: 1,
            price,
            totalPrice: price,
            productStatus: status,
          };
          orderItems.push(item);
        }
      }      

      const total = orderItems.reduce((acc, item) => acc + item.totalPrice, 0);
      const totalPrice = total + cartData.shippingAmount
      console.log(totalPrice,"totalprice");
      console.log("statuesssssssss",);
  
        if (selectedAddress === undefined || selectedAddress === null) {
          const { name, address, landmark, state, city, pincode, phone, email } = req.body;
          const newAddress = { name, address, landmark, state, city, pincode, phone, email };
          
          const data = await addressModel.findOneAndUpdate(
            { user: userId },
            { $push: { address: newAddress } },
            { upsert: true, new: true }
          );
          addressObject = data.address[data.address.length - 1];
        } else {
          const userAddress = await addressModel.findOne(
            { 'address._id': selectedAddress },
            { 'address.$': 1 }
          );
          addressObject = userAddress.address[0];
        }

      console.log("productsssssss",orderItems);

      const order = new orderModel({
        user: userId,
        delivery_address: addressObject,
        payment: paymentMethod, 
        products: orderItems,
        subtotal: totalPrice,
        orderStatus: status,
        orderDate: new Date(), 
      });
    
      await order.save();
      const orderId = order._id;

      if(order.orderStatus=="placed"){
        console.log("placeeddddddddddddddd");
        for (const item of orderItems) {
          await Product.updateOne(
            { _id: item.productId },
            { $inc: { quantity: -item.quantity } }
          );
        }
        await cartData.deleteOne({ user: user._id });
        res.json({orderId,success:true})
      }else if (paymentMethod == "Wallet") {

        const data ={
          amount:-totalPrice,
          date:new Date()
        }

        await orderModel.findOneAndUpdate({_id:order._id},{$set:{orderStatus:'placed'}})
        await User.findOneAndUpdate({_id:userId},{$inc:{wallet:-totalPrice},$push:{walletHistory:data}})

        for (const item of orderItems) {
          await Product.updateOne(
            { _id: item.productId },
            { $inc: { quantity: -item.quantity } }
          );
        }
        return res.json({orderId,success:true})
        
      }else{
        var options = {
          amount: totalPrice * 100,
          currency: "INR",
          receipt: "" + orderId,
        };
        console.log('heloooooooooooo');

        razorpay.orders.create(options, function (err, order) {
          if (err) {
            console.log(err);
          }
          console.log("errorrr",order);
          res.json({success:false, order });
        });
      }
      // res.redirect(`/successpage?id=${orderId}`);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  };


  const verifypayment=async(req,res)=>{
    try {

      const id = req.session.user_id;
      const Data = req.body
      console.log(Data);
      const cartData = await cartModel.findOne({ user: id });
  
      const hmac = crypto.createHmac("sha256", process.env.KEY_SECRET);
      hmac.update(Data.razorpay_order_id + "|" + Data.razorpay_payment_id);
      const hmacValue = hmac.digest("hex");
  
      if (hmacValue == Data.razorpay_signature) {
          for (const Data of cartData.product) {
            const { productId, quantity } = Data;
            await Product.updateOne({ _id: productId }, { $inc: { quantity: -quantity } });
          }
      }
      const newOrder=await orderModel.findByIdAndUpdate(
        { _id: Data.order.receipt }, 
        { $set: { orderStatus: "placed" } }
      );

      newOrder.products.forEach((product) => {
        product.productStatus = "placed";
      });
        const orderItems=await orderModel.findByIdAndUpdate(
        { _id: newOrder._id }, 
        { $set:{ products: newOrder.products } },      
        { new: true }            
      );

      for (const item of orderItems.products) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { quantity: -item.quantity } }
        );
      }
      const orderId=await newOrder._id
  
      await cartData.deleteOne({ user: id });
      console.log("iddddddddddd"+orderId);
      res.json({orderId, success: true });
    } catch (error) {
      console.log(error.message);
    }
  }


  const successPage = async (req, res) => {
    try {
      const orderID = req.query.id;
      const orderData = await orderModel.findOne({ _id: orderID })
      res.render('successpage', { orderData })
    } catch (error) {
      console.log(error.message);
    }
  }

  const returnOrder = async (req, res) => {
    try {
        const userId=req.session.user_id
        const orderId = req.body.orderId;
        const productId = req.body.productId;
        const id = req.body.id
        const returnReason = req.body.returnReason;
        const productDetails = await Product.findById(productId).populate('categoryId');

            

        
        const orderData = await orderModel.findOneAndUpdate(
          { _id: orderId, 'products._id': id },
          {
            $push: {
              returnedProduct: {
                quantity: 1,
                productStatus: 'returned',
                returnReason: returnReason,
                productDetails: productDetails,
              },
            },
            $pull: {
              products: { _id: id },
            },
          },
          { new: true }
        );
        console.log("dtaaaaaa", orderData);

        if (orderData.products.length === 0) {
          // If it's empty, update the orderStatus
          await orderModel.findByIdAndUpdate(orderId, { orderStatus: 'returned or cancelled' });
        }


            await Product.updateOne({ _id: productId }, { $inc: { quantity: 1 } });


        const walletAmount = orderData.cancelledProduct.reduce((acc, product) => {
             const productPrice = product.productDetails.price || 0;
          
            return acc + product.quantity * productPrice;
          }, 0);
            const data = {
              amount:  walletAmount,
              date: Date.now(),
            }
            await User.findOneAndUpdate({ _id: userId }, { $inc: { wallet: walletAmount }, $push: { walletHistory: data } })

        res.json({ success: true });
    } catch (error) {
        console.log(error.message);
        res.render('500Error');
    }
};

const cancelOrder = async (req, res) => {
  try {
      const userId = req.session.user_id;
      console.log(userId);
      const orderId = req.body.orderId;
      const id = req.body.id
      const productId = req.body.productId;
      console.log(productId);
      const cancelReason = req.body.cancelReason;
      const productDetails = await Product.findById(productId).populate('categoryId');

      
  const orderData = await orderModel.findOneAndUpdate(
    { _id: orderId, 'products._id': id },
    {
      $push: {
        cancelledProduct: {
          quantity: 1,
          productStatus: 'cancelled',
          cancelReason: cancelReason,
          productDetails: productDetails,
        },
      },
      $pull: {
        products: { _id: id },
      },
    },
    { new: true }
  );

  if (orderData.products.length === 0) {
    await orderModel.findByIdAndUpdate(orderId, { orderStatus: 'returned or cancelled' });
  }
  if(orderData.payment !== 'Cash on delivery'){

      const walletAmount = orderData.cancelledProduct.reduce((acc, product) => {
      const productPrice = product.productDetails.price || 0;
            return acc + product.quantity * productPrice;
      },0); 
    
      const data = {
        amount:  walletAmount,
        date: Date.now(),
      }
      const newD = await User.findOneAndUpdate({ _id: userId }, { $inc: { wallet: walletAmount }, $push: { walletHistory: data } })

    }

      await Product.updateOne({ _id: productId }, { $inc: { quantity: 1 } });
      

      res.json({ success: true });
  } catch (error) {
      console.log(error.message);
      res.render('500Error');
  }
};
  

const detailOrder=async(req,res)=>{
  try {
    const user_id = req.session.user_id
    const order_id = req.query.id
    console.log(order_id);
    const orderData = await orderModel.findOne({_id:order_id}).populate('products.productId')
    await orderData.populate('products.productId.categoryId')
    res.render('orderdetails',{orderData,user_id})
  } catch (error) {
    console.log(error.message);
  }
}


  module.exports={
    checkout,
    checkoutPost,
    verifypayment,
    successPage,
    returnOrder,
    cancelOrder,
    detailOrder
  }