import React,{useState} from 'react';
import {api} from './api';
import Loading from './Loading';
import UsernameField from './UsernameField';
import {MfaChallenge} from './Mfa';
import Notice from './Notice';
import Landscape from './Landscape';
export default function Auth({ register, onSession, message, registrationReturn='', teamReturn='' }) {
  const [challenge,setChallenge]=useState(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''),[pending,setPending]=useState(false),[needsVerification,setNeedsVerification]=useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    const form = new FormData(event.currentTarget), identifier = form.get('identifier')?.trim(), email = form.get('email')?.trim(), password = form.get('password');
    let created = false;
    try {
      if (register) {
        if (new TextEncoder().encode(password).length > 72) throw Error('La contraseña supera el máximo de 72 bytes. Usa una más corta.');
        const registration=await api('/auth/register', { method: 'POST', body: { email, password, username:form.get('username').trim().toLowerCase(), ...(form.get('name').trim() ? { name: form.get('name').trim() } : {}) } }); if(registration.verificationRequired){setPending(registration.message);return;} created = true;
      }
      const result = await api('/auth/login', { method: 'POST', body: register?{email,password}:{identifier,password} }); if(result.mfaRequired){setChallenge(result.challenge);return;}onSession(result, created);
    } catch (e) {setNeedsVerification(e.code==='EMAIL_VERIFICATION_REQUIRED'); setError(created ? 'Tu cuenta ya está creada. Inicia sesión para continuar; no necesitas volver a registrarte.' : e.code==='USERNAME_TAKEN'?e.message:e.status === 409 ? 'El correo o nombre de usuario ya está en uso.' : e.status === 401 ? 'El correo o la contraseña no coinciden.' : e.message); }
    finally { setBusy(false); }
  }
  if(challenge)return <MfaChallenge challenge={challenge} onSession={onSession} onBack={()=>setChallenge(null)}/>;
  return <main className="auth-layout"><section className="auth-story"><span className="eyebrow">LUGARES PARA CRECER EN LA FE</span><h1>Descubre comunidades<br/>cristianas cerca de ti.</h1><p>Explora iglesias por ubicación, actividades y creencias para encontrar una comunidad que se ajuste a lo que buscas.</p><Landscape/></section><section className="auth-card"><span className="eyebrow">BIENVENIDO A KOINONÍA</span><h2>{register ? 'Crea tu cuenta' : 'Inicia sesión'}</h2><p>{register ? 'Crea tu cuenta. Después podrás contarnos qué buscas, a tu ritmo.' : 'Entra para continuar donde lo dejaste.'}</p><Notice>{message}</Notice>{pending&&<Notice>{pending} Si ya tenías una, inicia sesión o recupera tu contraseña. <a href="#/verificar-correo">Reenviar enlace</a></Notice>}<Notice error>{error}</Notice>{needsVerification&&<p><a href="#/verificar-correo">Verificar mi correo</a></p>}<form onSubmit={submit}>
    <fieldset disabled={busy}>{register && <label>Nombre <span className="optional">opcional</span><input name="name" autoComplete="name" maxLength={100} placeholder="¿Cómo te llamas?"/></label>}
    {register&&<UsernameField/>}{register?<label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="tu@correo.cl"/></label>:<label>Correo electrónico o nombre de usuario<input name="identifier" type="text" autoComplete="username" required maxLength={254} placeholder="tu@correo.cl o @usuario"/></label>}
    <label>Contraseña<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : 1} maxLength={72}/></label>{register && <small>Usa al menos 8 caracteres.</small>}
    <button className="primary full" type="submit">{busy ? <Loading inline label="Un momento…"/> : register ? 'Crear mi cuenta →' : 'Iniciar sesión →'}</button></fieldset></form>
    {!register&&<p><a href="#/recuperar">¿Olvidaste tu contraseña?</a></p>}<p className="auth-switch">{register ? '¿Ya tienes una cuenta?' : '¿Primera vez por aquí?'} <a href={(register ? '#/login' : '#/registro')+(teamReturn?'?equipo='+teamReturn:registrationReturn?'?inscripcion='+registrationReturn:'')}>{register ? 'Inicia sesión' : 'Crea tu cuenta'}</a></p>
    <div className="privacy-note">Tu nombre público, usuario y foto permiten que tus amigos te encuentren. Tu correo y preferencias no se muestran en la búsqueda.</div></section></main>;
}
