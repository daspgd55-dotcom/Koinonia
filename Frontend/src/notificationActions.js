import {api} from './api';
export async function openNotification(event,notification,token,onError,onOpened){
 event.preventDefault();const href=event.currentTarget.getAttribute('href');
 try{if(!notification.read)await api('/notifications/'+notification._id+'/read',{token,method:'PATCH'});window.dispatchEvent(new Event('visits-changed'));onOpened?.();location.hash=href.slice(1);}catch(error){onError(error.message);}
}
