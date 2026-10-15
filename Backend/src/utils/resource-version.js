const {HttpError}=require('./errors');
function expectedVersion(req){const header=req.get('If-Match');if(header===undefined)throw new HttpError(428,'VERSION_REQUIRED','Envía la versión actual en If-Match');if(!/^"[1-9]\d*"$/.test(header)||!Number.isSafeInteger(Number(header.slice(1,-1))))throw new HttpError(400,'INVALID_VERSION','If-Match debe contener una versión entera entre comillas');return Number(header.slice(1,-1));}
module.exports={expectedVersion};
