import UsernameField from './UsernameField';
import Captcha from './Captcha';
import {MfaChallenge} from './Mfa';
import FormValidation from './FormValidation';
import ActionFeedback from './ActionFeedback';
import {prepareAddress} from './prepareAddress';
import PageMotion from './PageMotion';
import Navigation from './Navigation';
import {SessionContext} from './Membership';
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, storage } from './api';
import { fields, steps, profileSections, fromUser, restoreDraft, hasValue, patchFromDraft, displayValue, asksDenomination } from './profile';
import Question from './Question';
const Friends = lazy(() => import('./Friends'));
const Collaborations = lazy(() => import('./Collaborations'));
const MyEvents = lazy(() => import('./EventParticipation'));
const PublicEvents = lazy(() => import('./PublicEvents'));
const PublicEvent = lazy(() => import('./PublicEvents').then(m=>({default:m.PublicEvent})));
const PublicCommunity = lazy(() => import('./PublicCommunity'));
const Visits = lazy(() => import('./Visits'));
const Notifications = lazy(() => import('./Visits').then(module => ({default:module.Notifications})));
const ProfileHome = lazy(() => import('./ProfileHome'));
const Experiences = lazy(() => import('./Experiences'));
const ExperienceModeration = lazy(() => import('./Experiences').then(module => ({default:module.ExperienceModeration})));
const Saved = lazy(() => import('./Saved'));
const VerifyEmail = lazy(()=>import('./VerifyEmail'));
const Account = lazy(() => import('./Account'));
const Explore = lazy(() => import('./Explore'));
const Manage = lazy(() => import('./Manage'));
const SecurityMail = lazy(()=>import('./SecurityMail'));
const Users = lazy(() => import('./Users'));
const Discover = lazy(() => import('./Discover'));
function AdminArea({route,token,user}) {
  const security=route==='/administracion/seguridad',users=route==='/administracion/usuarios',experiences=route==='/administracion/experiencias',visits=route.startsWith('/administracion/visitas');
  if((users||security)&&user.role!=='admin')return <main className="narrow"><h1>Acceso restringido</h1><a href="#/administracion">Volver a mis comunidades</a></main>;
  return <>{<nav className="admin-area-nav" aria-label="Áreas de administración"><a href="#/administracion" aria-current={!users&&!security&&!experiences&&!visits?'page':undefined}>Comunidades</a>{user.role==='admin'&&<a href="#/administracion/usuarios" aria-current={users?'page':undefined}>Usuarios</a>}{user.role==='admin'&&<a href="#/administracion/seguridad" aria-current={security?'page':undefined}>Seguridad</a>}<a href="#/administracion/experiencias" aria-current={experiences?'page':undefined}>Experiencias</a><a href="#/administracion/visitas" aria-current={visits?'page':undefined}>Primeras visitas</a></nav>}{security?<SecurityMail token={token}/>:visits?<Visits key={route} manage history={route.endsWith('/historial')}/>:experiences?<ExperienceModeration token={token}/>:users?<Users token={token} user={user}/>:<Manage token={token} user={user}/>}</>;
}
import './styles.css';

