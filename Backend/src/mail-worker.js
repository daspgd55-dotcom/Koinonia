const {loadConfig}=require('./config/env'),{connectDB,disconnectDB}=require('./config/db'),queue=require('./services/mail-queue.service');
async function start(){const cfg=loadConfig();if(!queue.enabled(cfg))throw Error('MAIL_QUEUE_ENABLED debe estar activo para ejecutar el worker');queue.validate(cfg);await connectDB(cfg.mongoUri);let stop=false;process.once('SIGINT',()=>{stop=true;});process.once('SIGTERM',()=>{stop=true;});
 try{while(!stop){try{await queue.reconcile();if(await queue.runOne(cfg))continue;}catch{console.error('MAIL_WORKER_CYCLE_FAILED');}await new Promise(r=>setTimeout(r,2000));}}finally{await disconnectDB();}
}
start().catch(()=>{console.error('MAIL_WORKER_START_FAILED');process.exitCode=1;});
