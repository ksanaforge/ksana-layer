var assert=require("assert");
var API=require("..");
var kde=require("ksana-database");
var layerdoc=null;
var layermarkup=null;
var span1,span2=null;
var pnode1,pnode2,pnode3;
var shijin,daodejin;
var pn;

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

it("create span",function(){	
	pn=API.pnetwork.create();
	pn.addDoc([shijin,daodejin]);
	var wrongdbname="xx";

	span1=pn.createSpan(wrongdbname,"蒹葭",15,4);
	assert.equal(span1,null);

	span1=pn.createSpan("shijin","xx",15,4);
	assert.equal(span1,null);

	span1=pn.createSpan("shijin","蒹葭",15,4);
	
	assert.equal(!!span1,true);	

	span2=pn.createSpan("daodejin","1",35,4);

});

it("create pnode",function(){
	//create 
	pnode1=pn.createNode([span1,"desc1",span2,"desc2"]);
	assert.equal(pnode1%2,1);
	
	assert.equal(pn.by(span1).indexOf(pnode1)>-1,true);
	assert.equal(pn.by(span2).indexOf(pnode1)>-1,true);
});

it("change pnode",function(){

	pn.changeNode(pnode1,[span1,"desc1"]);


	assert.equal(pn.by(span1).indexOf(pnode1)>-1,true);
	assert.equal(pn.by(span2).indexOf(pnode1)>-1,false);

});


});

