export const openChat=id=>window.dispatchEvent(new CustomEvent('open-chat',{detail:{id}}));
