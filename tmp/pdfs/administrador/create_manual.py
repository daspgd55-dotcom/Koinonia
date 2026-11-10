from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'output/pdf/koinonia-manual-representante-administrador.pdf'
for name,file in [('UI','segoeui.ttf'),('Bold','segoeuib.ttf'),('Title','georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+file))
pdfmetrics.registerFontFamily('UI',normal='UI',bold='Bold',italic='UI',boldItalic='Bold')
NAVY=HexColor('#061A34'); TEAL=HexColor('#0F6664'); GOLD=HexColor('#C99A4A'); BG=HexColor('#F5F6F2'); INK=HexColor('#17232D'); MUTED=HexColor('#66727A')
W,H=595.28,841.89
c=canvas.Canvas(str(OUT),pagesize=(W,H));c.setTitle('Koinonía | Manual de Representante - Administrador');c.setAuthor('Koinonía');c.setSubject('Guía de administración de la ficha de iglesia y del equipo')
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
    c.setFont('Title',18);c.setFillColor(white);c.drawString(92,H-35,'Koinonía');c.setFont('UI',9);c.drawRightString(W-48,H-33,'MANUAL · ADMINISTRADOR')
    c.setStrokeColor(GOLD);c.line(48,48,W-48,48);c.setFont('UI',8);c.setFillColor(MUTED);c.drawString(48,33,'Representante - Administrador  |  Edición 1.0 · 10 noviembre 2026');c.drawRightString(W-48,33,f'{n:02} / 13')
    c.drawImage(ImageReader(str(ROOT/'Frontend/public/loading/koinonia-simbolo.png')),48,H-46,width=34,height=34,mask='auto',preserveAspectRatio=True)
    y=H-88;para(kicker,'small',9);para(title,'title',12);para(subtitle,'body',20)
def end():c.showPage()

def figure(file,caption,maxheight=250):
    global y
    from PIL import Image
    img=Image.open(ROOT/'tmp/pdfs/administrador'/file);w,h=img.size;scale=min((W-96)/w,maxheight/h);dh=h*scale;dw=w*scale
    if y-dh<85:raise RuntimeError('Figure overflow')
    c.drawImage(ImageReader(img),48,y-dh,width=dw,height=dh,mask='auto');y-=dh+7;para(caption,'small',14)

page(1,'GUÍA DE USO · ADMINISTRADOR DE IGLESIA','Cuidar la ficha<br/>y organizar el equipo','Manual para representantes con función de <b>Administrador de iglesia</b>. Instrucciones para mantener la información pública y gestionar las funciones del equipo.')
heading('Índice')
table([['Contenido','Página'],['Acceso, orientación e identificación','2'],['Ubicación y acceso al recinto','3'],['Identidad cristiana y doctrina','4'],['Reuniones y horarios','5'],['Comunidad y apoyos de accesibilidad','6'],['Liderazgo público y contactos','7'],['Primera visita y avisos al equipo','8'],['Validación, fotos y presentación','9'],['Guardar, revisar y publicar','10'],['Funciones y acceso del equipo','11'],['Asignar, cambiar y retirar funciones','12'],['Otras áreas y manuales de consulta','13']],[439,60])
end()
page(2,'01 · COMENZAR','Una ficha útil y confiable','Entra en Administración, localiza tu iglesia y abre Ficha y equipo. Comprueba el nombre de la iglesia antes de editar.')
figure('identity-crop.png','Identificación: nombre y datos de presentación de la iglesia.',210)
para('Si llegas desde una invitación, acéptala con una cuenta del correo destinatario y vuelve a iniciar sesión si se indica. Completa la verificación o segundo factor cuando corresponda.')
heading('Completar Identificación')
para('<b>Nombre:</b> utiliza el nombre por el que se reconoce a la iglesia.<br/><b>Abreviación:</b> añade sus siglas si las utiliza.<br/><b>Año de fundación:</b> indica un año confirmado.<br/><b>Descripción:</b> presenta a la comunidad, su propósito y cómo recibe a nuevas personas.<br/><b>Características distintivas:</b> explica prácticas o actividades que ayudan a conocerla.')
box('Ejemplo de descripción','“Somos una comunidad cristiana que se reúne para aprender de la Biblia, acompañarse y servir al barrio. Recibimos a personas de distintas edades y contamos con encuentros durante la semana.” Adapta el texto a la realidad de tu iglesia.')
para('La guía inicial propone revisar dirección y reuniones, completar descripción y contactos, y abrir la vista previa. Puedes consultar la ayuda de cada sección cuando la necesites.','small')
end()
page(3,'02 · UBICACIÓN','Ayudar a llegar al lugar correcto','En Ubicación, completa la dirección pública y revisa el punto del mapa. No uses tu domicilio personal como sustituto del lugar de reunión.')
table([['Campo','Cómo completarlo'],['Dirección y comuna','Calle, número y comuna del recinto. Incluye referencias útiles en Indicaciones para llegar.'],['Ciudad, región y código postal','Completa lo que conozcas. El código postal, si se indica, debe tener siete dígitos.'],['Estacionamiento','Indica si existe, si no hay o si depende de disponibilidad en el sector.'],['Accesibilidad para movilidad reducida','Señala Sí, No, Parcialmente o No sabe según las condiciones reales.'],['Indicaciones para llegar','Describe el acceso, entrada, piso o referencias que ayuden a encontrar el recinto.'],['Mapa / Coordenadas verificadas','Marca el lugar en el mapa. Como alternativa puedes introducir longitud y latitud verificadas.']],[180,319])
heading('Dirección y mapa deben coincidir')
para('Cambiar el texto de la dirección no sustituye la revisión del punto del mapa. Para guardar, la ficha necesita nombre, comuna y coordenadas válidas. Si el mapa no carga, vuelve a abrir la sección o utiliza Coordenadas verificadas cuando dispongas de ellas.')
box('Ejemplo de indicación útil','“El acceso al salón está por la entrada lateral. El equipo de bienvenida recibe junto a la puerta principal antes de la reunión.” Evita referencias que una persona nueva no pueda reconocer.')
para('Los apoyos concretos, como rampa, baño accesible o lengua de señas, se completan en Comunidad. Revisa las casillas de privacidad cuando un dato no deba aparecer en la ficha pública.','small')
end()
page(4,'03 · IDENTIDAD Y DOCTRINA','Describir la identidad de la iglesia','Completa los campos con información acordada por la iglesia. No es necesario elegir una postura que la comunidad no haya definido.')
figure('christian-crop.png','Identidad cristiana: rama, denominación y tradición vinculada.',175)
para('<b>Rama:</b> tradición general, por ejemplo Protestante.<br/><b>Denominación:</b> identidad más específica, por ejemplo Bautista o Evangélica.<br/><b>Tradición vinculada:</b> antecedentes que ayuden a comprender su identidad.<br/><b>Institución, asociación o red:</b> escribe el nombre de la organización a la que pertenece. Este campo no confirma por sí solo una afiliación ni concede permisos.<br/><b>Idiomas:</b> indica los utilizados en la vida de la comunidad.')
heading('Doctrina y prácticas')
para('Añade la Declaración oficial de creencias y valores y selecciona las prácticas que correspondan. Puedes incorporar opciones propias. Las etiquetas incluyen, entre otras, Diezmo, Dones espirituales, Santa Trinidad y Sola Scriptura.')
para('<b>Soteriología</b> describe la postura sobre la salvación; <b>escatología</b>, sobre los acontecimientos finales. Si no existe una definición, deja el campo vacío o utiliza la opción que corresponda. Puedes ocultar esas posturas del perfil público con sus casillas.')
end()
page(5,'04 · REUNIONES','Publicar horarios comprensibles','En Reuniones, indica los tipos que existen y añade los horarios que estén confirmados. Una etiqueta de tipo no sustituye un horario completo.')
table([['Dato','Qué indicar'],['Tipo y público','Nombre de la reunión y a quién está dirigida.'],['Modalidad','Presencial, Online o Híbrida.'],['Dirección o enlace','Lugar específico o enlace completo cuando corresponda.'],['Frecuencia','Semanal, Quincenal, Mensual u Ocasional.'],['Indicaciones y variaciones','Por ejemplo: “Segundo sábado de cada mes”.'],['Día, hora y duración','Añade uno o varios horarios. La duración se escribe en minutos.'],['Permitir avisos de visita','Indica si esa reunión puede participar en los avisos de visita, sujeto a la configuración general.']],[170,329])
box('Ejemplo de reunión','“Culto principal · Familias · Presencial · Semanal · Domingo 11:00 · 90 minutos”. Si hay otro horario del mismo encuentro, utiliza Añadir horario en esa reunión.')
heading('Reuniones y visitas')
para('Los avisos de visita utilizan horarios semanales presenciales o híbridos. Los encuentros online, mensuales, quincenales u ocasionales se coordinan por los canales oficiales. También debe estar habilitada la recepción de avisos en Primera visita.')
para('Si cambias reuniones y existen avisos pendientes, el sistema puede pedir confirmación. Los avisos conservan su horario original: revisa Visitas y comunica los cambios que afecten a las personas. Quitar un horario de la ficha no equivale a avisarles.','small')
end()
page(6,'05 · COMUNIDAD','Mostrar cómo se vive la comunidad','Completa estilos musicales, estilo cultural, rango de miembros, ministerios, actividades, grupos etarios y descripción de actividades comunitarias.')
figure('community.png','Casillas de accesibilidad y privacidad dentro de Comunidad.',225)
heading('Seleccionar apoyos de accesibilidad')
para('Marca Rampa o acceso sin escalones, Baño accesible, Ascensor y Apoyo en lengua de señas solo cuando estén disponibles. En Otros apoyos y condiciones de accesibilidad añade una explicación breve. Si un apoyo figura como parcial, detalla sus condiciones antes de cambiarlo.')
box('Ejemplo de condición','“El salón principal tiene acceso sin escalones; los talleres del segundo piso no cuentan con ascensor.” Esta indicación permite decidir con información concreta.')
para('La casilla <b>Ocultar del perfil público este bloque de accesibilidad y apoyos</b> controla este conjunto de datos. Los estilos musicales y el estilo cultural tienen sus propias opciones de privacidad. Revisa el resultado en la vista previa.','small')
end()
page(7,'06 · LIDERAZGO Y CONTACTO','Personas visibles y canales oficiales','Liderazgo público y contacto presenta a la iglesia. Los nombres y cargos de esta sección no crean cuentas ni conceden acceso de administración.')
figure('contact-crop.png','Nombre y cargo del liderazgo principal, junto con los contactos.',180)
para('<b>Autoridad principal:</b> escribe nombre y cargo. Añade otros responsables cuando corresponda; evita filas incompletas.<br/><b>Sitio web y redes:</b> utiliza enlaces completos de los canales oficiales.<br/><b>Correo y teléfono institucional:</b> comprueba que puedan atender consultas; puedes ocultarlos con sus casillas.<br/><b>WhatsApp institucional:</b> es opcional. Usa formato internacional sin espacios, por ejemplo +56912345678. Comprueba el número antes de publicarlo.<br/><b>Horario de atención institucional:</b> indica días, horas y excepciones de atención; no lo confundas con los cultos.')
box('Ejemplo de horario de atención','“Martes a viernes, de 10:00 a 13:00. Fuera de ese horario, puedes dejar un mensaje en el correo institucional.” Usa un horario que el equipo pueda cumplir.')
para('La ficha pública muestra esta sección de personas como Liderazgo de la Iglesia. Para asociar un retrato, guarda primero el nombre y cargo y luego selecciónalo al subir la foto.','small')
end()
page(8,'07 · PRIMERA VISITA','Organizar una bienvenida posible','Describe las indicaciones para nuevos asistentes, el acompañamiento disponible y el proceso de bienvenida. Separa las instrucciones públicas de la configuración privada del equipo.')
figure('visit-crop.png','Configuración privada: recepción de visitas y avisos al equipo.',185)
para('<b>Recibir avisos de visitas:</b> habilita el recorrido para que una persona avise su intención de asistir.<br/><b>Acceso a Visitas:</b> permite a todos los integrantes con ese permiso o solo a los seleccionados. La lista distingue quién es elegible. Un Editor no puede atender visitas.<br/><b>Avisar por correo a los integrantes de bienvenida autorizados:</b> usa el correo de sus cuentas activas. Si seleccionas encargados, también deben estar incluidos.<br/><b>Enviar también avisos por correo:</b> activa los destinatarios adicionales que escribas, hasta diez. Estos reciben un aviso breve; el detalle requiere acceso autorizado.')
box('Comprobar equipo y avisos','Asignar Bienvenida no basta si el acceso está limitado a una selección que no incluye a esa persona. Revisa ambos ajustes y guarda. El administrador global conserva acceso; el administrador de iglesia también debe respetar la selección para atender visitas.')
para('Los avisos por correo necesitan el servicio de envío operativo. No incluyen el mensaje ni los datos personales del visitante. Para responder y confirmar recepciones, consulta el manual de Bienvenida.','small')
end()
page(9,'08 · VALIDACIÓN Y MULTIMEDIA','Respaldar y presentar la información','En Validación y multimedia, registra quién aportó los datos, su cargo, la fuente de información y la autorización para uso informativo.')
figure('media.png','Selecciona primero la foto; después aparecen los controles de presentación.',175)
heading('Subir y colocar una foto')
para('<b>1.</b> Selecciona una imagen JPEG, PNG o WebP de hasta 5 MB. La ficha admite hasta 10 fotos.<br/><b>2.</b> Elige Presentación y Marco. Para un retrato, selecciona la persona del liderazgo ya guardada.<br/><b>3.</b> Ajusta el recorte y confirma la subida. Si la ficha es nueva, guarda primero su borrador.<br/><b>4.</b> Revisa Mostrar en, título, fuente o autorización y posición horizontal/vertical. Guarda los ajustes pendientes.')
heading('Orden y retirada de recursos')
para('Las miniaturas permiten cambiar la secuencia con arrastre o flechas del teclado. Mostrar en decide la sección; ordenar no cambia esa ubicación. Añadir enlace externo permite incorporar recursos por URL. Revisa la diferencia entre Eliminar recurso y Quitar de la ficha y lee la confirmación antes de continuar.')
para('La autorización informativa no concede automáticamente la insignia de verificación. Las fotos deben tener permiso de uso. En Identificación, Orden del perfil público permite mover apartados y restablecer su orden.','small')
end()
page(10,'09 · GUARDADO Y PUBLICACIÓN','Revisar antes de hacer público','Guardar ficha conserva los cambios y la visibilidad actual. Una ficha ya publicada puede mostrar los cambios guardados sin una nueva acción de publicación.')
heading('Un recorrido de revisión')
para('<b>1.</b> Completa una sección y revisa sus datos.<br/><b>2.</b> Abre Vista previa del perfil para comprobar cómo se verán los cambios, incluidos los aún no guardados.<br/><b>3.</b> Revisa privacidad, nombres, contactos, horarios y fotos.<br/><b>4.</b> Pulsa Guardar ficha y espera el mensaje de resultado.<br/><b>5.</b> Consulta Preparación de la ficha. El porcentaje corresponde a la versión guardada; sirve para localizar información pendiente.')
table([['Estado o acción','Qué ocurre'],['Borrador','La ficha no se presenta como publicada. La primera publicación necesita autorización administrativa.'],['Solicitar publicación y verificación','Envía la solicitud cuando todavía falta esa primera autorización. No publica inmediatamente.'],['Publicar / Pasar a borrador','Tras la primera publicación autorizada, permite gestionar la visibilidad desde las opciones disponibles.'],['Solicitar verificación','Pide la revisión de la información; no concede automáticamente la insignia.'],['Editar una ficha verificada','Se mantiene publicada, pero deja de estar verificada hasta una nueva revisión.']],[170,329])
box('Si no se puede guardar','Lee el mensaje: la interfaz puede abrir la sección y enfocar el campo que necesita corrección. Si otra persona cambió la ficha, conserva tu borrador antes de recargar. No cierres la página ni descartes cambios sin revisar qué perderías.')
end()
page(11,'10 · EQUIPO DE ADMINISTRACIÓN','Elegir la función adecuada','Abre Equipo de administración y permisos con la ficha guardada. Aquí gestionas cuentas con acceso, no los nombres del liderazgo público.')
table([['Función','Responsabilidades habilitadas'],['Representante administrador','Ficha de iglesia, contenido, experiencias, visitas y gestión del equipo. Su designación corresponde al administrador global.'],['Editor','Comunidades vinculadas y eventos.'],['Moderador','Revisión de experiencias y atención de visitas autorizadas.'],['Bienvenida','Atención de visitas autorizadas.']],[170,329])
heading('Organizar el equipo')
para('Acuerda con cada persona qué tareas asumirá y utiliza la función que corresponda. Una persona asignada como Editor no obtiene acceso a la ficha principal. Si necesita actualizar esa ficha, coordina el trabajo con un administrador de iglesia.')
box('Ejemplo de reparto de tareas','Una persona mantiene las comunidades y los eventos como Editor. Otra revisa experiencias como Moderador. El equipo de Bienvenida atiende los avisos. El administrador de iglesia revisa los datos generales, organiza los accesos y coordina los cambios.')
para('Puedes asignar o cambiar las funciones Editor, Moderador y Bienvenida. Para designar, cambiar o retirar a un representante administrador, solicita la intervención del administrador global. La iglesia debe conservar al menos un administrador y el equipo admite hasta 20 integrantes.','body')
end()
page(12,'11 · GESTIÓN DE CUENTAS','Asignar, cambiar o retirar acceso','Antes de actuar, verifica la identidad de la cuenta y que la persona haya acordado participar en el equipo.')
figure('team.png','Equipo de ejemplo: funciones actuales y búsqueda de una cuenta existente.',255)
para('<b>Asignar:</b> en Asignar un usuario existente, escribe el correo o nombre de usuario y pulsa Buscar usuario. Comprueba el resultado, selecciona Función a asignar y pulsa Asignar a esta iglesia. Si es su primer acceso como representante, deberá iniciar sesión nuevamente.<br/><b>Cambiar función:</b> utiliza el selector junto a la persona. La acción se aplica al cambiar la selección; no espera a Guardar ficha.<br/><b>Retirar:</b> pulsa Retirar del equipo y confirma. Se retira el acceso a esa iglesia, no se elimina la cuenta.')
para('La asignación desde este panel opera sobre una cuenta existente: no crea una cuenta ni envía por sí sola una invitación para aceptar. Si no encuentras una cuenta activa, coordina su registro o el proceso de invitación con la administración global.','small')
end()
page(13,'12 · OTRAS ÁREAS','Un equipo, tareas complementarias','El administrador de iglesia también tiene habilitadas las funciones de contenido, moderación y visitas. Consulta los manuales específicos para el detalle de cada recorrido.')
table([['Área habilitada','Resumen y manual de consulta'],['Comunidades vinculadas','Crear y editar grupos, responsables, contactos, ubicación, horarios y recursos. Gestionar borrador, publicación y archivo. Consulta el manual de Editor.'],['Eventos','Preparar fechas, lugar, participación, portada y colaboración; publicar o comunicar cancelaciones. Consulta el manual de Editor.'],['Experiencias','Revisar relatos, aprobar, rechazar con motivo o retirar una publicación. Consulta el manual de Moderador.'],['Visitas','Leer avisos, confirmar recepción y comunicar cambios a visitantes, según los encargados autorizados. Consulta el manual de Bienvenida; el de Moderador también incluye este recorrido.']],[165,334])
box('Dónde consultar los otros manuales','En el mismo lugar donde descargaste este manual, consulta los manuales de Editor, Moderador y Bienvenida para ampliar las instrucciones de sus respectivas funciones.')
heading('Antes de cerrar tu sesión')
para('Comprueba que los cambios estén guardados, revisa el resultado público y confirma que cada integrante tenga el acceso acordado. Si cambias horarios, avisa al equipo de bienvenida. Si retiras o cambias funciones, revisa también los encargados de visitas y los correos adicionales configurados manualmente.')
para('Comparte solo los datos necesarios para coordinar el servicio. Mantén privados los enlaces de invitación y las credenciales; cierra sesión cuando uses un dispositivo compartido.','small')
end();c.save();print(OUT)
