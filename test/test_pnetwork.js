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

	span1=pn.createSpan("shijin","蒹葭",15,4,{author:"yap"});
	
	assert.equal(!!span1,true);	

	span2=pn.createSpan("daodejin","1",35,4);

});

it("create pnode",function(){
	//create 
	pnode1=pn.createNode([span1,"desc1",span2,"desc2"],{type:"test"});
	assert.equal(pnode1%2,1);
	
	assert.equal(pn.contain(span1).indexOf(pnode1)>-1,true);
	assert.equal(pn.contain(span2).indexOf(pnode1)>-1,true);
});

it("change pnode",function(){

	pn.changeNode(pnode1,[span1,"desc1"]);

	assert.equal(pn.contain(span1).indexOf(pnode1)>-1,true);
	assert.equal(pn.contain(span2).indexOf(pnode1)>-1,false);

});

it("get payload of span",function(){
	var py=pn.getPayload(span1);
	assert.equal(py.author,"yap")
});

it("get payload of pnode",function(){
	var py=pn.getPayload(pnode1);
	assert.equal(py.type,"test")
});


it("get inscription",function(done){
	var thetext="欲觀其妙";

	pn.inscriptionOfAsync(span2,function(ins){
		assert.equal(ins,thetext);
		done();
	});
	
});

it("composite pnode",function(){
	pnode2=pn.createNode([pnode1,"desc1",span2,"desc2"],{type:"test2"});

	assert.equal(pn.contain(span2).indexOf(pnode2)>-1,true);
	assert.equal(pn.contain(pnode1).indexOf(pnode2)>-1,true);
	assert.equal(pn.contain(span1).indexOf(pnode2)>-1,false);

})


});

