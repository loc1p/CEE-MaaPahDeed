const mongoose=require('mongoose');
const UserSchema=new mongoose.Schema({
  username:{type:String,required:true,unique:true,lowercase:true,trim:true,minlength:3},
  password:{type:String,required:true},
  level:{type:Number,default:1},
  xp:{type:Number,default:0},
  score:{type:Number,default:0},
  monstersDefeated:{type:Number,default:0},
  createdAt:{type:Date,default:Date.now},
  updatedAt:{type:Date,default:Date.now}
});
module.exports=mongoose.model('User',UserSchema);
