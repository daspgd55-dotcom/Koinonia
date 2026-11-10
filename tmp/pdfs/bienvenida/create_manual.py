from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/pdf/koinonia-manual-representante-bienvenida.pdf'
for name,file in [('UI','segoeui.ttf'),('Bold','segoeuib.ttf'),('Title','georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
pdfmetrics.registerFontFamily('UI',normal='UI',bold='Bold',italic='UI',boldItalic='Bold')
NAVY=HexColor('#061A34'); TEAL=HexColor('#0F6664'); GOLD=HexColor('#C99A4A'); BG=HexColor('#F5F6F2'); INK=HexColor('#17232D'); MUTED=HexColor('#66727A')
W,H=595.28,841.89
c=canvas.Canvas(str(OUT),pagesize=(W,H));c.setTitle('Koinonía | Manual de Representante - Bienvenida');c.setAuthor('Koinonía');c.setSubject('Guía de uso del equipo de bienvenida: visitas, respuestas y avisos')
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
    c.setFont('Title',18);c.setFillColor(white);c.drawString(92,H-35,'Koinonía');c.setFont('UI',9);c.drawRightString(W-48,H-33,'MANUAL · BIENVENIDA')
    c.setStrokeColor(GOLD);c.line(48,48,W-48,48);c.setFont('UI',8);c.setFillColor(MUTED);c.drawString(48,33,'Representante - Bienvenida  |  Edición 1.0 · 10 noviembre 2026');c.drawRightString(W-48,33,f'{n:02} / 07')
    c.drawImage(ImageReader(str(ROOT/'Frontend/public/loading/koinonia-simbolo.png')),48,H-46,width=34,height=34,mask='auto',preserveAspectRatio=True)
    y=H-88;para(kicker,'small',9);para(title,'title',12);para(subtitle,'body',20)
def end():c.showPage()

page(1,'GUÍA DE USO · MÓDULO BASE','Recibir, orientar\ny acompañar'.replace('\n','<br/>'),'Manual para representantes con función de <b>Bienvenida</b>. Una guía práctica para atender los avisos de personas que desean visitar tu iglesia.')
box('Tu responsabilidad','Revisar los avisos, coordinar una acogida posible y responder con claridad. Confirmar recepción significa que el equipo conoce el aviso; no certifica asistencia ni reserva automáticamente un lugar.')
heading('El recorrido en una mirada')
para('<b>1. Consulta</b> las próximas visitas y sus mensajes.<br/><b>2. Coordina</b> con las personas responsables de recibir.<br/><b>3. Confirma</b> la recepción o informa una suspensión justificada.<br/><b>4. Revisa</b> actualizaciones e historial para evitar respuestas duplicadas.')
heading('Índice')
table([['Contenido','Página'],['Acceso y responsabilidades','2'],['Bandeja de visitas y filtros','3'],['Datos y estados del aviso','4'],['Confirmar una bienvenida','5'],['Cambios y suspensiones','6'],['Correos, cuidado de datos y ayuda','7']],[439,60])
end()

page(2,'01 · ACCESO Y RESPONSABILIDADES','Tu espacio de trabajo','')
heading('Entrar por primera vez')
para('<b>1.</b> Abre tu invitación individual y utiliza una cuenta con el mismo correo destinatario. Si aún no tienes cuenta, créala mediante el registro habitual.<br/><b>2.</b> Revisa y acepta la función propuesta. Si se solicita verificación de correo o un segundo factor, completa esos pasos.<br/><b>3.</b> Si la iglesia todavía no tiene administrador activo, espera a que esa persona acepte primero. Después vuelve a tu invitación.<br/><b>4.</b> Tras aceptar, inicia sesión nuevamente si se indica. En <b>Administración</b>, localiza tu iglesia y abre <b>Visitas</b>.')
table([['Puedes hacer'],['Consultar visitas autorizadas, mensajes, fechas y estados.'],['Marcar avisos como leídos y confirmar su recepción.'],['Informar un cambio o suspensión y cancelar ese aviso.']],[499])
box('Si no aparece una iglesia o una visita','Comprueba la cuenta con la que iniciaste sesión. Pide al administrador que revise tu asignación y, si hay encargados seleccionados, que te incluya entre ellos. Tener el rol Bienvenida no omite esa selección.')
para('<b>Visitas</b> en Administración es la bandeja del equipo. <b>Mis visitas</b> corresponde a tus propios avisos como visitante: no son la misma pantalla.','small')
end()

page(3,'02 · BANDEJA DE VISITAS','Encuentra lo que requiere atención','La pantalla Visitas reúne los avisos de las iglesias que estás autorizado a atender.')
table([['Control','Para qué sirve'],['Próximas','Avisos no cancelados cuya reunión aún no ha terminado. Puede incluir una reunión que ya comenzó.'],['Historial','Avisos cancelados y reuniones cuyo horario ya terminó.'],['Sin confirmar','Próximas visitas cuya recepción aún no ha sido confirmada. No equivale a “sin leer”.'],['Todas','Todos los avisos de la vista Próximas, con o sin recepción confirmada.'],['Próximos 7 días','Reuniones que comienzan dentro de los siguientes siete días.'],['Recepción confirmada','Avisos próximos que el equipo ya confirmó.'],['Filtrar por comunidad','Elige una iglesia o “Todas mis comunidades”. Solo aparecen las que puedes atender.'],['Actualizar / Anterior / Siguiente','Recarga el listado o recorre sus páginas. Se muestran hasta 20 avisos por página.']], [145,354])
box('Ejemplo: preparar la bienvenida del domingo','Abre Próximas, elige Próximos 7 días y filtra tu iglesia. Revisa fechas y mensajes. Después consulta Sin confirmar para detectar avisos que todavía necesitan una respuesta.')
para('Si no hay resultados, cambia los filtros y pulsa Actualizar antes de concluir que no existen avisos. La pantalla se actualiza periódicamente, pero puedes recargarla manualmente.','small')
end()

page(4,'03 · LEER UNA TARJETA','Qué información encontrarás','Antes de actuar, comprueba iglesia, persona, reunión, fecha y estado. Evita responder solo por el nombre del visitante.')
table([['Dato visible','Cómo utilizarlo'],['Nombre e iglesia','Identificar a quién se recibe y dónde. No revela un permiso para difundir sus datos.'],['Reunión, fecha, hora y dirección','Organizar la recepción en el lugar y horario indicados. Las notas pueden incluir variaciones.'],['Identidad espiritual y comuna','Contexto que la persona compartió. Puede figurar “No indicada”. No lo uses para condicionar su bienvenida.'],['Mensaje / Solicita una respuesta','Leer necesidades o preguntas. Si pide respuesta, procura responder al confirmar; el sistema no la exige automáticamente.'],['Leído / Sin leer','Indica si el aviso fue atendido como lectura por el equipo. No demuestra que todas las personas lo hayan revisado.'],['Recepción confirmada por…','Identifica a quien confirmó y cuándo; ayuda a coordinar sin duplicar acciones.'],['Respuestas / Cambios de reunión','Desplegables para consultar comunicaciones registradas y horarios anteriores, cuando existen.']], [156,343])
heading('Los estados no significan lo mismo')
para('<b>Aviso enviado:</b> pendiente de confirmación.<br/><b>Recepción confirmada:</b> el equipo recibió el aviso.<br/><b>Cancelado:</b> el visitante o la iglesia canceló ese aviso.<br/><b>Finalizado:</b> terminó el horario previsto. <b>No prueba que la persona asistiera.</b>')
para('La asistencia posterior la declara el visitante en su propio recorrido. El rol Bienvenida no dispone de un control para registrar asistencia en esta bandeja.','small')
end()

page(5,'04 · RESPONDER UN AVISO','Confirmar una bienvenida','Hazlo cuando puedas dar una respuesta útil y coherente con la coordinación de tu iglesia.')
heading('Paso a paso')
para('<b>1. Lee el aviso completo.</b> Comprueba el mensaje y si solicita respuesta.<br/><b>2. Coordina la acogida.</b> Confirma con tu equipo los apoyos o indicaciones que vayas a ofrecer.<br/><b>3. Escribe en “Respuesta para el visitante (opcional)”.</b> El campo admite hasta 1.000 caracteres.<br/><b>4. Pulsa “Confirmar recepción”.</b> El aviso pasa a Recepción confirmada y la respuesta queda disponible para el visitante dentro de la aplicación.<br/><b>5. Revisa el resultado.</b> Debe aparecer la recepción confirmada, con nombre y fecha.')
box('Ejemplo de respuesta','“Hola, recibimos tu aviso para la reunión del domingo. El equipo de bienvenida estará en la entrada principal unos minutos antes. Puedes acercarte y contarnos que es tu primera visita. ¡Te esperamos!”<br/><br/>Usa este ejemplo solo si esas indicaciones corresponden a tu iglesia.')
heading('Marcar como leído no envía tu respuesta')
para('El botón <b>Marcar como leído</b> sirve para organizar la atención interna. No confirma recepción ni envía lo escrito. Si confirmas sin mensaje, el sistema registra: “Recibimos tu aviso; te esperamos.”')
heading('Una respuesta asociada a la acción')
para('Este campo no funciona como un chat con botón de envío independiente. Después de confirmar, no puedes confirmar de nuevo para añadir otra respuesta. Revisa el texto antes de pulsar el botón; escribirlo por sí solo no lo guarda.')
para('Las acciones de lectura y recepción afectan a la atención compartida del equipo. Acuerden quién responde cada aviso para no trabajar sobre supuestos distintos.','small')
end()

page(6,'05 · CAMBIOS Y SUSPENSIONES','Avisar sin generar confusión','Esta acción cancela un aviso concreto. No edita el horario de la iglesia ni cancela todos los avisos de una reunión.')
heading('Si la iglesia no puede recibir en ese horario')
para('<b>1.</b> Confirma el cambio con el responsable de la iglesia.<br/><b>2.</b> En el aviso próximo, pulsa <b>Informar cambio o suspensión</b>.<br/><b>3.</b> Escribe una explicación en el campo de respuesta: mínimo 5 y máximo 1.000 caracteres.<br/><b>4.</b> Revisa que sea la persona y reunión correctas. Pulsa <b>Notificar cambio y cancelar aviso</b>.<br/><b>5.</b> El aviso queda Cancelado y el visitante recibe la actualización dentro de la aplicación para poder elegir otra reunión.')
box('Ejemplo de suspensión','“La reunión de este domingo se ha suspendido por mantenimiento del salón. Lamentamos el cambio. Puedes consultar los horarios disponibles en nuestra ficha y elegir otra reunión.”<br/><br/>No prometas una nueva fecha hasta que esté confirmada.')
heading('Si el visitante cambia de reunión')
para('El visitante puede elegir otro horario desde su propia cuenta antes de que comience su visita. El aviso vuelve a <b>Aviso enviado</b>, se registra el horario anterior y el equipo recibe una actualización en la aplicación. Revisa la nueva fecha antes de confirmar otra vez.')
heading('Avisos cerrados y trabajo simultáneo')
para('No puedes confirmar o suspender un aviso cancelado o cuya reunión terminó. Si aparece “El aviso cambió. Recarga la lista”, pulsa <b>Actualizar</b> y comprueba si otra persona ya lo atendió. No repitas una acción sin revisar el nuevo estado.')
para('Para cambiar la ficha o sus reuniones, pide ayuda al representante administrador. Si hay varias personas afectadas por una suspensión, revisen sus avisos individualmente.','small')
end()

page(7,'06 · AVISOS, CUIDADO Y AYUDA','Una rutina sencilla y responsable','Consulta la bandeja con regularidad. Los correos ayudan a detectar novedades, pero no sustituyen la revisión en Koinonía.')
heading('Correos de nuevas visitas')
para('Puedes recibirlos en el correo de tu cuenta si estás activo, asignado como Bienvenida y autorizado para atender visitas. La iglesia debe admitir avisos y mantener habilitados los correos al equipo de bienvenida; si selecciona encargados, debes estar incluido. El proveedor de correo también debe estar operativo.')
para('El asunto es <b>“Nuevo aviso de visita en Koinonía”</b>. Incluye la iglesia y un enlace a Visitas, sin el nombre, mensaje ni identidad espiritual del visitante. Abre la aplicación e inicia sesión para consultar el detalle. No se garantiza un correo por cada cambio o cancelación; revisa también Notificaciones.')
heading('Si algo no aparece o no funciona')
table([['Situación','Qué hacer'],['No llegó un correo','Consulta Visitas y revisa spam. Pide al administrador que compruebe tu acceso y los avisos por correo. La ausencia de correo no implica que no haya visita.'],['No hay avisos visibles','Pulsa Actualizar, cambia filtros y revisa Historial. Si falta la iglesia, solicita revisar tu asignación.'],['No puedes confirmar','Comprueba si ya está confirmado, cancelado o finalizado. Si cambió, actualiza antes de actuar.'],['Necesitan cambiar horarios o permisos','Comunícalo al representante administrador. Bienvenida no configura esos campos.']], [155,344])
heading('Antes de cerrar tu sesión')
para('Revisa los avisos sin confirmar, coordina con el equipo y comprueba que las respuestas se guardaron. Comparte solo lo necesario para recibir a la persona: no difundas capturas ni datos del visitante en grupos abiertos. Cierra sesión en dispositivos compartidos.')
end();c.save();print(OUT)
