from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

out=Path('output/documents/koinonia-resumen-seguridad.docx')
d=Document(); sec=d.sections[0];sec.top_margin=sec.bottom_margin=Inches(.7);sec.left_margin=sec.right_margin=Inches(.8)
sec.page_width=Inches(8.27);sec.page_height=Inches(11.69)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2']:
 st=d.styles[name];st.font.name='Calibri';st.font.color.rgb=RGBColor(0,0,0)
d.styles['Normal'].font.size=Pt(11);d.styles['Normal'].paragraph_format.space_after=Pt(7)
d.styles['Normal'].paragraph_format.line_spacing=1.08
d.styles['Title'].font.size=Pt(25);d.styles['Heading 1'].font.size=Pt(18);d.styles['Heading 2'].font.size=Pt(12)
def p(t):d.add_paragraph(t)
def h(t):d.add_heading(t,2)
def page(t):d.add_page_break();d.add_heading(t,1)
def code(t):
 z=d.add_paragraph();z.paragraph_format.space_after=Pt(9)
 r=z.add_run(t);r.font.name='Consolas';r.font.size=Pt(9)
def table(headers,rows,widths):
 t=d.add_table(rows=1,cols=len(headers));t.style='Table Grid';t.autofit=False
 for c,w in zip(t.columns,widths):c.width=Inches(w)
 for c,txt in zip(t.rows[0].cells,headers):
  c.text=txt;sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'EEE9DD');c._tc.get_or_add_tcPr().append(sh)
  for r in c.paragraphs[0].runs:r.bold=True
 for row in rows:
  for c,txt in zip(t.add_row().cells,row):c.text=txt
 for row in t.rows:
  tr=OxmlElement('w:cantSplit');row._tr.get_or_add_trPr().append(tr)
  for c in row.cells:
   for z in c.paragraphs:
    z.paragraph_format.space_after=Pt(5);z.paragraph_format.space_before=Pt(3)
    for r in z.runs:r.font.size=Pt(10)
def link(label,url):
 z=d.add_paragraph();hyp=OxmlElement('w:hyperlink');rid=z.part.relate_to(url,'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',is_external=True);hyp.set(qn('r:id'),rid)
 r=OxmlElement('w:r');pr=OxmlElement('w:rPr');col=OxmlElement('w:color');col.set(qn('w:val'),'0F6664');pr.append(col);r.append(pr);tx=OxmlElement('w:t');tx.text=label;r.append(tx);hyp.append(r);z._p.append(hyp)

d.add_paragraph('Seguridad de Koinonía',style='Title')
d.add_paragraph('Funciones y guía resumida de configuración',style='Subtitle')
p('Actualizado el 21 de octubre de 2026')
p('Las mejoras permiten proteger cuentas, limitar intentos abusivos y gestionar los correos de acceso. Están preparadas para activarse gradualmente, conservando la pausa de verificación durante el piloto y el acceso de los representantes que completan sus comunidades.')
p('Esta guía resume el código y la documentación local. Los estados siguientes describen los valores predeterminados del proyecto; no certifican la configuración actual de Render. No contiene claves reales ni modifica servicios.')
table(['Mecanismo','Situación del piloto'],[
('Correo y recuperación','Implementados. La obligación de verificar permanece pausada.'),
('Invitaciones de representantes','Contraseña provisional opcional; si queda vacía, el representante la establece mediante invitación.'),
('Segundo factor administrativo','Voluntario, si se configura el cifrado. No obligatorio globalmente.'),
('Límites y riesgo distribuido','Cuotas activas; nuevas señales en observación, sin bloqueos adicionales propios.'),
('CAPTCHA adaptativo','Implementado, desactivado por defecto.'),
('Cola de correo','Implementada, desactivada; se conserva envío directo.'),
('Panel y webhooks de correo','Panel implementado. La recepción real requiere configurar el proveedor.'),
('Mantenimiento','Simulación disponible. Aplicación por lotes desactivada; no elimina cuentas.')],[2.1,4.5])
h('Una idea para entender el conjunto')
p('Es como el acceso a un edificio: la contraseña abre la puerta, MFA pide una segunda llave y los límites evitan que alguien pruebe miles de llaves. El correo es la mensajería; la cola conserva los encargos, y el panel permite saber qué ocurrió con ellos. Ninguna pieza reemplaza a las demás.')

