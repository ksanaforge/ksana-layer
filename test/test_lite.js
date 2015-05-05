var assert=require("assert");
var API=require("..");
var layerdoc_lite=API.layerdoc_lite;
var layerMarkup=API.layermarkup;
var fs=require("fs");
var layerdoc=null;
var layermarkup=null;
var m1,m2=null;
describe("layer document",function() {


it("create from csv",function(){
	var csv=fs.readFileSync("./daodejin.csv","utf8");
	layerdoc=layerdoc_lite.createFromCSV(csv);
	assert.equal(layerdoc.ndoc,82);
});

it("check implict markup",function(){
	assert.equal(layerdoc.rawtags["1"].length,3);
	assert.equal(layerdoc.rawtags["81"].length,2);
})

it("external markup",function(){
	var segid="1";
	layermarkup=layerMarkup.create(layerdoc);
	m1=layermarkup.createMarkup(segid,35,4);

	var inscription=layermarkup.inscriptionOf(m1);
	assert.equal(inscription,"欲觀其妙");
	segid="42";
	m2=layermarkup.createMarkup(segid,25,5);
	inscription=layermarkup.inscriptionOf(m2);
	assert.equal(inscription,"沖氣以為和");
});


it("text mutation",function(done){
	var layermutation=layerMarkup.create(layerdoc,{mutate:true});
	var segid="1";
	var m1=layermutation.createMarkup(segid,17,0,{t:"也"});
	var m2=layermutation.createMarkup(segid,8,0,{t:"也"});

	assert.equal(m1%2,0);  //always even number
	assert.equal(m1%2,0);

	var oldversion=layerdoc.version;
	layerdoc.evolve(layermutation.markups,function(){
		var newtext=layerdoc.get("1");
		assert.equal(newtext.substr(0,19),"道，可道，非常道也；名，可名，非常名也");

		var oldtext=layerdoc.get("1",oldversion).substr(0,17);
		assert.equal(oldtext,"道，可道，非常道；名，可名，非常名")

		done();
	});
});



it("upgrade markup",function(){
	var nmarkup=0;

	//old version
	var inscription=layermarkup.inscriptionOf(m1);
	assert.equal(inscription,"欲觀其妙");

	layermarkup.upgrade();
	inscription=layermarkup.inscriptionOf(m1);
	assert.equal(inscription,"欲觀其妙");

});

it("serialized",function(){

	var json=layermarkup.exportJSON();
	var layermarkup2=layerMarkup.create(layerdoc);
	layermarkup2.importJSON(json);

	var inscription=layermarkup2.inscriptionOf(m1);
	assert.equal(inscription,"欲觀其妙");
});

it("updateMarkup without layermarkup",function(done){
	var csv=fs.readFileSync("./daodejin.csv","utf8");
	var layerdoc=layerdoc_lite.createFromCSV(csv);
	var segid="1";

	/* markup on old version */
	var markups=[{s:35,l:4,type:"test"}];
	var markup_version=layerdoc.version;

	var mutation={};
	mutation[segid]=[
		{s:17,l:0,t:"也"}
		,{s:8,l:0,t:"也"}
	];

	layerdoc.evolve(mutation,function(){
		/* upgrade the markup to lastest version */
		layerdoc.upgradeMarkups(markup_version,segid,markups);
		assert.equal(markups[0].s,37);
		done();
	});

});



});