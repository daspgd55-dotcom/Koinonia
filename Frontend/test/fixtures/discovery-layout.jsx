import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import Explore from '../../src/Explore';
import Discover from '../../src/Discover';
import '../../src/styles.css';
function Fixture(){const [route,setRoute]=useState(location.hash.slice(1)||'/explorar');useEffect(()=>{const change=()=>setRoute(location.hash.slice(1));addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change);},[]);return <><div hidden={!route.startsWith('/descubrir')}><Discover route={route}/></div><Explore route={route}/></>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
