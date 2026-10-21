from pathlib import Path
from xml.sax.saxutils import escape
from docx import Document
from docx.oxml.ns import qn
from docx.table import Table as DTable
from docx.text.paragraph import Paragraph as DPara
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, PageBreak, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
pdfmetrics.registerFont(TTFont('Arial','C:/Windows/Fonts/arial.ttf'));pdfmetrics.registerFont(TTFont('ArialBold','C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='ArialBold',italic='Arial',boldItalic='ArialBold')
s=getSampleStyleSheet()
for name in ['Normal','Title','Heading1','Heading2']:
 s[name].fontName='ArialBold' if name!='Normal' else 'Arial';s[name].textColor=colors.black
s['Normal'].fontSize=10;s['Normal'].leading=13;s['Normal'].spaceAfter=7
s['Title'].fontSize=25;s['Title'].leading=30;s['Title'].alignment=0
s['Heading1'].fontSize=18;s['Heading1'].leading=22;s['Heading1'].spaceAfter=12
s['Heading2'].fontSize=11.5;s['Heading2'].leading=15;s['Heading2'].spaceBefore=7;s['Heading2'].spaceAfter=5
s.add(ParagraphStyle('ConfigCode',parent=s['Normal'],fontSize=8.8,leading=12,backColor=colors.HexColor('#F5F6F2'),borderPadding=7,spaceBefore=4,spaceAfter=12))
s.add(ParagraphStyle('Cell',parent=s['Normal'],fontSize=9.3,leading=12,spaceAfter=0))
doc=Document('output/documents/koinonia-resumen-seguridad.docx');story=[]
for elem in doc.element.body:
 if elem.tag==qn('w:p'):
  if elem.xpath('.//w:br[@w:type="page"]'):story.append(PageBreak());continue
  p=DPara(elem,doc);txt=p.text
  if elem.xpath('.//w:hyperlink'):
   for x in elem.xpath('.//w:hyperlink'):
    label=''.join(x.itertext());label=''.join(n.text or '' for n in x.xpath('.//w:t'));url=doc.part.rels[x.get(qn('r:id'))].target_ref
    story.append(Paragraph('<link href="'+escape(url)+'" color="#0F6664">'+escape(label)+'</link>',s['Normal']))
   continue
  if not txt:continue
  style={'Title':'Title','Heading 1':'Heading1','Heading 2':'Heading2'}.get(p.style.name,'Normal')
  if any(r.font.name=='Consolas' for r in p.runs):style='ConfigCode'
  story.append(Paragraph(escape(txt).replace('\n','<br/>'),s[style]))
 elif elem.tag==qn('w:tbl'):
  dt=DTable(elem,doc);rows=[[Paragraph(escape(c.text).replace('\n','<br/>'),s['Cell']) for c in row.cells] for row in dt.rows]
  widths=[float(c.width)/914400*72 for c in dt.columns];scale=481/sum(widths);widths=[w*scale for w in widths]
  t=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EEE9DD')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#CDD2D3')),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]));story.extend([t,Spacer(1,10)])
def footer(canvas,doc):
 canvas.setFont('Arial',8);canvas.setFillColor(colors.HexColor('#66727A'));canvas.drawString(57,26,'Koinonía | Guía de seguridad | 21 octubre 2026');canvas.drawRightString(A4[0]-57,26,str(doc.page))
target=Path('output/pdf/koinonia-resumen-seguridad.pdf');target.parent.mkdir(parents=True,exist_ok=True)
SimpleDocTemplate(str(target),pagesize=A4,leftMargin=57,rightMargin=57,topMargin=45,bottomMargin=42,title='Seguridad de Koinonía',author='Koinonía').build(story,onFirstPage=footer,onLaterPages=footer)
r=PdfReader(target);print('Pages',len(r.pages));print([(i+1,len(p.extract_text())) for i,p in enumerate(r.pages)])

