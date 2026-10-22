"""Build the loading symbol from geometric paths; no existing raster is modified.
Run from the repository root: python docs/diseno/generar-loader.py
"""
from pathlib import Path
import math
import subprocess
from PIL import Image, ImageDraw, ImageChops

OUT = Path(__file__).resolve().parents[2] / 'output' / 'branding' / 'loader'
SIZE, SCALE, DURATION = 256, 4, 4000
TEAL, GOLD, BROWN = '#35B5AA', '#E3BC58', '#76513D'
W = SIZE * SCALE
FACTOR = W / 360

def xy(points): return [(round(x*FACTOR), round(y*FACTOR)) for x,y in points]
def blank(): return Image.new('L', (W,W), 0)

def polygon(points, radius=0):
    mask=blank(); draw=ImageDraw.Draw(mask)
    if not radius: draw.polygon(xy(points), fill=255); return mask
    rounded=[]
    for i,p in enumerate(points):
        a,b=points[i-1],points[(i+1)%len(points)]
        da,db=math.dist(a,p),math.dist(b,p)
        r=min(radius, da*.25, db*.25)
        q=(p[0]+(a[0]-p[0])*r/da,p[1]+(a[1]-p[1])*r/da)
        s=(p[0]+(b[0]-p[0])*r/db,p[1]+(b[1]-p[1])*r/db)
        for j in range(9):
            t=j/8
            rounded.append(((1-t)**2*q[0]+2*(1-t)*t*p[0]+t*t*s[0],(1-t)**2*q[1]+2*(1-t)*t*p[1]+t*t*s[1]))
    draw.polygon(xy(rounded),fill=255)
    return mask

def rect(box, radius=4):
    mask=blank(); ImageDraw.Draw(mask).rounded_rectangle(tuple(round(v*FACTOR) for v in box),radius=round(radius*FACTOR),fill=255); return mask

def reveal(points, p, width=45):
    mask=blank()
    if p<=0: return mask
    lengths=[math.dist(a,b) for a,b in zip(points,points[1:])]
    remain=sum(lengths)*min(1,p); traced=[points[0]]
    for a,b,length in zip(points,points[1:],lengths):
        f=min(1,remain/length)
        traced.append((a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f)); remain-=length
        if remain<=0: break
    draw=ImageDraw.Draw(mask); draw.line(xy(traced),fill=255,width=round(width*FACTOR),joint='curve')
    return mask

def ease(x):
    x=max(0,min(1,x)); return x*x*(3-2*x)

# Final geometry: all three lowest extrema are exactly y=280.
K_STEM=rect((60,48,84,280))
K_UPPER=polygon([(73,130),(212,46),(224,66),(84,151)],4)
K_LOWER=polygon([(84,127),(246,236),(246,260),(84,151)])
N=polygon([(84,151),(246,260),(246,58),(270,58),(270,280),(246,280),(102,183),(102,280),(84,280)],3)
CROSSBAR=rect((200,102,312,123),4)

def gradient():
    im=Image.new('RGBA',(W,W),BROWN); draw=ImageDraw.Draw(im)
    start,end=212,274
    a,b=tuple(bytes.fromhex(BROWN[1:])),tuple(bytes.fromhex(GOLD[1:]))
    for y in range(W):
        t=ease((y/FACTOR-start)/(end-start))
        color=tuple(round(c+(d-c)*t) for c,d in zip(a,b))+(255,)
        draw.line((0,y,W,y),fill=color)
    return im

SOLID_TEAL=Image.new('RGBA',(W,W),TEAL)
SOLID_GOLD=Image.new('RGBA',(W,W),GOLD)
SOLID_BROWN=Image.new('RGBA',(W,W),BROWN)
GRADIENT=gradient()

def frame(t):
    # Build, hold, erase in reverse order, short empty interval.
    if t<1.65: progress=ease(t/1.65)
    elif t<2.45: progress=1
    elif t<3.75: progress=1-ease((t-2.45)/1.3)
    else: progress=0
    def stage(start,end): return ease((progress-start)/(end-start))
    result=Image.new('RGBA',(W,W),(0,0,0,0))
    def layer(color,mask,path,p):
        visible=ImageChops.multiply(mask,reveal(path,p))
        result.alpha_composite(Image.composite(color,Image.new('RGBA',(W,W)),visible))
    # Gold N runs from cross tip down to corner, left along diagonal, then down.
    layer(SOLID_GOLD,N,[(258,58),(258,268),(93,167),(93,280)],stage(.05,1))
    # Restrict brown gradient to right stem; the rest of N remains gold.
    stem=ImageChops.multiply(N,rect((246,48,272,282),0))
    layer(GRADIENT,stem,[(258,58),(258,280)],stage(.05,.46))
    layer(SOLID_BROWN,CROSSBAR,[(200,112),(312,112)],stage(.12,.38))
    layer(SOLID_TEAL,K_STEM,[(72,280),(72,48)],stage(0,.48))
    layer(SOLID_TEAL,K_UPPER,[(76,140),(219,54)],stage(.29,.72))
    # Extend the reveal past the clipped shape: a butt-ended reveal at the
    # corner itself leaves a white triangular notch in the teal diagonal.
    layer(SOLID_TEAL,K_LOWER,[(78,137),(270,264)],stage(.29,.78))
    return result.resize((SIZE,SIZE),Image.Resampling.LANCZOS)

def save_gif(frames,name,background=None):
    raw=[]
    for rgba in frames:
        if background:
            base=Image.new('RGBA',rgba.size,background); base.alpha_composite(rgba)
        else: base=rgba
        raw.append(base.tobytes())
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size',f'{SIZE}x{SIZE}','-framerate','25','-i','pipe:0','-filter_complex','[0:v]split[a][b];[a]palettegen=reserve_transparent=1[p];[b][p]paletteuse=dither=none:alpha_threshold=128','-gifflags','-offsetting','-loop','0',str(OUT/name)],input=b''.join(raw),check=True)

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    frames=[frame(i*.04) for i in range(100)]
    save_gif(frames,'koinonia-cargando-blanco.gif','#FFFFFF')
    save_gif(frames,'koinonia-cargando-transparente.gif')
    # Lossless alpha copy for browsers that support animated WebP.
    frames[0].save(OUT/'koinonia-cargando.webp',save_all=True,append_images=frames[1:],duration=40,loop=0,lossless=True)
    still=frame(2)
    still.save(OUT/'koinonia-simbolo.png')
    sheet=Image.new('RGB',(SIZE*4,SIZE*2),'#EEE9DD')
    for i,t in enumerate([.25,.55,.85,1.2,1.65,2.45,3.1,3.55]):
        img=frame(t); sheet.paste(img,((i%4)*SIZE,(i//4)*SIZE),img)
    sheet.save(OUT/'secuencia.png')
    for p in sorted(OUT.iterdir()): print(f'{p.name}: {p.stat().st_size:,} bytes')

if __name__=='__main__': main()
