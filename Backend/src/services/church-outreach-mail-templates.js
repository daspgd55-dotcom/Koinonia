const version='institutional-mail-1',roles={administrator:'Representante administrador: ficha de la iglesia, comunidades y eventos, experiencias, visitas y equipo',editor:'Editor: comunidades vinculadas y eventos; no edita la ficha principal ni gestiona visitas',moderator:'Moderador: experiencias y visitas',welcome:'Bienvenida: visitas'};
function render({kind,church,role,source,clarification,reminder,link,manualUrl}){
 const name=church.identification.name,place=[church.location?.commune,church.location?.city].filter(Boolean).join(', '),manual=manualUrl?'\nManual de apoyo: '+manualUrl+'\n':'';
 if(kind==='member')return {version,subject:(reminder?'Recordatorio: ':'')+'Tu invitación al equipo de '+name+' · Koinonía',text:`Hola:

Koinonía es una aplicación para descubrir iglesias, comunidades cristianas y eventos y mantener sus perfiles actualizados. El administrador revisó una propuesta para que colabores con ${name}${place?' ('+place+')':''}.

Función aprobada: ${roles[role]}.

El acceso todavía no está activo. Revisa la invitación y acepta con una cuenta del correo destinatario, o crea tu cuenta mediante el registro habitual. Debes completar la verificación de correo y el segundo factor cuando tu cuenta lo requiera. Si es un equipo nuevo, primero debe aceptar una persona administradora.

Enlace personal: ${link}

Abrir el enlace no acepta la invitación. Puedes rechazarla desde la misma pantalla. No compartas el enlace. Si ya perteneces al equipo, se conservan tus permisos salvo un cambio administrativo expresamente aprobado. Después de aceptar deberás iniciar sesión nuevamente. No se publica, restaura ni verifica automáticamente la iglesia.
${manual}
Este mensaje se limita a tu incorporación; no es una suscripción a publicidad. Si el enlace venció o no te corresponde, solicita revisión al equipo que te invitó.

Equipo Koinonía`};
 const reason={institutional_website:'un contacto registrado desde el sitio institucional',institutional_social:'un contacto registrado desde una red institucional',direct_contact:'un contacto obtenido de forma directa',administrative_record:'un contacto registrado en nuestros antecedentes administrativos'}[source]||'un contacto institucional registrado';
 return {version,subject:(reminder?'Recordatorio: ':'')+'Invitación a completar la información de '+name+' · Koinonía',text:`Hola:

Somos Koinonía, una iniciativa personal para descubrir iglesias, comunidades cristianas y eventos y facilitar el encuentro con sus comunidades.

Contactamos a ${name}${place?' ('+place+')':''} porque su ficha ya existe en nuestra base y queremos revisar y enriquecer su información con colaboración de la propia iglesia. Este correo procede de ${reason}; ese antecedente puede necesitar corrección y no acredita autoridad institucional.

Buscamos completar información como ubicación, horarios de reuniones, actividades, comunidades vinculadas y condiciones de accesibilidad, además de mantener actualizados los datos públicos de contacto.

Los pasos son: reconocer la iglesia precargada, proponer personas y funciones para su equipo, y revisar la propuesta y las condiciones de participación. Quien coordina la respuesta no necesita convertirse en representante. Después, un administrador revisará los antecedentes; cada persona aprobada deberá aceptar su invitación con su propia cuenta antes de activar acceso.
${clarification?'\nAclaración solicitada por el administrador:\n'+clarification+'\n':''}
Enlace personal para este contacto: ${link}

Abrirlo no acepta ni registra una respuesta. No lo compartas: recibirlo no concede permisos. Para informar una iglesia incorrecta, rechazar o pedir que no volvamos a contactar este correo por esta iglesia, pulsa «Comenzar» y abre «La iglesia no corresponde u otro problema». No tendrás que elegir otra iglesia ni aceptar términos para retirarte.
${manual}
Esta comunicación corresponde únicamente a esta invitación, no suscribe a publicidad. Si el enlace venció, solicita revisión al equipo que te contactó.

Equipo Koinonía`};
}
module.exports={render,version};