page('Funciones y casos prácticos')
h('Correo verificado y recuperación segura')
p('La verificación comprueba el control del buzón. La recuperación permite establecer otra contraseña mediante un enlace temporal y de un solo uso; invalida sesiones anteriores. Ejemplo: un representante olvida su clave y recupera el acceso sin que el administrador conozca la nueva. Recuperar la contraseña no desactiva MFA. Verificar correo no demuestra que exista una sola cuenta por persona.')
h('Invitaciones de representantes')
p('El administrador puede asignar una iglesia y enviar una invitación para que el representante elija su contraseña. Durante la pausa también puede establecer una contraseña provisional. Ejemplo: preparar una cuenta de prueba sin esperar correo, o invitar a un pastor sin compartir contraseñas. Las invitaciones vencidas pueden revisarse, reenviarse o revocarse conservando asignaciones; una revocada no se reactiva con el reenvío público.')
h('Segundo factor administrativo o MFA')
p('Añade un código temporal de una aplicación autenticadora después de la contraseña. El secreto se cifra y los códigos de recuperación se muestran una sola vez. Ejemplo: si alguien roba la contraseña del administrador, todavía necesita el segundo factor. Quien lo activa voluntariamente lo seguirá necesitando aunque ADMIN_MFA_REQUIRED sea false. No requiere un proveedor de SMS ni una API de pago.')
h('Límites de abuso y detección distribuida')
p('Las cuotas frenan intentos repetidos por cuenta, conexión u operación. Las nuevas señales relacionan volumen por identificador, fuente y total sin guardar correos o IP en claro en esos registros de riesgo. Ejemplo: detectar muchos intentos contra la misma cuenta aunque cambie la IP. Observe registra señales; no añade bloqueos. La aplicación avanzada de bloqueos sigue pendiente y enforce no se puede activar para ese mecanismo.')
h('CAPTCHA adaptativo')
p('Solicita Turnstile cuando el riesgo y la política del servidor lo requieren; el backend valida la respuesta, su vigencia, acción y dominio. Ejemplo: una ráfaga sospechosa de registros recibe un desafío, mientras el uso ordinario puede continuar. Resolverlo no reinicia las cuotas ni ofrece un pase permanente. En el piloto permanece apagado.')
h('Cola y seguimiento del correo')
p('La cola guarda encargos cifrados y reintenta fallos temporales; un worker es el proceso separado que los entrega. El webhook recibe avisos firmados del proveedor y el panel muestra retrasos, rebotes y fallos. Ejemplo: si el proveedor falla temporalmente, la cola puede reintentar un enlace aún válido. “Entregado” no significa leído ni que esté en la bandeja principal.')
h('Mantenimiento seguro')
p('Cuenta y retira artefactos vencidos por tipo, con lotes y auditoría. Ejemplo: limpiar tokens inútiles sin borrar la cuenta del representante ni su iglesia asignada. Un token vencido se rechaza aunque MongoDB todavía no lo haya purgado. No se elimina una cuenta por tener el correo sin verificar.')

