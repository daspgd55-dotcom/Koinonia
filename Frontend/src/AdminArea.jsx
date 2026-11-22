import {reportRecoverable} from './recoverableError';
import React,{lazy,useEffect,useState} from 'react';
import {api} from './api';
import ManualDownload,{manualRole} from './ManualDownload';
const Manage = lazy(() => import('./Manage'));
const SecurityMail = lazy(()=>import('./SecurityMail'));
const Users = lazy(() => import('./Users'));
const ExperienceModeration = lazy(() => import('./Experiences').then(module => ({default:module.ExperienceModeration})));
const Visits=lazy(()=>import('./Visits'));
export default function AdminArea({route,token,user}) {
  const [churchPermissions,setChurchPermissions]=useState(null);
  const [permissions,setPermissions]=useState([]);useEffect(()=>{let live=true;const controller=new AbortController();api('/churches/management-permissions',{token,background:true,signal:controller.signal}).then(r=>{if(live)setPermissions(r.permissions);}).catch(()=>{if(live){setPermissions([]);reportRecoverable('admin.permissions');}});return()=>{live=false;controller.abort();};},[token,route]);
  const security=route==='/administracion/seguridad',users=route==='/administracion/usuarios',experiences=route==='/administracion/experiencias',visits=route.startsWith('/administracion/visitas');
  if((users||security)&&user.role!=='admin')return <main className="narrow"><h1>Acceso restringido</h1><a href="#/administracion">Volver a mis comunidades</a></main>;
  const manualDownload=<ManualDownload role={user.role==='admin'?'administrator':manualRole(churchPermissions||permissions)}/>;
  return <>{(users||security||experiences||visits)&&manualDownload}{<nav className="admin-area-nav" aria-label="Áreas de administración">{user.role==='admin'&&<><a href="#/administracion/invitaciones">Invitaciones a iglesias</a><a href="#/administracion/inscripciones">Inscripciones</a></>}<a href="#/administracion" aria-current={!users&&!security&&!experiences&&!visits?'page':undefined}>Comunidades</a>{user.role==='admin'&&<a href="#/administracion/usuarios" aria-current={users?'page':undefined}>Usuarios</a>}{user.role==='admin'&&<a href="#/administracion/seguridad" aria-current={security?'page':undefined}>Seguridad</a>}{(user.role==='admin'||permissions.includes('moderation'))&&<a href="#/administracion/experiencias" aria-current={experiences?'page':undefined}>Experiencias</a>}{(user.role==='admin'||permissions.includes('visits'))&&<a href="#/administracion/visitas" aria-current={visits?'page':undefined}>Visitas</a>}</nav>}{security?<SecurityMail token={token}/>:visits?<Visits key={route} manage history={route.endsWith('/historial')}/>:experiences?<ExperienceModeration token={token}/>:users?<Users token={token} user={user}/>:<Manage manualDownload={manualDownload} onPermissionsChange={setChurchPermissions} token={token} user={user} initialChurchId={new URLSearchParams(route.split('?')[1]||'').get('iglesia')||''}/>}</>;
}
