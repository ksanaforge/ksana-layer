/**
   rewrite from ksanaforge/ksana-document/document.js


*/
var layerdoc_full=require("./layerdoc_full");
var layerdoc=require("./layerdoc");
layerdoc.createFromKdb=require("./layerdoc_kdb");
var layermarkup=require("./layermarkup");
var pnetwork=require("./pnetwork");
var uuid=require("./uuid");
module.exports={layerdoc:layerdoc,layerdoc_full:layerdoc_full,
	layermarkup:layermarkup,pnetwork:pnetwork,UUID:uuid};