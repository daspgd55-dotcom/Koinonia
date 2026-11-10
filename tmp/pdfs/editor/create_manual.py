from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/pdf/koinonia-manual-representante-editor.pdf'
for name,file in [('UI','segoeui.ttf'),('Bold','segoeuib.ttf'),('Title','georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
pdfmetrics.registerFontFamily('UI',normal='UI',bold='Bold',italic='UI',boldItalic='Bold')
NAVY=HexColor('#061A34'); TEAL=HexColor('#0F6664'); GOLD=HexColor('#C99A4A'); BG=HexColor('#F5F6F2'); INK=HexColor('#17232D'); MUTED=HexColor('#66727A')
W,H=595.28,841.89
c=canvas.Canvas(str(OUT),pagesize=(W,H));c.setTitle('Koinonía | Manual de Representante - Editor');c.setAuthor('Koinonía');c.setSubject('Guía de administración de comunidades vinculadas y eventos')
y=0
styles={k:ParagraphStyle(k,fontName=font,fontSize=size,leading=leading,textColor=color,spaceAfter=0) for k,font,size,leading,color in [('body','UI',10.5,16,INK),('small','UI',9,13,MUTED),('h2','Bold',13,18,TEAL),('title','Title',27,33,NAVY)]}
def para(text,style='body',gap=10):
    global y
    p=Paragraph(text,styles[style]);_,h=p.wrap(W-96,700)
    if y-h<65: raise RuntimeError('Overflow: '+text[:60])
    p.drawOn(c,48,y-h);y-=h+gap
def heading(t):para(t,'h2',8)
def box(title,text):
    global y
    a=Paragraph(title,styles['h2']);b=Paragraph(text,styles['body']);aw,ah=a.wrap(W-124,600);bw,bh=b.wrap(W-124,600);h=ah+bh+34
    if y-h<65:raise RuntimeError('Box overflow')
    c.setFillColor(HexColor('#E5F1EC'));c.roundRect(48,y-h,W-96,h,8,fill=1,stroke=0);c.setFillColor(TEAL);c.rect(48,y-h,3,h,fill=1,stroke=0)
    a.drawOn(c,62,y-14-ah);b.drawOn(c,62,y-22-ah-bh);y-=h+17
def table(rows,widths):
    global y
    data=[[Paragraph(str(v),styles['small'] if i else ParagraphStyle('th',parent=styles['small'],textColor=white,fontName='Bold')) for v in row] for i,row in enumerate(rows)]
    t=Table(data,colWidths=widths,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),TEAL),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor('#EDF1EB')]),('LINEBELOW',(0,0),(-1,-1),.4,HexColor('#DDE1DC'))]));_,h=t.wrap(W-96,700)
    if y-h<65:raise RuntimeError('Table overflow')
    t.drawOn(c,48,y-h);y-=h+18
def page(n,kicker,title,subtitle):
    global y
    c.setFillColor(BG);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(NAVY);c.rect(0,H-57,W,57,fill=1,stroke=0)
    c.setFont('Title',18);c.setFillColor(white);c.drawString(92,H-35,'Koinonía');c.setFont('UI',9);c.drawRightString(W-48,H-33,'MANUAL · EDITOR')
    c.setStrokeColor(GOLD);c.line(48,48,W-48,48);c.setFont('UI',8);c.setFillColor(MUTED);c.drawString(48,33,'Representante - Editor  |  Edición 1.0 · 10 noviembre 2026');c.drawRightString(W-48,33,f'{n:02} / 10')
    c.drawImage(ImageReader(str(ROOT/'Frontend/public/loading/koinonia-simbolo.png')),48,H-46,width=34,height=34,mask='auto',preserveAspectRatio=True)
    y=H-88;para(kicker,'small',9);para(title,'title',12);para(subtitle,'body',20)
def end():c.showPage()

def figure(file,caption,maxheight=250):
    global y
    from PIL import Image
    img=Image.open(ROOT/'tmp/pdfs/editor'/file);w,h=img.size;scale=min((W-96)/w,maxheight/h);dh=h*scale;dw=w*scale
    if y-dh<85:raise RuntimeError('Figure overflow')
    c.drawImage(ImageReader(img),48,y-dh,width=dw,height=dh,mask='auto');y-=dh+7;para(caption,'small',14)