page('Claves de correo y avisos del proveedor')
h('Dónde se guardan las configuraciones')
p('En desarrollo, las variables pertenecen a Backend/.env, excluido de Git. En el alojamiento, pertenecen al entorno del servicio backend; el worker necesita también sus variables cuando se habilite. No guardar secretos en el frontend, variables VITE, capturas, documentación ni chats. Preparar claves no implica activar las políticas obligatorias.')
h('Resend para enviar correos')
p('En la sección API Keys de Resend se crea la clave de envío. Usar permiso de envío y restringir dominio cuando corresponda. El remitente debe estar autorizado por el proveedor; mantener las restricciones de prueba que tenga la cuenta hasta configurar el dominio. [1]')
table(['Variable','Qué colocar'],[
('RESEND_API_KEY','La clave secreta de envío creada en Resend.'),
('MAIL_FROM','Remitente autorizado, por ejemplo un nombre y su dirección de correo.'),
('APP_PUBLIC_URL','Origen del frontend, sin barra final ni ruta: https://koinonia-yvr2.onrender.com')],[2.2,4.4])
p('Las tres variables se configuran juntas. APP_PUBLIC_URL no es la dirección del backend: se utiliza para construir enlaces que el usuario abrirá en la página. Si ya funciona el envío, no es necesario reemplazar la clave para incorporar el resto de mecanismos.')
h('Webhook para conocer el resultado del envío')
p('En Webhooks de Resend, registrar una URL HTTPS del backend terminada en /api/webhooks/resend. Suscribirse a email.sent, email.delivered, email.delivery_delayed, email.bounced, email.complained y email.failed. Copiar el secreto de firma del webhook a RESEND_WEBHOOK_SECRET y conservar MAIL_WEBHOOK_SOURCE=provider. [2]')
code('https://<dominio-del-backend>/api/webhooks/resend\nRESEND_WEBHOOK_SECRET=<secreto de firma whsec_...>\nMAIL_WEBHOOK_SOURCE=provider')
p('El secreto del webhook verifica quién envió el aviso; no sirve para enviar correos. Es distinto de RESEND_API_KEY. No habilitar eventos de apertura o clic como parte de esta implementación. Probar firma y recepción antes de confiar en los estados del panel.')
h('Comprobación práctica')
p('En un entorno de prueba, solicitar recuperación a un buzón controlado, abrir el enlace correcto y comprobar que no puede reutilizarse. Con el webhook configurado, revisar Administración → Seguridad y distinguir aceptación, entrega y fallo. No confundir ausencia de eventos con ausencia de problemas.')

page('Claves de MFA cola y CAPTCHA')
h('Claves internas de cifrado')
p('MFA y la cola no obtienen estas claves desde una API: se generan localmente con aleatoriedad criptográfica. Ejecutar el siguiente comando en una terminal privada una vez para MFA y otra vez para la cola; los resultados deben ser diferentes. Guardarlos en un gestor de secretos, separado de MongoDB.')
code('node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'base64\'))"')
table(['Mecanismo','Variables del backend'],[
('MFA','MFA_ENCRYPTION_KEYS={"v1":"<clave MFA en base64>"}\nMFA_ACTIVE_KEY_ID=v1\nADMIN_MFA_REQUIRED=false'),
('Cola de correo','MAIL_QUEUE_ENCRYPTION_KEYS={"v1":"<otra clave en base64>"}\nMAIL_QUEUE_ACTIVE_KEY_ID=v1\nMAIL_QUEUE_ENABLED=false')],[1.2,5.4])
p('Los valores entre < > son marcadores, no claves utilizables. En el panel del alojamiento se introduce el objeto JSON como valor de la variable. No reutilizar JWT_SECRET. API y worker deben compartir el mismo llavero de cola.')
p('Para rotar, añadir una versión nueva y cambiar el identificador activo conservando las versiones antiguas mientras existan datos cifrados con ellas. MFA no tiene migración masiva automática. Perder el llavero puede impedir acceso MFA o entrega de mensajes; cambiar la contraseña no resuelve esa pérdida.')
h('Cloudflare Turnstile')
p('Crear un widget Managed en Turnstile y autorizar el hostname del frontend: koinonia-yvr2.onrender.com, sin https:// ni rutas. Cloudflare entrega una site key pública y una secret key privada. La primera identifica el widget; la segunda valida tokens desde el servidor. [3]')
code('TURNSTILE_SITE_KEY=<clave pública del widget>\nTURNSTILE_SECRET_KEY=<clave secreta del widget>\nTURNSTILE_HOSTNAMES=koinonia-yvr2.onrender.com\nCAPTCHA_MODE=off\nADVANCED_ABUSE_MODE=observe')
p('Koinonía recibe ambas claves desde la configuración del backend y solo expone la pública cuando necesita mostrar el widget. Para una activación futura: observe, prueba aislada y después enforce. No usar claves de prueba en producción. En modo obligatorio, un fallo del proveedor no debe permitir saltarse el desafío.')
h('Configuración que no requiere una nueva API')
p('Límites, observación de abuso y mantenimiento utilizan MongoDB y políticas internas. TRUST_PROXY_CIDRS o TRUST_PROXY_HOPS dependen de la topología real del alojamiento: no inventar valores ni confiar en cualquier X-Forwarded-For. JWT_SECRET ya firma sesiones; no cambiarlo como parte de esta guía. MONGO_URI conserva las credenciales de acceso a la base.')

