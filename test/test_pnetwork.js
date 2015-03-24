var assert=require("assert");
var API=require("..");
var kde=require("ksana-database");
var layerdoc=null;
var layermarkup=null;
var span1,span2=null;
var shijin,daodejin;

describe("pnode",function() {
it("open kdb",function(done){
	kde.open("shijin",function(err,db1){
		if (err) throw "cannot open shijin";
		shijin=API.layerdoc.createFromKdb(db1);

		kde.open("daodejin",function(err,db2){
			if (err) throw "cannot open daodejin";
			daodejin=API.layerdoc.createFromKdb(db2);
			
			done();
		});
	})
});

it("create span in pnetwork",function(){	
	var pn=API.pnetwork.create();
	pn.addDoc([shijin,daodejin]);
	var wrongdbname="xx";

	span1=pn.createSpan(wrongdbname,"蒹葭",15,4);
	assert.equal(span1,null);

	span1=pn.createSpan("shijin","xx",15,4);
	assert.equal(span1,null);

	span1=pn.createSpan("shijin","蒹葭",15,4);
	
	assert.equal(!!span1,true);	
});


it("save and load pnetwork",function(){


});


});

