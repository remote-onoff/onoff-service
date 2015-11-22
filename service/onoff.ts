/// <reference path="../typings/express/express.d.ts" />
/// <reference path="../typings/node/node.d.ts" />
/// <reference path="../typings/jssha/jssha.d.ts" />


//import express = require('express');

import * as express from "express";
import * as wolapi from "node-wol";
import * as jssha from "jssha";

const TokenTimeFrame = 60;

export class Computer {
    public name:string;
    private macAddr:string;
    private ip:string;
    private port:number;
    
    constructor(name:string, ma:string, ip:string = null, port:number = null) {
        this.name = name;
        this.macAddr = ma;
        this.ip = ip;
        this.port = port;
    }
    
    public wake(): void {
            
    }
}


function DoHash(input:string) {
    let src = new jssha("SHA-256", "TEXT");
    src.update(input);
    return src.getHash("HEX");
}

function MakeToken(ts:TokenSource, secret:string, action:string) {
    return DoHash(ts.prefix + ':' + action + ':' + secret);
}

class TokenSource {
    prefix:string;
    salt:string;
    
    constructor(secret:string, time:Date = new Date(), salt:string = null, prvToken:boolean = false) {
        if (salt == null) {
            salt = Math.random().toString(36).substr(2);
        }
        this.salt = salt;
        
        time.setMilliseconds(0);
        time.setSeconds(
            Math.floor(time.getSeconds() / TokenTimeFrame) * TokenTimeFrame
            - (prvToken? TokenTimeFrame : 0)
        );
        
        let source = this.salt + ':' + time.getTime() + ':' + secret;
        this.prefix = DoHash(source)
    }
    
}

class ComputerStatus {
    id:number;
    active:boolean;
    connected:boolean;
}

class ComputerInfo {
    id:number;
    name:string;
}


class Response<R> {
    error:string;
    res:R;
}

class ServiceInfo {
    version:number = 1;
    supportedVersions: number[] = [
        1
    ]
}

export class OnoffApp {
    private secret:string;
    
    start(secret:string, computers:Computer[], port:number = 3489): void {
        var app = express();
        this.secret = secret;
        let self = this;
        app.use('/', function(req, res, next) {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "X-Requested-With");
            next();
        });
        
        app.get('/version', function(req, res) {
           res.send(new ServiceInfo()); 
        });
        
        app.get('/v1/token', function(req, res) {
            //res.send([{name:'wine1'}, {name:'wine2'}]);
            let token = new TokenSource(secret);
            res.send(token);
        });
        
        app.get('/v1/list/:token/:salt', function(req, res, next) {
            let token:string = req.params.token;
            let salt:string = req.params.salt;
            
            if (!self.checkToken(token, salt, "list")) {
                return next(new Error("Invalid token!"));
            }
            
            let cis:ComputerInfo[] = computers.map((c:Computer, idx:number) => { 
                return {id: idx, name: c.name}
            });
            res.send(cis);
        });
        
        app.get('/v1/status/:id/:token/:salt', function(req, res, next) {
            //res.send({id:req.params.id, name: "The Name", description: "description"});
            let id:number = req.params.id;
            let token:string = req.params.token;
            let salt:string = req.params.salt;
            
            if (!self.checkToken(token, salt, "status/" + id)) {
                return next(new Error("Invalid token!"));
            }
            
            if (!(id in computers)) {
                return next(new Error("Invalid id!"))
            }
        });
        app.get('/v1/boot/:id/:token/:salt', function(req, res) {
            
        });
        app.get('/v1/shutdown/:id/:token/:salt', function(req, res) {
            
        });
        app.get('/v1/sleep/:id/:token/:salt', function(req, res) {
            
        });
        
        app.listen(port);
        console.log('Listening on port ' + port + '...');
    }
    
    private checkToken(token:string, salt:string, action:string):boolean {
        let time = new Date();
        let ts1 = new TokenSource(this.secret, time, salt, false);
        let ts2 = new TokenSource(this.secret, time, salt, true);
        
        let refTok1 = MakeToken(ts1, this.secret, action);
        let refTok2 = MakeToken(ts2, this.secret, action);
        
        return refTok1 === token || refTok2 === token; 
    }
}