import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Loading,{RequestActivity} from '../../src/Loading';
import {api} from '../../src/api';
import ChatWidget from '../../src/ChatWidget';
import '../../src/styles.css';
function Fixture(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(path,background=false){setMessage('');if(path==='/loading/inline')setBusy(true);try{await api(path,{background});setMessage('Terminado');}catch{setMessage('Error controlado');}finally{setBusy(false);}}
 return <><main><button onClick={()=>run('/loading/slow')}>Solicitud lenta</button><button onClick={()=>run('/loading/error')}>Solicitud con error</button><button onClick={()=>run('/loading/fast')}>Solicitud rápida</button><button onClick={()=>run('/loading/background',true)}>Segundo plano</button><button disabled={busy} onClick={()=>run('/loading/inline')}>{busy?<Loading inline label="Guardando…"/>:'Guardar prueba'}</button><p>{message}</p></main><ChatWidget token="test"/><RequestActivity/></>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
