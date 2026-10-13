export const frames={landscape:{label:'Horizontal · 3:2',ratio:1.5},wide:{label:'Panorámico · 16:9',ratio:16/9},square:{label:'Cuadrado · 1:1',ratio:1},circle:{label:'Circular · 1:1',ratio:1},portrait:{label:'Vertical · 4:5',ratio:.8}};
export const defaultFrame=category=>category==='representatives'?'circle':category==='banner'?'wide':'landscape';
export const frameStyle=m=>({aspectRatio:frames[m.frame||defaultFrame(m.category)]?.ratio||1.5,borderRadius:(m.frame||defaultFrame(m.category))==='circle'?'50%':'12px'});

export const allowedFrames=category=>category==='representatives'?['circle','square']:category==='banner'?['wide','landscape']:['landscape','wide','square','portrait'];
