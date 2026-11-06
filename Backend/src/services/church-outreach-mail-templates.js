const {content}=require('../emails/church-outreach/content');
const {layout}=require('../emails/church-outreach/layout');
const version='institutional-mail-2';
function render({kind,stage,church,role,source,clarification,reminder,link}) {
 const selected=stage||(kind==='member'?(reminder?'member-reminder':'member'):clarification?'clarification':reminder?'institutional-reminder':'initial');
 const data={name:church.identification.name,place:[church.location?.commune,church.location?.city].filter(Boolean).join(', '),role,source,clarification,link};
 return {version,...layout(content(selected,data),data)};
}
module.exports={render,version};
