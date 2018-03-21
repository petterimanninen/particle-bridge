# IoT Javascript Client 

This simple problem will register a gateway, activate it, send a few messages, and delete the gateway

## How to run

Make sure node is installed on your system!  

1) Clone the repo

```
bash$ git clone http://git.us.oracle.com/iot/jsclient.git
```
2) Install the depencies (the first 2 lines only required when running within Oracle Intranet)

```
bash$ npm config set proxy http://www-proxy.us.oracle.com:80  
bash$ npm config set https-proxy http://www-proxy.us.oracle.com:80   
bash$ npm install
```
3) Run the app

```
bash$ node tests/testMin.js
```