page('Operación gradual y documentación de apoyo')
h('Valores que deben conservarse durante el piloto')
code('EMAIL_VERIFICATION_REQUIRED=false\nADMIN_MFA_REQUIRED=false\nCAPTCHA_MODE=off\nMAIL_QUEUE_ENABLED=false\nADVANCED_ABUSE_MODE=observe\nSECURITY_CLEANUP_MODE=off\nSECURITY_ACCOUNT_DELETION_ENABLED=false')
p('Los representantes mantienen acceso y el administrador conserva la contraseña provisional opcional. Estas políticas pertenecen al servidor; el navegador no puede desactivarlas ni se dispone de un interruptor general que elimine todas las protecciones.')
h('Cómo activar y cómo volver atrás')
p('Correo: comprobar entrega y acceso administrativo antes de exigir verificación. Volver a false pausa la obligación sin marcar cuentas como verificadas. MFA: probar inscripción, códigos de recuperación y otro acceso administrativo antes de exigirlo globalmente; volver a false no desactiva MFA voluntario.')
p('CAPTCHA: probar observe y luego enforce en un entorno controlado; volver a off conserva las cuotas. Cola: configurar el llavero, habilitarla y ejecutar npm run worker:mail desde Backend. Detener el worker conserva pendientes; volver a false usa envío directo solo para nuevas solicitudes, sin reenviar automáticamente lo acumulado.')
p('Mantenimiento: ejecutar npm run maintenance:security -- --dry-run desde Backend y revisar conteos. La aplicación requiere habilitar apply y ejecutar explícitamente --apply. Volver a off impide nuevos lotes, pero no recupera datos purgados ni apaga los TTL operativos de MongoDB. Nunca elimina cuentas. Webhook: retirar su configuración del proveedor y servidor detiene la recepción, no el envío de correo.')
h('Retenciones predeterminadas')
p('Tras el vencimiento: tokens 24 horas, desafíos MFA 60 minutos, contadores 1 hora y registros CAPTCHA 24 horas. Trabajos terminales de correo: 7 días desde terminar; eventos del proveedor: 7 días desde recepción; auditorías de mantenimiento: 90 días. Son plazos configurables, con purga eventual. Los trabajos activos quedan excluidos. Detalle y nombres de variables: security-maintenance.md.')
h('Evidencia y pendientes')
p('La revisión previa documentó 52 casos distintos de backend aprobados, tres recorridos de navegador y compilación correcta. Fueron pruebas aisladas y simuladas, no una certificación del despliegue. Quedan la configuración y comprobación externa de proveedor, widget, webhook, worker y respaldos. La protección volumétrica externa y la eliminación futura de cuentas no están resueltas por estas pruebas.')
h('Documentación local recopilada')
p('En Backend/docs: account-security.md; admin-mfa.md; abuse-observation.md; adaptive-captcha.md; mail-queue.md; mail-observability.md; security-maintenance.md; security-review.md. Configuración contrastada con src/config/env.js y src/config/retention.js. La retención actual prevalece sobre referencias antiguas al TTL corto de CAPTCHA.')
h('Referencias oficiales de configuración')
link('[1] Resend — permisos y claves API','https://resend.com/docs/api-reference/api-keys/create-api-key')
link('[2] Resend — configuración de webhooks','https://resend.com/docs/webhooks/introduction')
link('[3] Cloudflare — claves y configuración de Turnstile','https://developers.cloudflare.com/turnstile/get-started/')
d.core_properties.title='Seguridad de Koinonía';d.core_properties.subject='Funciones y configuración de las implementaciones recientes';d.core_properties.author='Koinonía'
out.parent.mkdir(parents=True,exist_ok=True);d.save(out);print(out.resolve())
