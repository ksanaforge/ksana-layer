/**
   rewrite from ksanaforge/ksana-document/document.js


*/
var layerdoc=require("./layerdoc");
var layerdoc_lite=require("./layerdoc_lite");
layerdoc.createFromKdb=require("./layerdoc_kdb");
var layermarkup=require("./layermarkup");
var pnetwork=require("./pnetwork");
var uuid=require("./uuid");
module.exports={layerdoc:layerdoc,layerdoc_lite:layerdoc_lite,
	layermarkup:layermarkup,pnetwork:pnetwork,UUID:uuid};