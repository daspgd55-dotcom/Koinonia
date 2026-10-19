const v=require('../validation/schemas');
exports.resolve=async(req,res)=>{
 res.set('Cache-Control','no-store');
 const {address,commune}=v.parse(v.z.strictObject({address:v.z.string().trim().min(5).max(200),commune:v.z.string().trim().min(2).max(200)}),req.body);
 const data=await require('../services/address-location.service').resolveAddress(req.app.locals.config,req.user,address,commune);
 res.json({data,status:data.length?'found':'not_confirmed',attribution:'Powered by Geoapify | © OpenStreetMap contributors'});
};
