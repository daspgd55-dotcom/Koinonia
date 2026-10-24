const roles={administrator:['church','content','moderation','visits','team'],moderator:['moderation','visits'],editor:['content'],welcome:['visits']};
function subrole(c,u){if(u.role==='admin')return 'administrator';if(u.role!=='representative'||!(c.representatives||[]).some(id=>String(id)===String(u._id)))return null;return c.representativeRoles?.find(r=>String(r.user)===String(u._id))?.subrole||'administrator';}
function permissions(c,u){return roles[subrole(c,u)]||[];}
function scope(u,permission,prefix=''){if(u.role==='admin')return {};if(u.role!=='representative')return {_id:null};const eligible=Object.keys(roles).filter(r=>roles[r].includes(permission));return {$and:[{[prefix+'representatives']:u._id},{$or:[{[prefix+'representativeRoles']:{$not:{$elemMatch:{user:u._id}}}},{[prefix+'representativeRoles']:{$elemMatch:{user:u._id,subrole:{$in:eligible}}}}]}]};}
module.exports={roles,subrole,permissions,scope};
