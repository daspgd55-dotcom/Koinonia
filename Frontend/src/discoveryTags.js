const normalize=v=>String(v).trim().toLocaleLowerCase('es');
// Match within the same field, using the recommender's exact, case-insensitive comparison.
export function discoveryTags(church,user,limit=4){
 const fields=['activities','ministries'],groups=fields.map(field=>{const wanted=user?.criterionModes?.[field]==='disabled'?[]:user?.preferences?.[field]||[];return (church.community?.[field]||[]).map(text=>({text,field,matched:wanted.some(v=>normalize(v)===normalize(text))}));}),items=[];
 for(let i=0;i<Math.max(...groups.map(g=>g.length));i++)for(const group of groups)if(group[i])items.push(group[i]);
 if(!items.length)items.push(...(church.meetingTypes||[]).map(text=>({text,field:'meetings',matched:false})));
 const unique=new Map();for(const item of items.sort((a,b)=>Number(b.matched)-Number(a.matched))){const key=normalize(item.text);if(key&&!unique.has(key))unique.set(key,item);}
 return [...unique.values()].slice(0,limit);
}
