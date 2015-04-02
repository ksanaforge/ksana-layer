var assert=require("assert");
var API=require("..");
var fs=require("fs");
var layerdoc=null;
var layermarkup=null;
var m1,m2=null;
/* discrepancy*/

describe("split merge paragraph",function() {

it("split",function(done){
	layerdoc=API.layerdoc.create();
	layerdoc.put("a","122333");
	var layermutation=API.layermarkup.create(layerdoc);
	layermutation.createMarkup("a",1,0,{"p":"b"});
	layermutation.createMarkup("a",3,0,{"p":"c"});
	
	layerdoc.evolve(layermutation,function(){
		assert.equal(layerdoc.ndoc,3);
		assert.equal(layerdoc.get("a"),"1");
		assert.equal(layerdoc.get("b"),"22");
		assert.equal(layerdoc.get("c"),"333");
		done();
	});
});

it("split backward",function(){
	//console.log(JSON.stringify(layerdoc.versions));
	assert.equal(layerdoc.get("a",-1),"122333");
	assert.equal(layerdoc.get("b",-1),"");
	assert.equal(layerdoc.get("c",-1),"");
});


it("merge",function(done){
	layerdoc=API.layerdoc.create();
	layerdoc.put("a","1");
	layerdoc.put("b","22");
	layerdoc.put("c","333");

	var layermutation=API.layermarkup.create(layerdoc);
	layermutation.createMarkup("b",0,0,{"m":"a"}); //we don't need to mention start,len , it will become 1,2
	layermutation.createMarkup("c",0,0,{"m":"a"}); 

	layerdoc.evolve(layermutation,function(){
		//console.log(JSON.stringify(layerdoc.versions));
		assert.equal(layerdoc.ndoc,1);
		assert.equal(layerdoc.get("a"),"122333");

		assert.equal(layerdoc.versions[0].revisions.b[0][0],1); //insert "b" at 1 of "a"
		assert.equal(layerdoc.versions[0].revisions.b[0][1],2); //length of "b"

		assert.equal(layerdoc.versions[0].revisions.c[0][0],3); //insert "c" at 3 of "a"
		assert.equal(layerdoc.versions[0].revisions.c[0][1],3); //length of "c"

		assert.equal(!!layerdoc.get("b"),false); //not exist in this version
		assert.equal(!!layerdoc.get("c"),false); //not exist in this version
		
		//console.log(JSON.stringify(layerdoc.versions));
		assert.equal(layerdoc.get("b",-1),"22");
		assert.equal(layerdoc.get("c",-1),"333");
		done();
	});

});


it("split than merge",function(done){
	layerdoc=API.layerdoc.create();
	layerdoc.put("a","1");
	layerdoc.put("a1","1二");
	layerdoc.put("b1","223333");

	var layermutation=API.layermarkup.create(layerdoc);
	layermutation.createMarkup("a1",1,0,{"p":"b"}); 
	layermutation.createMarkup("b1",2,0,{"p":"c"}); 
	layerdoc.evolve(layermutation,function(){
		assert.equal(layerdoc.get("a"),"1");
		assert.equal(layerdoc.get("a1"),"1");
		assert.equal(layerdoc.get("b"),"二");
		assert.equal(layerdoc.get("b1"),"22");
		assert.equal(layerdoc.get("c"),"3333");

		layermutation=API.layermarkup.create(layerdoc);
		layermutation.createMarkup("a1",0,0,{"m":"a"}); 
		layermutation.createMarkup("b1",0,0,{"m":"b"}); 
		layerdoc.evolve(layermutation,function(){
			assert.equal(layerdoc.get("a"),"11");
			assert.equal(layerdoc.get("b"),"二22");
			assert.equal(layerdoc.get("c"),"3333");

			assert.equal(layerdoc.get("a",-1),"1");
			assert.equal(layerdoc.get("a",-1),"1");

			assert.equal(layerdoc.get("a1",-1),"1");
			assert.equal(layerdoc.get("b1",-1),"22");
			assert.equal(layerdoc.get("c",-1),"3333");
			assert.equal(layerdoc.get("b",-1),"二");


			assert.equal(layerdoc.get("a",-2),"1");
			//console.log(JSON.stringify(layerdoc.versions))

			assert.equal(layerdoc.get("a1",-1),"1");
			assert.equal(layerdoc.get("a1",-2),"1二");

			//console.log(layerdoc._segs());
			assert.equal(layerdoc.get("b1",-1),"22");
			assert.equal(layerdoc.get("b1",-2),"223333");
			done();
		});


	});
});

it("check validity of split/merge ",function(done){
	layerdoc=API.layerdoc.create();
	layerdoc.put("a","1Q22");
	layerdoc.put("b","二");
	layerdoc.put("b1","2223333");
	layerdoc.put("d","44444");
	layerdoc.put("e","55555");

	var layermutation=API.layermarkup.create(layerdoc);
	layermutation.splitPara("a","a1",2); 
	m=layermutation.mergePara("b","a");  //this will fail, because a is spliting
	assert.equal(m,null); //cannot merge.

	m=layermutation.splitPara("a","a2",1); 
	assert.equal(!!m,true); 

	m=layermutation.splitPara("b1","c",3); 
	assert.equal(!!m,true); 


	m=layermutation.mergePara("e","d"); 
	assert.equal(!!m,true); 

	m=layermutation.splitPara("e","ee",3); 
	assert.equal(m,null); 	 //cannot split , e is merging with d

	//console.log(JSON.stringify(layermutation.markups))
	m=layermutation.splitPara("d","dd",3); 
	assert.equal(m,null); 	 //cannot split , d is merged by e

	layerdoc.evolve(layermutation,function(){
		//console.log(layerdoc._segs())
		assert.equal(layerdoc.get("a2"),"Q")
		done();
	});

});

it("migrate internal tag",function(done){
	layerdoc=API.layerdoc.create();
	layerdoc.put("a","11112<tag/>222");
	layerdoc.put("c","3333");
	layerdoc.put("d","44<tag2/>44");


	var layermutation=API.layermarkup.create(layerdoc);
	layermutation.splitPara("a","a1",4); 
	layermutation.mergePara("d","c");

	layerdoc.debug=true;
	layerdoc.evolve(layermutation,function(){
		assert.equal(layerdoc.rawtags["a1"][0][0],1);
		assert.equal(layerdoc.rawtags["c"][0][0],6);
		done();
	});
});

});