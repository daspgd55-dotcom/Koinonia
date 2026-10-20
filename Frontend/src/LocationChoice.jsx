import React from 'react';
import './LocationChoice.css';
export default function LocationChoice({draft,locating,error,onToggle,onPrefer,onRetry}){
 const source=draft.values.locationSource||'none',active=source!=='none';
 return <><label className="check-option"><input type="checkbox" checked={active} onChange={e=>onToggle(e.target.checked)}/><span>Activar ubicación</span></label>{active&&<div className="address-reference"><label className="check-option"><input type="checkbox" checked={source==='address'} onChange={e=>onPrefer(e.target.checked)}/><span>Preferir mi dirección en lugar de mi ubicación actual</span></label><p className="help">{source==='address'?'Usaremos la dirección indicada arriba. Se comprobará al guardar.':locating?'Obteniendo tu ubicación actual…':'Usaremos la ubicación de tu dispositivo.'}</p>{source==='device'&&!locating&&<button type="button" className="text-button" onClick={onRetry}>Actualizar ubicación actual</button>}{error&&source==='device'&&<p className="notice error" role="alert">{error}</p>}</div>}</>;
}
