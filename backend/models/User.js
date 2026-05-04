const mongoose=require('mongoose');
const SongSchema=new mongoose.Schema({
  songKey:{type:String,required:true},
  artist:{type:String,required:true},
  song:{type:String,required:true},
  key:{type:String,default:null},
  source:{type:String,default:null},
  coverUrl:{type:String,default:null},
  chordsCount:{type:Number,default:0},
  chords:{type:[mongoose.Schema.Types.Mixed],default:[]},
  note:{type:String,default:''},
  savedAt:{type:Date,default:Date.now},
  updatedAt:{type:Date,default:Date.now},
  playedAt:{type:Date,default:Date.now}
},{_id:false});
const UserSchema=new mongoose.Schema({
  username:{type:String,required:true,unique:true,lowercase:true,trim:true,minlength:3},
  password:{type:String,required:true},
  level:{type:Number,default:1},
  xp:{type:Number,default:0},
  score:{type:Number,default:0},
  monstersDefeated:{type:Number,default:0},
  savedSongs:{type:[SongSchema],default:[]},
  recentSongs:{type:[SongSchema],default:[]},
  createdAt:{type:Date,default:Date.now},
  updatedAt:{type:Date,default:Date.now}
});
module.exports=mongoose.model('User',UserSchema);
