import LocationChoice from './LocationChoice';
import React, { useEffect, useRef, useState } from 'react';
import { fields, hasValue, effectiveLocation, denominationOptions } from './profile';
export default function Question({ fieldKey, draft, change, busy, settings = false, onLocationPending }) {
  const f = fields[fieldKey], value = draft.values[fieldKey], state = draft.states[fieldKey];
  const [custom,setCustom] = useState(''), [locating,setLocating] = useState(false), [geoError,setGeoError] = useState('');
  const requestId = useRef(0), rangeMax = useRef(Math.max(50, Number(value) || 0));
  useEffect(() => () => { requestId.current++; if (f.location) onLocationPending?.(false); }, []);
  useEffect(() => { if (f.location) onLocationPending?.(locating); }, [locating]);
  const available = fieldKey === 'denominations' ? denominationOptions(draft.values.branches) : f.options || [];
  const options = available.map(o => Array.isArray(o) ? o : [o,o]);
  // Mantiene las selecciones históricas y las etiquetas personalizadas; cambiar de rama no las borra.
  if (f.multiple) for (const v of value || []) if (!options.some(o => o[0] === v)) options.push([v, v + ' (guardada)']);
  const choose = v => change(fieldKey, { value: v, state: hasValue(v) ? 'answered' : 'omitted', ...(!settings ? {mode:'preferred'} : {}) });
  const none = () => change(fieldKey, {value:null,state:'no_preference',mode:'disabled'});
  function locate(enabled) {
    requestId.current++; setGeoError('');
    if (!enabled) { setLocating(false); choose(null);change('locationSource',{value:'none',state:'answered'});return; }
    change('locationSource',{value:'device',state:'answered'});
    if (!navigator.geolocation) { setGeoError('Este navegador no permite usar la ubicación. Puedes continuar indicando solo la comuna.'); return; }
    const id = requestId.current; setLocating(true);
    navigator.geolocation.getCurrentPosition(p => {
      if (requestId.current !== id) return;
      choose({lat:+p.coords.latitude.toFixed(3),lng:+p.coords.longitude.toFixed(3)}); setLocating(false);
    }, () => {
      if (requestId.current !== id) return;
      setLocating(false); setGeoError('No se pudo activar la ubicación. Revisa el permiso del navegador o selecciona tu dirección como referencia.');
    }, {timeout:10000,enableHighAccuracy:false});
  }
  const unlisted = fieldKey === 'denominations' && (value || []).some(v => !available.includes(v));
  return <fieldset className="question" disabled={busy} data-field={fieldKey}><legend>{f.label}</legend>
    {f.text ? <><input aria-label={f.label} maxLength={200} placeholder={f.placeholder} autoComplete="off" list={fieldKey === 'commune' ? 'communes' : undefined} value={value || ''} onChange={e => choose(e.target.value)}/>{fieldKey === 'commune' && <datalist id="communes">{f.options.map(o => <option key={o} value={o}/>)}</datalist>}{fieldKey === 'address' && <div className="help"><p>Indica calle y número, sin departamento. Comprobaremos la dirección al guardar.</p><details><summary>Cómo comprobamos tu dirección</summary><p>Consultamos Geoapify para encontrar la ubicación. Tu dirección no se muestra en tu perfil público de Koinonía.</p></details></div>}</> : f.location ? <LocationChoice draft={draft} locating={locating} error={geoError} onToggle={locate} onRetry={()=>locate(true)} onPrefer={preferred=>{requestId.current++;setLocating(false);setGeoError('');if(preferred)change('locationSource',{value:'address',state:'answered'});else locate(true);}}/> : f.range ? <><div className="range-caption"><output htmlFor="radius-range">{state === 'answered' && hasValue(value) ? `${value} km` : 'Sin preferencia de distancia'}</output><span>Distancia aproximada</span></div><input id="radius-range" aria-label={f.label} type="range" min="1" max={rangeMax.current} step="1" value={value || 10} onChange={e => choose(Number(e.target.value))}/><div className="range-ticks"><span>1 km</span><span>{rangeMax.current} km</span></div>{!effectiveLocation(draft) && <p className="help">Activa la ubicación para ver distancias; puedes usar tu dirección o tu ubicación actual.</p>}</> : <div className={'choices ' + (f.context || fieldKey === 'branches' ? 'single' : '')}>
      {options.map(([id,label]) => <button key={id} type="button" aria-pressed={f.multiple ? (value || []).includes(id) : value === id} onClick={() => choose(f.multiple ? f.single ? [id] : (value || []).includes(id) ? value.filter(x => x !== id) : [...(value || []),id] : id)}>{label}<span aria-hidden="true">{(f.multiple ? (value || []).includes(id) : value === id) ? '✓':'+'}</span></button>)}
      <button type="button" className="empty-choice" aria-pressed={!hasValue(value) && ['no_preference','unknown'].includes(state)} onClick={none}>{f.emptyLabel || 'Sin preferencia'}<span aria-hidden="true">{!hasValue(value) && ['no_preference','unknown'].includes(state) ? '✓':'−'}</span></button>
    </div>}
    {unlisted && <p className="help">Conservamos tu selección anterior. Puedes retirarla pulsándola o indicar otra denominación.</p>}
    {f.custom && <div className="custom-value"><input aria-label={'Otra opción: ' + f.label} maxLength={200} placeholder={fieldKey === 'denominations' ? 'Otra denominación…' : 'Otra opción…'} value={custom} onChange={e => setCustom(e.target.value)}/><button type="button" className="secondary small" disabled={!custom.trim()} onClick={() => { choose([...new Set([...(value || []),custom.trim()])]); setCustom(''); }}>Añadir</button></div>}
    {(f.text || f.range) && <div className="choices absence"><button type="button" className="empty-choice" aria-pressed={!hasValue(value) && ['no_preference','unknown'].includes(state)} onClick={none}>{f.emptyLabel || 'Sin preferencia'}</button></div>}
    {settings && !f.context && !f.location && hasValue(value) && state === 'answered' && <label className="check-option restriction"><input type="checkbox" aria-label={'Usar como restricción: ' + f.label} checked={draft.modes[fieldKey] === 'required'} onChange={e => change(fieldKey,{mode:e.target.checked ? 'required':'preferred'})}/><span>Usar este valor como una restricción</span></label>}
    {settings && draft.modes[fieldKey] === 'required' && state === 'answered' && !f.context && !f.location && <p className="criterion-hint">Se exigirá una coincidencia comprobable.{['activities','ministries','targetGroups','doctrinalTags'].includes(fieldKey) ? ' Deben cumplirse todas las opciones seleccionadas.' : ''}</p>}
  </fieldset>;
}
