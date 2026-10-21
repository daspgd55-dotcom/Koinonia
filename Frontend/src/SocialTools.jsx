import React,{useContext} from 'react';
import {SessionContext} from './Membership';
export function SocialNav({onClick}){return <a href="#/amigos" onClick={onClick}>Amigos</a>;}
export function FriendShare({resource}){const {user}=useContext(SessionContext);if(!user)return null;return <button className="secondary small follow-button" onClick={()=>window.dispatchEvent(new CustomEvent('share-in-chat',{detail:resource}))}><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0Z"/></svg>Enviar a amigo</button>;}