page(1,'GUÍA DE USO · EDITOR','Dar vida a comunidades<br/>y encuentros','Manual para representantes con función de <b>Editor de comunidades y eventos</b>. Instrucciones para preparar, revisar y publicar información útil.')
box('Tu responsabilidad','Mantener claros los datos de las comunidades vinculadas y sus eventos: qué ofrecen, a quiénes reciben, dónde se reúnen y cómo participar. Comprueba los cambios antes de hacerlos públicos.')
heading('Índice')
table([['Contenido','Página'],['Acceso y datos de una comunidad','2'],['Responsables y contacto oficial','3'],['Ubicación habitual','4'],['Reuniones y horarios','5'],['Fotos, videos y presentación','6'],['Guardar, revisar y publicar','7'],['Crear y organizar eventos','8'],['Participación, contacto y colaboraciones','9'],['Publicación de eventos y rutina de trabajo','10']],[439,60])
end()

page(2,'01 · COMUNIDADES VINCULADAS','Crear una comunidad','Desde Administración, localiza tu iglesia y abre Comunidades vinculadas. Usa Crear comunidad vinculada o Administrar junto a una comunidad existente.')
figure('form-crop.png','Formulario de ejemplo: nombre, tipo y descripción.',230)
para('<b>Nombre:</b> identifica al grupo, por ejemplo “Jóvenes en Camino”.<br/><b>Tipo:</b> elige Jóvenes, Ministerio, Voluntariado, Organización, Movimiento u Otro.<br/><b>Descripción:</b> explica su propósito y qué hacen. Evita promesas o actividades que no estén confirmadas.<br/><b>Público destinatario:</b> marca los grupos correspondientes. En Otro público puedes escribir una opción y pulsar Añadir público.')
box('Antes de comenzar','Acepta tu invitación individual usando una cuenta con el correo destinatario. Si se solicita, inicia sesión nuevamente. El acceso Editor ofrece Comunidades vinculadas y Eventos; trabaja desde esas áreas de la iglesia asignada.')
para('En el listado puedes buscar por nombre y filtrar por tipo y estado; pulsa Aplicar filtros. La comunidad queda vinculada a la iglesia desde la que la creas.','small')
end()

page(3,'02 · PERSONAS Y CONTACTOS','Responsables de la comunidad','Abre Responsables y contacto oficial para presentar a quienes coordinan el grupo y sus canales de comunicación.')
figure('contact.png','Ejemplo de responsable: nombre y cargo dentro de la comunidad.',190)
heading('Añadir o quitar responsables')
para('Pulsa <b>Añadir responsable</b> y completa Nombre y Cargo. Por ejemplo: “Andrea Muñoz · Coordinadora”. Puedes añadir varias personas. <b>Quitar responsable</b> retira esa entrada del formulario; guarda después para conservar el cambio. Si añadiste una fila por error, elimínala en vez de dejarla incompleta.')
heading('Sitio web, redes y contacto directo')
para('Introduce enlaces completos en Sitio web, Instagram, Facebook y YouTube. Usa los canales de esta comunidad, cuando existan. Completa Correo oficial y Teléfono oficial solo con datos autorizados. Las casillas <b>Ocultar correo oficial</b> y <b>Ocultar teléfono oficial del perfil público</b> permiten conservar esos datos sin mostrarlos públicamente.')
box('Presentación pública y acceso son distintos','Escribir a una persona como responsable no crea una cuenta ni le concede permisos. Este apartado describe quién coordina la comunidad; no administra el equipo de usuarios.')
end()

page(4,'03 · LUGAR HABITUAL','Indicar dónde se reúne','La ubicación habitual ayuda a distinguir una comunidad que se reúne en la iglesia de otra que utiliza un lugar diferente.')
figure('location.png','Ejemplo: usar la ubicación pública de la iglesia.',180)
table([['Opción','Cuándo usarla'],['Sin ubicación indicada','Cuando todavía no existe un lugar confirmado o no corresponde publicarlo.'],['Usar la ubicación pública de la iglesia','Cuando el grupo se reúne en la misma dirección de la iglesia.'],['Una ubicación diferente','Cuando usa otro recinto. Completa Comuna, Dirección, Ciudad y Región según corresponda. La comuna es necesaria al elegir esta opción.']],[210,289])
box('Ejemplo práctico','Un ministerio se reúne en el salón de la iglesia: usa su ubicación pública. Un voluntariado se reúne en otro recinto: elige Una ubicación diferente y comprueba la dirección antes de publicar.')
para('Al cambiar de modo, revisa los campos antes de guardar: no asumas que el formulario conservará la dirección propia que habías escrito. No publiques domicilios particulares sin autorización.','small')
end()

