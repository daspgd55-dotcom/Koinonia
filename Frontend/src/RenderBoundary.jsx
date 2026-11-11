import React,{useEffect,useState} from 'react';
import './RenderBoundary.css';
export class RenderBoundary extends React.Component{
 state={failed:false,reference:''};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error,info){const reference='UI-'+Date.now().toString(36);this.setState({reference});console.error('[Koinonia '+reference+']',error,info.componentStack);}
 componentDidUpdate(previous){if(this.state.failed&&previous.resetKey!==this.props.resetKey)this.setState({failed:false,reference:''});}
 render(){if(!this.state.failed)return this.props.children;return <main className="render-recovery" role="alert"><h1>No pudimos mostrar esta pantalla</h1><p>Puedes volver al inicio o intentar abrirla de nuevo. Los cambios sin guardar de esta pantalla pueden haberse perdido.</p><div><button type="button" onClick={()=>this.setState({failed:false,reference:''})}>Reintentar pantalla</button><a href="#/">Ir al inicio</a><button type="button" onClick={()=>window.location.reload()}>Recargar aplicación</button></div><p>Si vuelve a ocurrir, indica qué botón pulsaste y esta referencia: <strong>{this.state.reference||'Registrando error…'}</strong></p></main>;}
}
export default function AppRecovery({children}){
 const [route,setRoute]=useState(()=>window.location.hash);
 useEffect(()=>{const change=()=>setRoute(window.location.hash);window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 return <RenderBoundary resetKey={route}>{children}</RenderBoundary>;
}
