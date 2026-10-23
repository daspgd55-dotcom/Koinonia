import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import ProfileHome from '../../src/ProfileHome';
import PreferenceGroups from '../../src/PreferenceGroups';
import Question from '../../src/Question';
import Account from '../../src/Account';
import {SessionContext} from '../../src/Membership';
import {fromUser} from '../../src/profile';
import '../../src/styles.css';
import '../../src/ProfileSettings.css';
function Fixture(){const [user,setUser]=useState({id:'test',role:new URLSearchParams(location.search).get('role')||'user',name:'María de los Ángeles Comunidad y Encuentro con un nombre largo de prueba',email:'test@example.test',username:'test_user',onboarding:{status:'completed'},preferences:{activities:['Campamentos']}}),[view,setView]=useState('profile'),[draft,setDraft]=useState(()=>fromUser(user));const title=useRef(null);function change(key,patch){setDraft(d=>({...d,values:{...d.values,...('value'in patch?{[key]:patch.value}:{})},states:{...d.states,...(patch.state?{[key]:patch.state}:{})},modes:{...d.modes,...(patch.mode?{[key]:patch.mode}:{})},dirty:[...new Set([...d.dirty,key])]}));}return <SessionContext.Provider value={{user,token:'test',onUser:setUser}}><button onClick={()=>setView('profile')}>Perfil de prueba</button><button onClick={()=>setView('account')}>Cuenta de prueba</button>{view==='profile'?<ProfileHome user={user} token="test" draft={draft} titleRef={title} onSaved={setUser} onRefresh={setUser} openSettings={()=>setView('preferences')}/>:view==='account'?<Account user={user} token="test" route="/cuenta" onChanged={()=>{}}/>:<main className="settings-page"><h1 tabIndex={-1}>Preferencias de búsqueda</h1><PreferenceGroups section={0} draft={draft} renderQuestion={key=><Question key={key} fieldKey={key} draft={draft} change={change} settings/>}/></main>}</SessionContext.Provider>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
