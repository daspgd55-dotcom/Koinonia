// Only transform versioned, unsigned Cloudinary uploads. Other providers remain untouched.
export function imageUrl(url,width){
 if(typeof url!=='string'||!Number.isFinite(width))return url;
 try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='res.cloudinary.com'||!/^\/[^/]+\/image\/upload\/v\d+\//.test(u.pathname))return url;u.pathname=u.pathname.replace('/image/upload/',`/image/upload/c_limit,w_${Math.max(80,Math.min(1600,Math.round(width)))},q_auto,f_auto/`);return u.href;}catch{return url;}
}
export function imageProps(url,width=800,sizes='100vw'){
 const src=imageUrl(url,width);return src===url?{src}:{src,srcSet:[320,640,960,1280,1600].map(w=>`${imageUrl(url,w)} ${w}w`).join(', '),sizes};
}
