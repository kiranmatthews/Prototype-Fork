import {createServer} from 'vite';
const server=await createServer({cacheDir:'/private/tmp/hollowwake/vite-cache',server:{host:'127.0.0.1',port:5203,strictPort:true}});await server.listen();server.printUrls();
