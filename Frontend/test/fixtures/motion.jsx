import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import PageMotion from '../../src/PageMotion';
import '../../src/styles.css';
import '../../src/PublicEvents.css';
function Fixture(){const [route,setRoute]=useState('/eventos'),[extra,setExtra]=useState(false);return <><button onClick={()=>setRoute('/perfil')}>Cambiar página</button><button onClick={()=>setExtra(true)}>Cargar tarjetas</button><PageMotion route={route}><main style={{maxWidth:900,margin:'auto',padding:24}}><section id="panel" className="event-search-panel">Filtros de eventos</section><div style={{height:1000}}/><div className="events-public-grid"><article id="church" className="church-card"><a href="#church">Iglesia de prueba</a></article><article id="event" className="event-public-card"><a href="#event">Evento de prueba</a></article></div><div style={{height:1000}}/><article id="visit" className="visit-card"><button>Consultar aviso</button></article>{extra&&<article id="extra" className="linked-public-card">Comunidad añadida</article>}<div style={{height:500}}/></main></PageMotion></>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
