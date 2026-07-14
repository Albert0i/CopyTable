
const info = () => {
    return { 
             arch: `Process Architecture: ${process.arch}`,
             pid: `Process PID: ${process.pid}`, 
             platform: `Process Platform: ${process.platform}`, 
             version: `Process Version: ${process.version}`, 
             pm_name: process.env.name ,
             pm_id: process.env.pm_id
           }             
}

export { info };

/*
   Node.js Process
   https://www.javatpoint.com/nodejs-process

   node app instance name when running via pm2 cluster
   https://stackoverflow.com/questions/44554336/node-app-instance-name-when-running-via-pm2-cluster

   pm2 | ENVIRONMENT VARIABLES
   https://pm2.keymetrics.io/docs/usage/environment/
*/