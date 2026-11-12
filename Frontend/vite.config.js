import { defineConfig,loadEnv } from 'vite';
export default defineConfig(({command,mode})=>{
 const buildId=new Date().toISOString();
 const env=loadEnv(mode,process.cwd(),'VITE_'),api=(process.env.VITE_API_BASE_URL||env.VITE_API_BASE_URL||'').trim();
 // cPanel serves static files only; production must call the Render API.
 return {plugins:[{name:'build-version',generateBundle(){this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({buildId})});}}],define:command==='build'?{'__APP_BUILD__':JSON.stringify(buildId),'import.meta.env.VITE_API_BASE_URL':JSON.stringify(api||'https://david-07tv.onrender.com/api')}:{},server:{port:5173,strictPort:true,proxy:{'/api':{target:process.env.API_TARGET||'http://127.0.0.1:3000',changeOrigin:true}}}};
});
