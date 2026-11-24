const {config}=require('./config'),{ollama}=require('./ollama'),{createSearch}=require('./search');
// Composición exclusiva del proceso servidor. El repositorio queda inyectado según alojamiento.
function createSemanticSearch({env=process.env,repository}={}){const settings=config(env);return createSearch({config:settings,repository,provider:settings.enabled?ollama({baseUrl:settings.baseUrl,identity:settings.identity}):null});}
module.exports={createSemanticSearch};
