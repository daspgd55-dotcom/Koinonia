// Presentación únicamente: el servidor sigue determinando los permisos efectivos.
export const rolePriority=[['church','administrator'],['moderation','moderator'],['content','editor'],['visits','welcome']];
export const roles={
 administrator:{manual:'Administrador',title:'Administrador de iglesia',label:'Representante administrador',description:'Administra la ficha, comunidades, eventos, experiencias, visitas y equipo. Su designación corresponde al administrador global.'},
 editor:{manual:'Editor',title:'Editor de comunidades y eventos',label:'Editor',description:'Edita comunidades vinculadas y eventos. No edita la ficha principal ni accede a visitas.'},
 moderator:{manual:'Moderador',title:'Moderador',label:'Moderador',description:'Modera experiencias y gestiona visitas. No edita la ficha ni el equipo.'},
 welcome:{manual:'Bienvenida',title:'Equipo de bienvenida',label:'Bienvenida',description:'Gestiona visitas. No edita contenido ni modera experiencias.'}
};
export const roleFromPermissions=(permissions=[])=>rolePriority.find(([permission])=>permissions.includes(permission))?.[1]||null;
export const representativeRole=(permissions=[])=>roles[roleFromPermissions(permissions)]?.title||'Representante';

export const teamRoleLabels={administrator:roles.administrator.label,moderator:'Moderador · Experiencias y visitas',editor:'Editor · Comunidades y eventos',welcome:'Bienvenida · Visitas'};
export const outreachRoleLabels={administrator:roles.administrator.label,editor:'Editor · comunidades y eventos',moderator:'Moderador · experiencias y visitas',welcome:'Bienvenida · visitas'};
export const memberRoleLabels={administrator:'Representante administrador: ficha, contenido, experiencias, visitas y equipo',editor:'Editor: comunidades vinculadas y eventos',moderator:'Moderador: experiencias y visitas',welcome:'Bienvenida: visitas'};
