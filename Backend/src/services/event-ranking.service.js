const Follow=require('../models/church-follow.model'),View=require('../models/event-view.model'),Participation=require('../models/event-participation.model');
// Lexicographic priorities: later signals never outweigh an earlier one.
function stages(user,now){return [
 {$lookup:{from:Follow.collection.name,let:{church:'$churchId'},pipeline:[{$match:{$expr:{$and:[{$eq:['$church','$$church']},{$eq:['$active',true]}]}}},{$group:{_id:null,total:{$sum:1},followed:{$max:{$cond:[{$eq:['$user',user?._id||null]},1,0]}}}}],as:'rankFollow'}},
 {$lookup:{from:View.collection.name,localField:'_id',foreignField:'event',pipeline:[{$count:'total'}],as:'rankViews'}},
 {$lookup:{from:Participation.collection.name,let:{event:'$_id'},pipeline:[{$match:{$expr:{$and:[{$eq:['$event','$$event']},{$in:['$status',['interested','both']]}]}}},{$count:'total'}],as:'rankInterest'}},
 {$set:{rankPhase:{$cond:[{$lte:['$effectiveEndsAt',now]},2,{$cond:[{$eq:['$eventStatus','cancelled']},1,0]}]},rankOwn:{$cond:[{$eq:['$churchId',user?.membershipChurch||null]},1,0]},rankFollowed:{$ifNull:[{$arrayElemAt:['$rankFollow.followed',0]},0]},rankFollowers:{$ifNull:[{$arrayElemAt:['$rankFollow.total',0]},0]},rankViewCount:{$ifNull:[{$arrayElemAt:['$rankViews.total',0]},0]},rankInterested:{$ifNull:[{$arrayElemAt:['$rankInterest.total',0]},0]}}},
 {$sort:{rankPhase:1,rankOwn:-1,rankFollowed:-1,rankFollowers:-1,rankViewCount:-1,rankInterested:-1,startsAt:1,_id:1}}
 ];}
module.exports={stages};
