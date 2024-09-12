const mongoose = require('mongoose');
const {Schema} = mongoose;

const productSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true,
    },
    brand:{
        type:String,
        required:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:'Category'
    },
    price:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    quantity:{
        type:Number,
        required:true
    },
    color:{
        type:String,
        required:true
    },
    images:{
        type:[String],
        required:false
    },
    material:{
        type:String,
        required:true
    },
    status:{
        type:String,
        enum:['Available','Out of Stock'],
        default:'Available'
    },
    isListed:{
        type:Boolean,
        default:true
    },
    createdOn:{
        type: Date,
        default: Date.now
    }
})
const Product = mongoose.model('Product',productSchema)
module.exports = Product