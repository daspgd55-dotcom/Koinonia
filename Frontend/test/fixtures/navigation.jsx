import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Navigation from '../../src/Navigation';
import '../../src/styles.css';
function Fixture(){const [route,setRoute]=useState('/evento/example');window.auditRoute=setRoute;const role=new URLSearchParams(location.search).get('role')||'user';return <><Navigation route={route} user={role==='guest'?null:{id:'test',role}} logout={()=>{window.loggedOut=true;}}><a className="brand" href="#/"><img src="/logo.png" alt=""/><span>Koinonía<small>COMUNIDADES CRISTIANAS</small></span></a></Navigation><main><button>Contenido</button></main></>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
