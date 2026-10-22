import React from 'react';
import {createRoot} from 'react-dom/client';
import Manage from '../../src/Manage';
import '../../src/styles.css';
const role=new URLSearchParams(location.search).get('role')||'representative';
createRoot(document.getElementById('root')).render(<Manage token="isolated-test" user={{id:'test-user',role,name:'Prueba'}}/>);