const go = route => { location.hash = route; };
const draftKey = id => 'koinonia-draft-' + id;
function Brand() { return <a className="brand" href="#/" aria-label="Koinonía, inicio"><img src="/logo.png" alt=""/><span>Koinonía<small>COMUNIDADES Y VÍNCULOS</small></span></a>; }
function Notice({ children, error = false }) { return children ? <div className={'notice ' + (error ? 'error' : '')} role={error ? 'alert' : 'status'}>{children}</div> : null; }
function Landscape() { return <div className="landscape" aria-hidden="true"><div className="sun"/><div className="mountain back"/><div className="mountain"/><div className="chapel"><div className="cross">✝</div><div className="door"/></div><div className="path"/><span>UN LUGAR PARA ENCONTRARNOS</span></div>; }
function Auth({ register, onSession, message }) {
  const [challenge,setChallenge]=useState(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''),[pending,setPending]=useState(false),[needsVerification,setNeedsVerification]=useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget), email = form.get('email').trim(), password = form.get('password');
    let created = false;
    try {
      if (register) {
        if (new TextEncoder().encode(password).length > 72) throw Error('La contraseña supera el máximo de 72 bytes. Usa una más corta.');
        const registration=await api('/auth/register', { method: 'POST', body: { email, password, username:form.get('username').trim().toLowerCase(), ...(form.get('name').trim() ? { name: form.get('name').trim() } : {}) } }); if(registration.verificationRequired){setPending(registration.message);return;} created = true;
      }
      const result = await api('/auth/login', { method: 'POST', body: { email, password } }); if(result.mfaRequired){setChallenge(result.challenge);return;}onSession(result, created);
    } catch (e) {setNeedsVerification(e.code==='EMAIL_VERIFICATION_REQUIRED'); setError(created ? 'Tu cuenta ya está creada. Inicia sesión para continuar; no necesitas volver a registrarte.' : e.code==='USERNAME_TAKEN'?e.message:e.status === 409 ? 'El correo o nombre de usuario ya está en uso.' : e.status === 401 ? 'El correo o la contraseña no coinciden.' : e.message); }
    finally { setBusy(false); }
  }
  if(challenge)return <MfaChallenge challenge={challenge} onSession={onSession} onBack={()=>setChallenge(null)}/>;
  return <main className="auth-layout"><section className="auth-story"><span className="eyebrow">TU CAMINO, TU COMUNIDAD</span><h1>Los vínculos<br/>empiezan con<br/><em>un encuentro.</em></h1><p>Un espacio para conocer comunidades cristianas y descubrir dónde te gustaría participar.</p><Landscape/></section><section className="auth-card"><span className="eyebrow">BIENVENIDO A KOINONÍA</span><h2>{register ? 'Crea tu cuenta' : 'Inicia sesión'}</h2><p>{register ? 'Crea tu cuenta. Después podrás contarnos qué buscas, a tu ritmo.' : 'Entra para continuar donde lo dejaste.'}</p><Notice>{message}</Notice>{pending&&<Notice>{pending} Si ya tenías una, inicia sesión o recupera tu contraseña. <a href="#/verificar-correo">Reenviar enlace</a></Notice>}<Notice error>{error}</Notice>{needsVerification&&<p><a href="#/verificar-correo">Verificar mi correo</a></p>}<form onSubmit={submit}>
    <fieldset disabled={busy}>{register && <label>Nombre <span className="optional">opcional</span><input name="name" autoComplete="name" maxLength={100} placeholder="¿Cómo te llamas?"/></label>}
    {register&&<UsernameField/>}<label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="tu@correo.cl"/></label>
    <label>Contraseña<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : 1} maxLength={72}/></label>{register && <small>Usa al menos 8 caracteres.</small>}
    <button className="primary full" type="submit">{busy ? 'Un momento…' : register ? 'Crear mi cuenta →' : 'Iniciar sesión →'}</button></fieldset></form>
    <p><a href="#/recuperar">¿Olvidaste tu contraseña?</a></p><p className="auth-switch">{register ? '¿Ya tienes una cuenta?' : '¿Primera vez por aquí?'} <a href={register ? '#/login' : '#/registro'}>{register ? 'Inicia sesión' : 'Crea tu cuenta'}</a></p>
    <div className="privacy-note">Tu nombre público, usuario y foto permiten que tus amigos te encuentren. Tu correo y preferencias no se muestran en la búsqueda.</div></section></main>;
}
function App() {
  const [route,setRoute] = useState(location.hash.slice(1) || '/'), [token,setToken] = useState(storage.get('koinonia-session') || ''), [user,setUser] = useState(null);
  const discoveryRoute=route.startsWith('/descubrir'),exploreRoute=route==='/explorar'||route.startsWith('/iglesia/');
  const [discoveryMounted,setDiscoveryMounted]=useState(discoveryRoute),[exploreMounted,setExploreMounted]=useState(exploreRoute);
  const [loading,setLoading] = useState(!!token), [busy,setBusy] = useState(false), [error,setError] = useState(''), [message,setMessage] = useState('');
  const [draft,setDraft] = useState(null), [conflict,setConflict] = useState(false), [section,setSection] = useState(0);
  const titleRef = useRef(null);
  const [locationPending,setLocationPending] = useState(false);
  useEffect(() => { const handle = () => { setRoute(location.hash.slice(1) || '/'); setError(''); }; window.addEventListener('hashchange',handle); return () => window.removeEventListener('hashchange',handle); },[]);
  useEffect(()=>{if(discoveryRoute)setDiscoveryMounted(true);if(exploreRoute)setExploreMounted(true);},[discoveryRoute,exploreRoute]);
  useEffect(() => { if(user && draft) storage.set(draftKey(user.id),draft); },[user,draft]);
  useEffect(() => { const handle = e => { if(draft?.dirty.length) {e.preventDefault();e.returnValue='';} }; window.addEventListener('beforeunload',handle); return () => window.removeEventListener('beforeunload',handle); },[draft]);
  useEffect(() => { titleRef.current?.focus(); },[route,draft?.step,section]);
  function adopt(profile) { setUser(profile); setDraft(restoreDraft(profile,storage.get(draftKey(profile.id)))); }
  async function restore() {
    setLoading(true);setError('');
    try { adopt((await api('/users/me',{token})).data); }
    catch(e) {if((e.status===401||e.code==='EMAIL_VERIFICATION_REQUIRED')&&['/verificar-correo','/aceptar-invitacion','/restablecer'].some(p=>route.startsWith(p))){storage.remove('koinonia-session');setToken('');setUser(null);setError('');}else if(e.status===401)expire();else if(e.code==='EMAIL_VERIFICATION_REQUIRED'){storage.remove('koinonia-session');setToken('');setUser(null);setError('');go('/verificar-correo');}else setError(e.message);} finally {setLoading(false);}
  }
  useEffect(() => {if(token)restore();},[]);
  function expire() {storage.remove('koinonia-session');setToken('');setUser(null);setDraft(null);setMessage('Tu sesión terminó. Inicia sesión para recuperar tus respuestas.');go('/login');}
  function session(result, created = false) {storage.set('koinonia-session',result.token);setToken(result.token);adopt(result.data);setMessage('');go(result.mfaEnrollmentRequired?'/cuenta':created?'/encuesta':route.startsWith('/guardadas')?'/guardadas':route.startsWith('/colaboraciones')||route.startsWith('/amigos')?route:route.startsWith('/login?evento=')?'/evento/'+route.split('=')[1]:route.startsWith('/login?visita=')?'/iglesia/'+route.split('=')[1]:route.startsWith('/login?experiencias=')?'/experiencias/'+route.split('=')[1]:'/descubrir');}
  async function logout() {if(draft?.dirty.length && !(await save('stay')))return;if(user)storage.remove(draftKey(user.id));storage.remove('koinonia-session');setToken('');setUser(null);setDraft(null);setMessage('');go('/');}
  function change(key,{value,state,mode}) {
    setError('');setMessage('');setDraft(previous=>({...previous,
      values:{...previous.values,...(value!==undefined?{[key]:value}:{}),...(['address','commune'].includes(key)&&value!==undefined&&value!==previous.values[key]?{addressSelection:null}:{})},
      states:{...previous.states,...(state?{[key]:state}:{})},
      modes:{...previous.modes,...(mode?{[key]:mode}:value!==undefined && hasValue(value) && previous.modes[key]==='disabled'?{[key]:'preferred'}:{})},
      dirty:[...new Set([...previous.dirty,key])]}));
  }
  async function save(action='next') {
    if (locationPending) return false;
    setError('');setMessage('');setBusy(true);
    const nextStep = action==='next'?Math.min(draft.step+1,2):draft.step;
    const status = action==='complete'?'completed':action==='later'?'skipped':user.onboarding?.status==='completed'?'completed':'pending';
    const onboarding = ['settings','stay'].includes(action)?undefined:{version:3,status,lastStep:action==='complete'?3:nextStep};
    try {
      const prepared=await prepareAddress(draft,body=>api('/users/me/address/resolve',{token,method:'POST',body}));
      const result = await api('/users/me',{token,method:'PATCH',body:patchFromDraft(prepared,onboarding)});
      setUser(result.data);setDraft({...fromUser(result.data),step:nextStep});setConflict(false);
      if(action==='complete'||action==='later') {setMessage(action==='complete'?'Tu perfil inicial está listo. Puedes ajustar tus preferencias de búsqueda desde Mi perfil.':'Guardamos tus respuestas. Puedes continuar cuando quieras.');go('/descubrir');}
      else setMessage(action==='settings'?'Configuración guardada.':'Avance guardado.');
      return true;
    } catch(e) {if(e.status===401)expire();else {setError(e.message);if(e.status===409)setConflict(true);}return false;} finally {setBusy(false);}
  }
  async function reconcile() {
    setBusy(true);setError('');
    try {const remote=(await api('/users/me',{token})).data,merged=fromUser(remote);
      for(const key of draft.dirty){merged.values[key]=draft.values[key];merged.states[key]=draft.states[key];merged.modes[key]=draft.modes[key];}
      setUser(remote);setDraft({...merged,dirty:draft.dirty,step:draft.step});setConflict(false);setMessage('Cargamos los cambios recientes y conservamos tus ediciones pendientes. Revísalas antes de volver a guardar.');
    } catch(e){if(e.status===401)expire();else setError(e.message);}finally{setBusy(false);}
  }
  function openSettings(index=0) {
    setSection(index);
    // En la nueva interfaz una casilla desmarcada significa preferencia. Conserva los valores legados.
    setDraft(previous=>{const next={...previous,modes:{...previous.modes},dirty:[...previous.dirty]};
      for(const key of Object.keys(fields)) if(hasValue(previous.values[key]) && previous.states[key]==='answered' && previous.modes[key]==='disabled' && !fields[key].context && !fields[key].location){next.modes[key]='preferred';next.dirty.push(key);}
      return {...next,dirty:[...new Set(next.dirty)]};});go('/configuracion');
  }
  function identitySaved(profile,revision){setUser(profile);setDraft(d=>d?.revision===revision?{...d,revision:profile.profileRevision}:d);}
  async function discardPreferences(){
    if(!window.confirm('¿Descartar las respuestas de preferencias que aún no has guardado? Los datos guardados se conservarán.'))return;
    setBusy(true);setError('');try{const profile=(await api('/users/me',{token})).data;setUser(profile);setDraft(fromUser(profile));storage.remove(draftKey(profile.id));setConflict(false);setMessage('Cambios locales de preferencias descartados.');}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const survey=route==='/encuesta'&&user&&draft, settings=route==='/configuracion'&&user&&draft;
  const notices=<><Notice error>{error}</Notice><Notice>{message}</Notice>{conflict&&<button className="secondary" onClick={reconcile} disabled={busy||locationPending}>Recargar y conservar mis ediciones</button>}</>;
  return <SessionContext.Provider value={{user,token,onUser:setUser}}><FormValidation/><Navigation route={route} token={token} user={user} logout={logout} busy={busy||locationPending}><Brand/></Navigation>
    <Suspense fallback={<main className="loading" role="status"><span className="spinner"/>Cargando…</main>}><PageMotion route={route}>{discoveryMounted&&<div hidden={!discoveryRoute}><Discover route={route} user={user} token={token}/></div>}
    {exploreMounted&&<div hidden={!exploreRoute}><Explore route={route} user={user}/></div>}
    {(route.startsWith('/verificar-correo')||route.startsWith('/aceptar-invitacion'))?<VerifyEmail key={route} route={route}/>:(route==='/eventos'||route.startsWith('/eventos?'))?<PublicEvents route={route}/>:route.startsWith('/evento/')?<PublicEvent key={route} route={route}/>:route.startsWith('/comunidad/')?<PublicCommunity key={route} id={route.slice('/comunidad/'.length)}/>:route.startsWith('/experiencias/')?<Experiences key={user?.id+'-'+route} id={route.split('/')[2]} token={token} user={user}/>:route==='/recuperar'||route.startsWith('/restablecer')||route==='/cuenta'&&user?<Account user={user} onMfaChanged={()=>{expire();setMessage('Seguridad actualizada. Inicia sesión de nuevo.');}} key={route} route={route} token={route==='/cuenta'?token:undefined} onChanged={()=>{expire();setMessage('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');}}/>:route.startsWith('/descubrir')||route==='/explorar'||route.startsWith('/iglesia/')?null:['/administracion','/administracion/seguridad','/administracion/usuarios','/administracion/experiencias','/administracion/visitas','/administracion/visitas/historial'].includes(route)&&!loading&&user?(['admin','representative'].includes(user.role)?<AdminArea key={user.id} route={route} token={token} user={user}/>:<main className="narrow"><h1>Acceso restringido</h1><p>Esta sección requiere un rol de representante o administrador.</p><a href="#/explorar">Volver a explorar</a></main>):loading?<main className="loading" role="status"><span className="spinner"/>Recuperando tu perfil…</main>:token&&!user?<main className="narrow"><Notice error>{error}</Notice><button className="primary" onClick={restore}>Reintentar conexión</button><button className="text-button" onClick={logout}>Volver al inicio</button></main>:!user&&(route.startsWith('/amigos')||route.startsWith('/colaboraciones')||route==='/mis-eventos'||route.startsWith('/login?evento=')||route.startsWith('/login?visita=')||route.startsWith('/login?experiencias=')||route.startsWith('/guardadas')||['/visitas','/visitas/historial','/notificaciones','/login','/registro','/encuesta','/perfil','/configuracion','/cuenta','/administracion','/administracion/usuarios','/administracion/experiencias','/administracion/visitas','/administracion/visitas/historial'].includes(route))?<Auth key={route} register={route==='/registro'} onSession={session} message={message}/>:user&&route.startsWith('/amigos')?<Friends key={user.id} route={route}/>:user&&route.startsWith('/colaboraciones')?<Collaborations route={route}/>:user&&route==='/mis-eventos'?<MyEvents key={user.id}/>:user&&['/visitas','/visitas/historial'].includes(route)?<Visits key={user.id+route} history={route.endsWith('/historial')}/>:user&&route==='/notificaciones'?<Notifications key={user.id}/>:user&&route.startsWith('/guardadas')?<Saved key={user.id} user={user} token={token} route={route}/>:survey?<main className="survey-layout compact-survey"><aside className="steps-sidebar"><span className="eyebrow">SOLO LO ESENCIAL</span><h2>Un primer paso.<br/>A tu manera.</h2><p>Tres fases para empezar.<br/>El resto puede esperar.</p><ol>{steps.map((s,i)=><li key={s.title}><button disabled={busy||locationPending} aria-current={draft.step===i?'step':undefined} onClick={()=>{setDraft({...draft,step:i});setError('');}}><span>{i+1}</span>{s.title}</button></li>)}</ol><div className="sidebar-note">Más adelante podrás añadir intereses, actividades y otros detalles desde tu perfil.</div></aside><section className="survey-main"><div className="step-meta"><span>PASO {draft.step+1} DE 3</span><span>{draft.dirty.length?'Cambios sin guardar':'Avance guardado'}</span></div><div className="progress" role="progressbar" aria-label="Avance de la encuesta" aria-valuemin={0} aria-valuemax={3} aria-valuenow={draft.step+1}><span style={{width:`${(draft.step+1)/3*100}%`}}/></div><h1 ref={titleRef} tabIndex={-1}>{steps[draft.step].heading}</h1><p className="intro">{steps[draft.step].description}</p>{notices}<div className="question-card">{steps[draft.step].fields.filter(key=>key!=='denominations'||asksDenomination(draft.values.branches)).map(key=><Question key={key} fieldKey={key} draft={draft} change={change} busy={busy} onLocationPending={setLocationPending}/>)}</div><div className="survey-actions"><button className="secondary" disabled={busy||locationPending||draft.step===0} onClick={()=>setDraft({...draft,step:draft.step-1})}>← Atrás</button><button className="primary" disabled={busy||locationPending||conflict} onClick={()=>save(draft.step===2?'complete':'next')}>{busy?'Guardando…':draft.step===2?'¡Empecemos!':'Guardar y continuar →'}</button></div><ActionFeedback error={error}/><button className="text-button postpone" disabled={busy||locationPending||conflict} onClick={()=>save('later')}>Guardar y completar después</button></section></main>:settings?<main className="settings-page"><div className="settings-heading"><a href="#/perfil">← Volver a mi perfil</a><span className="eyebrow">A TU RITMO, CON MÁS DETALLE</span><h1 ref={titleRef} tabIndex={-1}>Preferencias de búsqueda</h1><p>Amplía tus preferencias cuando quieras. Marca “Usar este valor como una restricción” solo cuando sea indispensable; sin marcar, será una preferencia.</p></div>{notices}<div className="settings-layout"><nav className="settings-nav" aria-label="Secciones del perfil">{profileSections.map((s,i)=><button key={s.title} type="button" disabled={busy||locationPending} aria-current={section===i?'page':undefined} onClick={()=>setSection(i)}>{s.title}</button>)}</nav><section className="settings-body"><h2>{profileSections[section].title}</h2><div className="question-card">{profileSections[section].fields.filter(key=>key!=='denominations'||asksDenomination(draft.values.branches)).map(key=><Question key={key} fieldKey={key} draft={draft} change={change} busy={busy} settings onLocationPending={setLocationPending}/>)}</div><div className="settings-save">{draft.dirty.length>0&&<button type="button" className="secondary" disabled={busy||locationPending} onClick={discardPreferences}>Descartar cambios</button>}<span role="status">{draft.dirty.length?'Tienes cambios sin guardar':'Todo guardado'}</span><button className="primary" disabled={busy||locationPending||conflict||!draft.dirty.length} onClick={()=>save('settings')}>{busy?'Guardando…':'Guardar configuración'}</button></div><ActionFeedback error={error}/></section></div></main>:user&&route==='/perfil'?<ProfileHome key={user.id} user={user} token={token} titleRef={titleRef} notices={notices} draft={draft} onSaved={identitySaved} onRefresh={setUser} openSettings={openSettings}/>:<main className="home"><section><span className="eyebrow">ENCUENTRA TU LUGAR</span><h1>Una comunidad<br/>para caminar<br/><em>en la fe.</em></h1><p>Conoce iglesias, sus creencias, horarios y actividades. Encuentra opciones para preparar tu primera visita.</p><div className="home-actions"><a className="primary" href="#/explorar">Explorar comunidades →</a><a className="secondary" href={user?'#/descubrir':'#/registro'}>{user?'Ver recomendaciones →':'Crear mi perfil →'}</a>{user&&<a className="secondary" href="#/guardadas">Iglesias guardadas →</a>}</div><span className="home-note">Puedes explorar sin crear una cuenta.</span></section><Landscape/><div className="home-bottom"><span>01 <strong>Busca por comuna</strong></span><span>02 <strong>Conoce sus creencias y actividades</strong></span><span>03 <strong>Prepara tu visita</strong></span></div></main>}
    </PageMotion></Suspense><footer><span>Koinonía <i>·</i> Comunidades y vínculos</span><span>Un encuentro comienza con un primer paso.</span></footer></SessionContext.Provider>;
}
createRoot(document.getElementById('root')).render(<><App/><Captcha/></>);
