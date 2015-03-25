var assert=require("assert");
var API=require("..");
var fs=require("fs");
var layerdoc=null;
var layermarkup=null;
var m1,m2=null;
describe("upgrade an csv",function() {


it("create from csv",function(){
	var csv=fs.readFileSync("./daodejin.csv","utf8");
	layerdoc=API.layerdoc.createFromCSV(csv,{name:"daodejin"});
	assert.equal(layerdoc.ndoc,82);
});

it("create mutation",function(){
	var layermutation=API.layermarkup.create(layerdoc,{mutate:true});
	var segid="1";
	var m1=layermutation.createMarkup(segid,17,0,{t:"也"});
	var m2=layermutation.createMarkup(segid,8,0,{t:"也"});

	fs.writeFileSync("daodejin.mut",JSON.stringify(layermutation.exportJSON()),"utf8");
});

it("create markup",function(){
	layermarkup=API.layermarkup.create(layerdoc);
	m1=layermarkup.createMarkup("1",35,4);

	var inscription=layermarkup.inscriptionOf(m1);
	assert.equal(inscription,"欲觀其妙");

	fs.writeFileSync("daodejin.mrk",JSON.stringify(layermarkup.exportJSON()),"utf8");
});

it("upgrade base text",function(done){

	var layermutation=API.layermarkup.create(layerdoc);
	layermutation.importJSON(JSON.parse(fs.readFileSync("daodejin.mut","utf8")));

	layerdoc.evolve(layermutation.markups,function(){

		layermarkup.upgrade();

		inscription=layermarkup.inscriptionOf(m1);
		assert.equal(inscription,"欲觀其妙");

		fs.writeFileSync("daodejin2.ver",layerdoc.exportVersions(),"utf8");
		fs.writeFileSync("daodejin2.csv",layerdoc.exportCSV(),"utf8");

		done();
	});

});

it("upgrade markup to latest base text",function(){

	/*
		.csv is the latest version of text+rawtags 
        .ver files keep all revisions info. one .ver per db

        .csv or .ver can be extracted from kdb

        .mut is changes going to make

        currently only one directional upgrade of base text is supported.
        since the version number is unique,
        it is trivial to support branching machenism in the future.

	*/
	var ver=JSON.parse(fs.readFileSync("daodejin2.ver","utf8"));
	var csv=fs.readFileSync("daodejin2.csv","utf8");
	assert.equal(csv.indexOf('萬物母．<pb n="1.c"/>常無')>-1,true);

	layerdoc=API.layerdoc.createFromCSV(csv,{name:"daodejin",version:ver.latestversion,versions:ver.versions});

	layermarkup=API.layermarkup.create(layerdoc);
	layermarkup.importJSON(JSON.parse(fs.readFileSync("daodejin.mrk","utf8")));

	oldversion=layermarkup.get(m1);

	assert.equal(layermarkup.version!==layerdoc.version,true); //different version
	assert.equal(inscription,"欲觀其妙");                       //markups based on old version still works

	layermarkup.upgrade();                       //now sync with the latest version TODO

	newversion=layermarkup.get(m1);

	assert.equal(newversion[0]-oldversion[0],2); //new version markup has advance 2 也
	assert.equal(newversion[1],oldversion[1]);   //same length
	inscription=layermarkup.inscriptionOf(m1);
	assert.equal(inscription,"欲觀其妙");

	//write new markup files
	fs.writeFileSync("daodejin2.mrk",JSON.stringify(layermarkup.exportJSON()),"utf8");

	assert.equal(layermarkup.version,layerdoc.version);  //same version
});


});