page(5,'04 · HORARIOS','Elegir reuniones de la iglesia<br/>o definir las propias','Abre Reuniones y horarios. Elige el modo que refleje cómo se organiza la comunidad.')
figure('schedule.png','Marca las reuniones que corresponden al grupo cuando uses horarios de la iglesia.',205)
para('<b>Sin horarios indicados:</b> no publica una programación del grupo.<br/><b>Usar los horarios de la iglesia:</b> selecciona las reuniones que correspondan. Sus horarios se actualizarán con la ficha de la iglesia. Si aparece una referencia eliminada, utiliza Quitar referencias no disponibles.<br/><b>Definir horarios propios:</b> pulsa Añadir reunión y completa tipo, público, modalidad, dirección o enlace, frecuencia y notas. Añade día, hora y duración en minutos; puedes registrar varios horarios.')
box('Ejemplo de horario propio','“Taller de lectura bíblica · Adultos · Presencial · Semanal · Miércoles 19:30 · 75 minutos”. Para una reunión mensual, indica en las notas qué semana corresponde, por ejemplo “Segundo sábado de cada mes”.')
para('Los horarios de una comunidad vinculada son informativos: no generan avisos de visita independientes. Comprueba la programación en Vista previa pública antes de guardar.','small')
end()

page(6,'05 · MULTIMEDIA','Preparar fotos y videos','Abre Fotos y videos. La comunidad vinculada admite hasta <b>7 recursos</b> en total, incluidos los enlaces externos.')
heading('Subir una foto')
para('<b>1.</b> Guarda primero la comunidad como borrador; no necesita estar publicada.<br/><b>2.</b> Elige Presentación de la nueva foto: Fotos de la comunidad o Logo, y el Marco para la nueva foto.<br/><b>3.</b> Pulsa Subir foto y selecciona un archivo JPEG, PNG o WebP de hasta 5 MB.<br/><b>4.</b> Ajusta el recorte y confirma la subida.<br/><b>5.</b> Revisa el resultado y guarda los demás cambios pendientes de la ficha.')
heading('Ajustar un recurso existente')
para('<b>Presentación y Mostrar en:</b> indican el uso y la sección del recurso.<br/><b>Marco y posición horizontal/vertical:</b> ajustan cómo se recorta la imagen.<br/><b>Tipo y URL:</b> permiten añadir una imagen o un video por enlace con Añadir enlace externo.<br/><b>Título:</b> identifica el contenido.<br/><b>Fuente o autorización:</b> indica su procedencia o el permiso de uso.')
box('Ejemplo de una imagen útil','Usa una foto clara del espacio donde se reúne el grupo. Un título como “Salón de reuniones” orienta mejor que “Foto 1”. Para imágenes de personas, confirma que tienes autorización para publicarlas.')
heading('Ordenar y eliminar')
para('Arrastra las miniaturas o enfócalas con el teclado y usa las flechas izquierda/derecha para cambiar su secuencia. Esto no cambia la sección elegida. Eliminar recurso retira el enlace al guardar; el archivo remoto se conserva.')
end()

page(7,'06 · PUBLICACIÓN DE COMUNIDADES','Guardar no es publicar','Guardar comunidad conserva los datos. Vista previa pública muestra cómo se presentarán tus cambios, pero no publica por sí sola.')
figure('publication.png','Antes de la primera publicación, guarda la comunidad como borrador.',150)
heading('Publicar paso a paso')
para('<b>1.</b> Completa los datos y pulsa Guardar comunidad.<br/><b>2.</b> Abre Vista previa pública: comprueba texto, contacto, ubicación, horarios y fotos.<br/><b>3.</b> Cierra la vista previa. Termina cualquier foto o cambio pendiente.<br/><b>4.</b> Ve a Revisar publicación y pulsa Publicar cuando esté disponible.')
table([['Estado','Qué significa'],['Borrador','Permite preparar la información sin mostrarla públicamente.'],['Publicada','Puede mostrarse públicamente mientras la iglesia de origen también esté disponible.'],['Archivada','Deja de mostrarse públicamente; no borra definitivamente la comunidad.']],[125,374])
para('Para publicar, la iglesia debe estar activa, tener su primera publicación autorizada y estar publicada o verificada. Si aparece un bloqueo, atiende el mensaje antes de continuar. Volver a borrador y Archivar son acciones separadas de guardar.')
box('Si otra persona editó la comunidad','Tus respuestas permanecen en pantalla. Conserva lo que necesites antes de pulsar Recargar versión actual: recargar puede descartar el borrador. Lee los datos actualizados antes de guardar de nuevo.')
end()

