var assert=require("assert");
var API=require("..");
var kde=require("ksana-database");
var layerdoc=null;
var layermarkup=null;
var m1,m2=null;
describe("layer document backed by kdb",function() {


it("create from kdb",function(done){
	kde.open("daodejin",function(err,kdb){
		if (err) throw "cannot open daodejin.kdb";

		layerdoc=API.layerdoc.createFromKdb(kdb);
		assert.equal(layerdoc.ndoc,82);
		done();
	})
});

it("get async inscription",function(done){
	var segid="1",thetext="欲觀其妙";
	layermarkup=API.layermarkup.create(layerdoc);
	m1=layermarkup.createMarkup(segid,35,4);

	var ins=layermarkup.inscriptionOf(m1); //data not loaded yet
	assert.equal(ins,"");

	layermarkup.inscriptionOfAsync(m1,function(inscription){
		assert.equal(inscription,thetext);

		var ins=layermarkup.inscriptionOf(m1); //sync version works now;
		assert.equal(ins,thetext);

		done();
	});
	


	
});

});