// Only replaces obsolete TTL definitions; never removes records or business indexes.
async function prepare(){
 const models=[require('../models/security-limit.model'),require('../models/abuse-counter.model'),require('../models/captcha-use.model'),require('../models/mail-job.model')];
 for(const model of models){
  await model.createCollection();const indexes=await model.collection.indexes();
  for(const index of indexes){const oldExpiry=index.expireAfterSeconds!==undefined&&Object.keys(index.key).length===1&&index.key.expiresAt===1,unsafeJob=model.modelName==='MailJob'&&index.key.purgeAt===1&&index.expireAfterSeconds!==undefined&&JSON.stringify(index.partialFilterExpression)!==JSON.stringify({state:{$in:['accepted','failed','obsolete']}});
   if(oldExpiry||unsafeJob)try{await model.collection.dropIndex(index.name);}catch(e){if(e.code!==27)throw e;}
  }
  for(const [keys,options] of model.schema.indexes())await model.collection.createIndex(keys,options);
 }
}
module.exports={prepare};
