import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, storage } from './api';
import { fields, steps, profileSections, fromUser, restoreDraft, hasValue, patchFromDraft, displayValue, asksDenomination } from './profile';
import Question from './Question';
import Account from './Account';
import Explore from './Explore';
import Manage from './Manage';
import Users from './Users';
import Discover from './Discover';
function AdminArea({route,token,user}) {
  const users=route==='/administracion/usuarios';
  if(users&&user.role!=='admin')return <main className="narrow"><h1>Acceso restringido</h1><a href="#/administracion">Volver a mis comunidades</a></main>;
  return <>{user.role==='admin'&&<nav className="admin-area-nav" aria-label="Áreas de administración"><a href="#/administracion" aria-current={!users?'page':undefined}>Comunidades</a><a href="#/administracion/usuarios" aria-current={users?'page':undefined}>Usuarios</a></nav>}{users?<Users token={token} user={user}/>:<Manage token={token} user={user}/>}</>;
}
import './styles.css';

const go = route => { location.hash = route; };
const draftKey = id => 'koinonia-draft-' + id;
function Brand() { return <a className="brand" href="#/" aria-label="Koinonía, inicio"><img src="/logo.png" alt=""/><span>Koinonía<small>COMUNIDADES Y VÍNCULOS</small></span></a>; }
function Notice({ children, error = false }) { return children ? <div className={'notice ' + (error ? 'error' : '')} role={error ? 'alert' : 'status'}>{children}</div> : null; }
function Landscape() { return <div className="landscape" aria-hidden="true"><div className="sun"/><div className="mountain back"/><div className="mountain"/><div className="chapel"><div className="cross">✝</div><div className="door"/></div><div className="path"/><span>UN LUGAR PARA ENCONTRARNOS</span></div>; }
function Auth({ register, onSession, message }) {
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget), email = form.get('email').trim(), password = form.get('password');
    let created = false;
    try {
      if (register) {
        if (new TextEncoder().encode(password).length > 72) throw Error('La contraseña supera el máximo de 72 bytes. Usa una más corta.');
        await api('/auth/register', { method: 'POST', body: { email, password, ...(form.get('name').trim() ? { name: form.get('name').trim() } : {}) } }); created = true;
      }
      const result = await api('/auth/login', { method: 'POST', body: { email, password } }); onSession(result, created);
    } catch (e) { setError(created ? 'Tu cuenta ya está creada. Inicia sesión para continuar; no necesitas volver a registrarte.' : e.status === 409 ? 'Ya existe una cuenta con ese correo. Puedes iniciar sesión.' : e.status === 401 ? 'El correo o la contraseña no coinciden.' : e.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-layout"><section className="auth-story"><span className="eyebrow">TU CAMINO, TU COMUNIDAD</span><h1>Los vínculos<br/>empiezan con<br/><em>un encuentro.</em></h1><p>Un espacio para conocer comunidades cristianas y descubrir dónde te gustaría participar.</p><Landscape/></section><section className="auth-card"><span className="eyebrow">BIENVENIDO A KOINONÍA</span><h2>{register ? 'Comienza tu camino' : 'Qué bueno verte de nuevo'}</h2><p>{register ? 'Crea tu cuenta. Después podrás contarnos qué buscas, a tu ritmo.' : 'Entra para continuar donde lo dejaste.'}</p><Notice>{message}</Notice><Notice error>{error}</Notice><form onSubmit={submit}>
    <fieldset disabled={busy}>{register && <label>Nombre <span className="optional">opcional</span><input name="name" autoComplete="name" maxLength={100} placeholder="¿Cómo te llamas?"/></label>}
    <label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="tu@correo.cl"/></label>
    <label>Contraseña<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} maxLength={72}/></label>{register && <small>Usa al menos 12 caracteres. Tu contraseña no se guarda en este navegador.</small>}
    <button className="primary full" type="submit">{busy ? 'Un momento…' : register ? 'Crear mi cuenta →' : 'Iniciar sesión →'}</button></fieldset></form>
    <p><a href="#/recuperar">¿Olvidaste tu contraseña?</a></p><p className="auth-switch">{register ? '¿Ya tienes una cuenta?' : '¿Primera vez por aquí?'} <a href={register ? '#/login' : '#/registro'}>{register ? 'Inicia sesión' : 'Crea tu cuenta'}</a></p>
    <div className="privacy-note">Tu perfil es privado. Tú decides qué responder y puedes cambiarlo cuando quieras.</div></section></main>;
}
function App() {
  const [route,setRoute] = useState(location.hash.slice(1) || '/'), [token,setToken] = useState(storage.get('koinonia-session') || ''), [user,setUser] = useState(null);
  const [loading,setLoading] = useState(!!token), [busy,setBusy] = useState(false), [error,setError] = useState(''), [message,setMessage] = useState('');
  const [draft,setDraft] = useState(null), [conflict,setConflict] = useState(false), [section,setSection] = useState(0);
  const titleRef = useRef(null);
  const [locationPending,setLocationPending] = useState(false);
  useEffect(() => { const handle = () => { setRoute(location.hash.slice(1) || '/'); setError(''); }; window.addEventListener('hashchange',handle); return () => window.removeEventListener('hashchange',handle); },[]);
  useEffect(() => { if(user && draft) storage.set(draftKey(user.id),draft); },[user,draft]);
  useEffect(() => { const handle = e => { if(draft?.dirty.length) {e.preventDefault();e.returnValue='';} }; window.addEventListener('beforeunload',handle); return () => window.removeEventListener('beforeunload',handle); },[draft]);
  useEffect(() => { titleRef.current?.focus(); },[route,draft?.step,section]);
  function adopt(profile) { setUser(profile); setDraft(restoreDraft(profile,storage.get(draftKey(profile.id)))); }
  async function restore() {
    setLoading(true);setError('');
    try { adopt((await api('/users/me',{token})).data); }
    catch(e) {if(e.status===401)expire();else setError(e.message);} finally {setLoading(false);}
  }
  useEffect(() => {if(token)restore();},[]);
  function expire() {storage.remove('koinonia-session');setToken('');setUser(null);setDraft(null);setMessage('Tu sesión terminó. Inicia sesión para recuperar tus respuestas.');go('/login');}
  function session(result, created = false) {storage.set('koinonia-session',result.token);setToken(result.token);adopt(result.data);setMessage('');go(created?'/encuesta':'/explorar');}
  async function logout() {if(draft?.dirty.length && !(await save('stay')))return;if(user)storage.remove(draftKey(user.id));storage.remove('koinonia-session');setToken('');setUser(null);setDraft(null);setMessage('');go('/');}
  function change(key,{value,state,mode}) {
    setError('');setMessage('');setDraft(previous=>({...previous,
      values:{...previous.values,...(value!==undefined?{[key]:value}:{})},
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
      const result = await api('/users/me',{token,method:'PATCH',body:patchFromDraft(draft,onboarding)});
      setUser(result.data);setDraft({...fromUser(result.data),step:nextStep});setConflict(false);
      if(action==='complete'||action==='later') {setMessage(action==='complete'?'Tu perfil inicial está listo. Puedes añadir detalles en Configuración del perfil.':'Guardamos tus respuestas. Puedes continuar cuando quieras.');go('/explorar');}
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
  const survey=route==='/encuesta'&&user&&draft, settings=route==='/configuracion'&&user&&draft;
  const notices=<><Notice error>{error}</Notice><Notice>{message}</Notice>{conflict&&<button className="secondary" onClick={reconcile} disabled={busy||locationPending}>Recargar y conservar mis ediciones</button>}</>;
  return <><header><div className="nav-wrap"><Brand/><nav aria-label="Navegación principal"><a href="#/" aria-current={route==='/'?'page':undefined}>Inicio</a><a href="#/descubrir" aria-current={route.startsWith('/descubrir')?'page':undefined}>Descubrir</a><a href="#/explorar" aria-current={route==='/explorar'?'page':undefined}>Explorar</a>{user?<>{['admin','representative'].includes(user.role)&&<a href="#/administracion" aria-current={route.startsWith('/administracion')?'page':undefined}>Administración</a>}<a href="#/perfil" aria-current={route==='/perfil'?'page':undefined}>Mi perfil</a><button className="nav-button" onClick={logout} disabled={busy||locationPending}>Cerrar sesión</button></>:<><a href="#/login">Iniciar sesión</a><a className="nav-cta" href="#/registro">Crear cuenta</a></>}</nav></div></header>
    <div hidden={!route.startsWith('/descubrir')}><Discover route={route} user={user} token={token}/></div>
    <div hidden={!(route==='/explorar'||route.startsWith('/iglesia/'))}><Explore route={route} user={user}/></div>
    {route==='/recuperar'||route.startsWith('/restablecer')||route==='/cuenta'&&user?<Account key={route} route={route} token={route==='/cuenta'?token:undefined} onChanged={()=>{expire();setMessage('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');}}/>:route.startsWith('/descubrir')||route==='/explorar'||route.startsWith('/iglesia/')?null:['/administracion','/administracion/usuarios'].includes(route)&&!loading&&user?(['admin','representative'].includes(user.role)?<AdminArea key={user.id} route={route} token={token} user={user}/>:<main className="narrow"><h1>Acceso restringido</h1><p>Esta sección requiere un rol de representante o administrador.</p><a href="#/explorar">Volver a explorar</a></main>):loading?<main className="loading" role="status"><span className="spinner"/>Recuperando tu perfil…</main>:token&&!user?<main className="narrow"><Notice error>{error}</Notice><button className="primary" onClick={restore}>Reintentar conexión</button><button className="text-button" onClick={logout}>Volver al inicio</button></main>:!user&&['/login','/registro','/encuesta','/perfil','/configuracion','/cuenta','/administracion','/administracion/usuarios'].includes(route)?<Auth key={route} register={route==='/registro'} onSession={session} message={message}/>:survey?<main className="survey-layout compact-survey"><aside className="steps-sidebar"><span className="eyebrow">SOLO LO ESENCIAL</span><h2>Un primer paso.<br/>A tu manera.</h2><p>Tres fases para empezar.<br/>El resto puede esperar.</p><ol>{steps.map((s,i)=><li key={s.title}><button disabled={busy||locationPending} aria-current={draft.step===i?'step':undefined} onClick={()=>{setDraft({...draft,step:i});setError('');}}><span>{i+1}</span>{s.title}</button></li>)}</ol><div className="sidebar-note">Más adelante podrás añadir intereses, actividades y otros detalles desde tu perfil.</div></aside><section className="survey-main"><div className="step-meta"><span>PASO {draft.step+1} DE 3</span><span>{draft.dirty.length?'Cambios sin guardar':'Avance guardado'}</span></div><div className="progress" role="progressbar" aria-label="Avance de la encuesta" aria-valuemin={0} aria-valuemax={3} aria-valuenow={draft.step+1}><span style={{width:`${(draft.step+1)/3*100}%`}}/></div><h1 ref={titleRef} tabIndex={-1}>{steps[draft.step].heading}</h1><p className="intro">{steps[draft.step].description}</p>{notices}<div className="question-card">{steps[draft.step].fields.filter(key=>key!=='denominations'||asksDenomination(draft.values.branches)).map(key=><Question key={key} fieldKey={key} draft={draft} change={change} busy={busy} onLocationPending={setLocationPending}/>)}</div><div className="survey-actions"><button className="secondary" disabled={busy||locationPending||draft.step===0} onClick={()=>setDraft({...draft,step:draft.step-1})}>← Atrás</button><button className="primary" disabled={busy||locationPending||conflict} onClick={()=>save(draft.step===2?'complete':'next')}>{busy?'Guardando…':draft.step===2?'Terminar y explorar iglesias':'Guardar y continuar →'}</button></div><button className="text-button postpone" disabled={busy||locationPending||conflict} onClick={()=>save('later')}>Guardar y completar después</button></section></main>:settings?<main className="settings-page"><div className="settings-heading"><a href="#/perfil">← Volver a mi perfil</a><span className="eyebrow">A TU RITMO, CON MÁS DETALLE</span><h1 ref={titleRef} tabIndex={-1}>Configuración del perfil</h1><p>Amplía tus preferencias cuando quieras. Marca “Usar este valor como una restricción” solo cuando sea indispensable; sin marcar, será una preferencia.</p></div>{notices}<div className="settings-layout"><nav className="settings-nav" aria-label="Secciones del perfil">{profileSections.map((s,i)=><button key={s.title} type="button" disabled={busy||locationPending} aria-current={section===i?'page':undefined} onClick={()=>setSection(i)}>{s.title}</button>)}</nav><section className="settings-body"><h2>{profileSections[section].title}</h2><a className="text-button" href="#/cuenta">Configuración de cuenta y contraseña</a><div className="question-card">{profileSections[section].fields.filter(key=>key!=='denominations'||asksDenomination(draft.values.branches)).map(key=><Question key={key} fieldKey={key} draft={draft} change={change} busy={busy} settings onLocationPending={setLocationPending}/>)}</div><div className="settings-save"><span role="status">{draft.dirty.length?'Tienes cambios sin guardar':'Todo guardado'}</span><button className="primary" disabled={busy||locationPending||conflict||!draft.dirty.length} onClick={()=>save('settings')}>{busy?'Guardando…':'Guardar configuración'}</button></div></section></div></main>:user&&route==='/perfil'?<main className="profile-page"><div className="profile-heading"><div><span className="eyebrow">TU ESPACIO PERSONAL</span><h1 ref={titleRef} tabIndex={-1}>Hola, {user.name||'te damos la bienvenida'}.</h1><p>Lo que buscas puede cambiar. Tu perfil también.</p></div><span className="status-pill">{user.onboarding?.status==='completed'?'Perfil inicial completado':'Perfil en construcción'}</span></div>{notices}<section className="resume-card"><div><h2>{user.onboarding?.status==='completed'?'Los detalles, cuando tú quieras.':'Continuemos donde lo dejaste.'}</h2><p>{draft?.dirty.length?'Tienes respuestas pendientes de guardar.':'Amplía tus intereses, actividades y preferencias desde la configuración.'}</p></div>{user.onboarding?.status==='completed'?<button className="primary" onClick={()=>openSettings()}>Configurar mi perfil →</button>:<a className="primary" href="#/encuesta">Continuar encuesta →</a>}</section>{user.onboarding?.status!=='completed'&&<button className="text-button" onClick={()=>openSettings()}>Ir a configuración del perfil</button>}<div className="profile-grid">{profileSections.map((s,i)=><section className="profile-card" key={s.title}><div className="row-heading"><span className="card-number">0{i+1}</span><button className="text-button" onClick={()=>openSettings(i)}>Editar<span className="sr-only"> {s.title}</span></button></div><h2>{s.title}</h2>{steps[i].fields.filter(k=>k!=='denominations'||asksDenomination(draft.values.branches)).map(k=><div className="profile-answer" key={k}><small>{fields[k].label}</small><p>{displayValue(k,draft)}</p>{draft.states[k]==='answered'&&!fields[k].context&&!fields[k].location&&<span className="mode-label">{{preferred:'Preferencia',required:'Restricción',disabled:'Sin aplicar'}[draft.modes[k]]}</span>}</div>)}</section>)}</div><div className="account-strip"><div><strong>Tu cuenta</strong><span>{user.email}</span></div><a className="secondary" href="#/cuenta">Configuración de cuenta</a><p>Solo tú puedes consultar y editar estas respuestas.</p></div></main>:<main className="home"><section><span className="eyebrow">ENCUENTRA TU LUGAR</span><h1>Una comunidad<br/>para caminar<br/><em>en la fe.</em></h1><p>Empieza por lo que importa para ti. Crea tu perfil y cuéntanos qué buscas en una comunidad cristiana.</p><a className="primary" href={user?'#/perfil':'#/registro'}>{user?'Ir a mi perfil →':'Comenzar mi camino →'}</a><a className="text-button" href="#/explorar">Explorar comunidades →</a><span className="home-note">Tres fases para empezar. Los detalles, después.</span></section><Landscape/><div className="home-bottom"><span>01 <strong>Cuéntanos qué buscas</strong></span><span>02 <strong>Elige tu tradición</strong></span><span>03 <strong>Encuentra tu lugar</strong></span></div></main>}
    <footer><span>Koinonía <i>·</i> Comunidades y vínculos</span><span>Un encuentro comienza con un primer paso.</span></footer></>;
}
createRoot(document.getElementById('root')).render(<App/>);
