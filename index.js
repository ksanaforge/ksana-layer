/* 
   rewrite from ksanaforge/ksana-document/document.js


*/
var layerdoc=require("./layerdoc");
layerdoc.createFromKdb=require("./layerdoc_kdb");
var layermarkup=require("./layermarkup");

module.exports={layerdoc:layerdoc,layermarkup:layermarkup};