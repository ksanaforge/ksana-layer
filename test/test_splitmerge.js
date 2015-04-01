var assert=require("assert");
var API=require("..");
var fs=require("fs");
var layerdoc=null;
var layermarkup=null;
var m1,m2=null;

describe("upgrade an csv",function() {
var v1,v2;

it("create from csv",function(){
	var csv=fs.readFileSync("./paragraph.csv","utf8");
	layerdoc=API.layerdoc.createFromCSV(csv,{name:"daodejin"});
	assert.equal(layerdoc.ndoc,3);
});

it("sort Mutation",function(){
	var revs=[
		[2,0,{"p":""}],  //para break
		[3,0,{"p":""}],

		[1,0,{"m":""}],  //merge
		[2,0,{"m":""}],

		[5,0,{"t":""}],
		[7,0,{"t":""}]
	]
	var ret=layerdoc._sortMutation(revs);
	
	assert.deepEqual(ret[0],[7,0,{"t":""}]);
	assert.deepEqual(ret[1],[5,0,{"t":""}]);
	assert.deepEqual(ret[2],[3,0,{"p":""}]);
	assert.deepEqual(ret[3],[2,0,{"p":""}]);
	assert.deepEqual(ret[4],[2,0,{"m":""}]);
	assert.deepEqual(ret[5],[1,0,{"m":""}]);
})

it("split para",function(){
	var layermutation=API.layermarkup.create(layerdoc);
	layermutation.createMarkup("a",2,0,{"p":"a1"});
	layermutation.createMarkup("b",1,0,{"p":"b1"});
	layermutation.createMarkup("c",1,0,{"p":"d"});

	//layermutation.createMarkup("b",2,0,{"t":"3"});
	v1=layerdoc.version;

	layerdoc.evolve(layermutation.markups,function(){
		assert.equal(layerdoc.get("a"),"一一");
		assert.equal(layerdoc.get("b"),"2");
		assert.equal(layerdoc.get("a1"),"二");
		assert.equal(layerdoc.get("b1"),"三三");
		assert.equal(layerdoc.get("c"),"3");
		assert.equal(layerdoc.get("d"),"四四四四");

	});

});

it("merge para",function(){
	var layermutation=API.layermarkup.create(layerdoc);
	layermutation.createMarkup("b",1,0,{"m":"a1"}); //start==1 為 a1的長度
	layermutation.createMarkup("c",2,0,{"m":"b1"}); //start==2 為 b1的長度

	v2=layerdoc.version;
	layerdoc.evolve(layermutation.markups,function(){
		assert.equal(layerdoc.get("a"),"一一");
		assert.equal(layerdoc.get("a1"),"二2");
		assert.equal(layerdoc.get("b1"),"三三3");
		assert.equal(layerdoc.get("d"),"四四四四");
	});

});
it("revert ancestor version",function(){
	//console.log(JSON.stringify(layerdoc.versions),layerdoc.version)
	//console.log(layerdoc.get("a",v1),"一一二");
	console.log(layerdoc.get("a1",v2),"二");
});

it("revert previous version",function(){

	assert.equal(layerdoc.get("a",v1),"一一二");
	assert.equal(layerdoc.get("b",v1),"2三三");
	assert.equal(layerdoc.get("c",v1),"3四四四四");

	//console.log(layerdoc.get("a",v2),"一一");
	//console.log(layerdoc.get("b",v2),"===","2");

	assert.equal(layerdoc.get("b",v2),"2");
	assert.equal(layerdoc.get("a",v2),"一一");
	assert.equal(layerdoc.get("a1",v2),"二");
	assert.equal(layerdoc.get("b1",v2),"三三");
	assert.equal(layerdoc.get("d",v2),"四四四四");
	assert.equal(layerdoc.get("c",v2),"3");

	assert.equal(layerdoc.get("a1"),"二2")

});

});
