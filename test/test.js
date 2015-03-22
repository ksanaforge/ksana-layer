var assert=require("assert");
var API=require("..");
var fs=require("fs");
var layerdoc=null;
var layermarkup=null;

describe("create from csv",function(){
	var csv=fs.readFileSync("./daodejin.csv","utf8");
	layerdoc=API.layerdoc.createFromCSV(csv);
	assert.equal(layerdoc.ndoc,82);
});


describe("external markup",function(){
	var segid="1";
	layermarkup=API.layerdoc.createLayer(layerdoc);
	var m=layermarkup.put(segid,35,4);

	var inscription=layermarkup.getInscription(segid,m);
	assert.equal(inscription,"欲觀其妙");

	segid="42";
	m=layermarkup.put(segid,25,5);

	inscription=layermarkup.getInscription(segid,m);
	console.log(inscription)
	assert.equal(inscription,"沖氣以為和");
});


describe("text mutation",function(){
	var layermutation=API.layerdoc.createLayer(layerdoc,{mutate:true});
	var segid="1";
	layermutation.put(segid,17,0,{t:"也"});
	layermutation.put(segid,8,0,{t:"也"});

	layerdoc.evolve(layermutation);
	var newtext=layerdoc.get("1").substr(0,19);

	assert.equal(newtext,"道，可道，非常道也；名，可名，非常名也");
});


describe("migrate markup",function(){

	//layerdoc.migrate(layermarkup);

});