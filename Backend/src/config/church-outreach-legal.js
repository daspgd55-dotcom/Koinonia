const {createHash}=require('node:crypto');
// Pending approved institutional texts. Configure {version, text} for each document;
// do not substitute examples or the old registration declarations.
const documents={terms:null,privacy:null};
function current(){const enabled=['terms','privacy'].every(k=>typeof documents[k]?.version==='string'&&documents[k].version.trim()&&typeof documents[k]?.text==='string'&&documents[k].text.trim());if(!enabled)return {enabled:false};return {enabled:true,...documents,revision:createHash('sha256').update(JSON.stringify(documents)).digest('hex')};}
module.exports={current};