page(8,'07 · EVENTOS','Crear un encuentro','Abre Eventos desde la administración de la iglesia. Crea un evento o entra a uno existente; usa los filtros del listado para localizarlo.')
table([['Campo o sección','Qué completar'],['Nombre y categoría','Un título reconocible y una categoría: Encuentro, Servicio comunitario, Evangelización, Retiro, Taller, Actividad cultural u Otro.'],['Organizador del evento','La iglesia o una de sus comunidades vinculadas. Comprueba a quién corresponde el encuentro.'],['Descripción y público','Explica qué se hará y quiénes pueden participar. Añade públicos adicionales cuando sea necesario.'],['Inicio y término','Fecha y hora de inicio. El término es opcional; si lo indicas debe ser posterior. Sin término, se considera finalizado al terminar el día de inicio.'],['Modalidad','Presencial, En línea o Mixta. Determina si necesitas una dirección, un enlace o ambos.'],['Lugar','Nombre del lugar, dirección, comuna, ciudad y región. Usar dirección de la iglesia copia sus datos al evento.'],['Enlace de acceso','URL válida para eventos en línea o mixtos. Comprueba que las personas destinatarias puedan utilizarla.']],[145,354])
box('Ejemplo: taller de bienvenida','“Taller de bienvenida para nuevas familias”. Organizador: la iglesia. Modalidad: Presencial. Indica fecha, hora, salón y una descripción breve de las actividades. Si lo organiza un grupo concreto, selecciónalo como comunidad organizadora.')
para('La dirección copiada al evento no se actualiza automáticamente cuando cambia la dirección de la iglesia. Revisa siempre el lugar de cada encuentro.','small')
end()

page(9,'08 · PARTICIPACIÓN Y DIFUSIÓN','Explicar cómo participar','En Participación y contacto, indica las condiciones necesarias para que una persona sepa qué hacer antes de asistir.')
table([['Tipo de participación','Información útil'],['Entrada libre','Indica condiciones relevantes, como horarios de ingreso o elementos que deben llevar.'],['Inscripción requerida','Añade un enlace de inscripción o instrucciones claras para inscribirse.'],['Invitación','Explica a quién se dirige y cuáles son las condiciones de la invitación.']],[170,329])
heading('Contacto y portada')
para('Completa los canales oficiales del evento. Puedes ocultar correo y teléfono del perfil público. En Imagen de portada, guarda primero el borrador para subir una imagen, selecciona su marco y ajusta el recorte. También puedes añadir una portada por enlace y completar título y fuente. Revisa el resultado en Vista previa del perfil.')
heading('Colaboraciones entre iglesias')
para('La casilla <b>Invitación abierta a otras iglesias</b> expresa disposición a recibir propuestas; no confirma a ninguna iglesia como participante. Después de guardar el evento, revisa su apartado de colaboraciones y los estados de cada propuesta antes de anunciar una colaboración.')
box('Ejemplo de instrucciones de inscripción','“Completa el formulario de inscripción y espera la confirmación del equipo organizador. Si tienes consultas, utiliza el correo oficial del evento.” Añade esta indicación solo si existe ese procedimiento.')
para('La publicación de un evento y el interés de las personas no sustituyen las condiciones de inscripción que hayas definido. Evita anunciar cupos o confirmaciones que todavía no puedes garantizar.','small')
end()

page(10,'09 · REVISIÓN FINAL','Publicar y mantener al día','Usa Guardar evento y revisa la sección Publicación. El listado de pendientes indica qué falta y permite ir a varios de los campos correspondientes.')
heading('Antes de publicar un evento')
para('Comprueba nombre, descripción, inicio, lugar o enlace según modalidad y condiciones de participación. La iglesia debe estar activa y pública, con primera publicación autorizada. Si organiza una comunidad vinculada, debe estar publicada. Guarda los cambios y termina la portada antes de pulsar <b>Publicar evento</b>.')
heading('Publicación y situación son diferentes')
para('<b>Borrador / Publicado / Archivado</b> controlan la publicación.<br/><b>Programado / Cancelado / Finalizado</b> describen la situación del encuentro.<br/>Para una suspensión, utiliza <b>Cancelar evento</b>, explica el Motivo público de cancelación y pulsa Confirmar cancelación. El motivo requiere entre 5 y 1.000 caracteres. No uses Archivar como sustituto de explicar una cancelación.')
para('Un evento cancelado ofrece Volver a programado. Antes de usarlo, revisa fechas y condiciones. Los contadores de participación permiten consultar interés y asistencia declarada; no equivalen a comprobar asistencia física.')
box('Rutina antes de salir','Revisa las vistas previas, guarda y espera el mensaje de resultado. Comprueba la iglesia y el organizador, las fechas, los enlaces y los datos de contacto. Asegúrate de no dejar una foto a medio preparar ni cambios pendientes.')
heading('Si hay un error')
para('Lee el aviso y corrige el dato indicado. Si cambió la versión, conserva tu trabajo antes de recargar y compara con los datos actuales. Si un botón de publicación está bloqueado, revisa pendientes, cambios sin guardar, imagen en preparación y disponibilidad de la iglesia o comunidad organizadora.')
end();c.save();print(OUT)
