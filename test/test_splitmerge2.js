var assert=require("assert");
var layerMarkup=require("..").layermarkup;
var layerDoc=require("..").layerdoc_full;
var fs=require("fs");
var layerdoc=null;
var layermarkup=null;
var m1,m2=null;
/* discrepancy*/

describe("split merge paragraph",function() {

it("split",function(done){
	layerdoc=layerDoc.create();
	layerdoc.put("a","122333");
	var layermutation=layerMarkup.create(layerdoc);
	layermutation.splitPara("a","b",1);
	layermutation.splitPara("a","c",3);

	//layermutation.createMarkup("a",1,0,{"_segment":"b"});
	//layermutation.createMarkup("a",3,0,{"_segment":"c"});
	
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
	assert.equal(layerdoc.get("b",-1),undefined);
	assert.equal(layerdoc.get("c",-1),undefined);
});


it("merge",function(done){
	layerdoc=layerDoc.create();
	layerdoc.put("a","1");
	layerdoc.put("b","22");
	layerdoc.put("c","333");

	var layermutation=layerMarkup.create(layerdoc);

	layermutation.mergePara("b","a");
	layermutation.mergePara("c","a");

	//layermutation.createMarkup("b",0,0,{"_merge":"a"}); //we don't need to mention start,len , it will become 1,2
	//layermutation.createMarkup("c",0,0,{"_merge":"a"}); 

	layerdoc.evolve(layermutation,function(){
		//console.log(JSON.stringify(layerdoc.versions));
		assert.equal(layerdoc.ndoc,1);
		assert.equal(layerdoc.get("a"),"122333");

		assert.equal(layerdoc.versions[0].revisions.b[0].s,1); //insert "b" at 1 of "a"
		assert.equal(layerdoc.versions[0].revisions.b[0].l,2); //length of "b"

		assert.equal(layerdoc.versions[0].revisions.c[0].s,3); //insert "c" at 3 of "a"
		assert.equal(layerdoc.versions[0].revisions.c[0].l,3); //length of "c"

		assert.equal(!!layerdoc.get("b"),false); //not exist in this version
		assert.equal(!!layerdoc.get("c"),false); //not exist in this version
		
		//console.log(JSON.stringify(layerdoc.versions));
		assert.equal(layerdoc.get("b",-1),"22");
		assert.equal(layerdoc.get("c",-1),"333");
		done();
	});

});


it("split than merge",function(done){
	layerdoc=layerDoc.create();
	layerdoc.put("a","1");
	layerdoc.put("a1","1二");
	layerdoc.put("b1","223333");

	var layermutation=layerMarkup.create(layerdoc);
	//layermutation.createMarkup("a1",1,0,{"_segment":"b"}); 
	//layermutation.createMarkup("b1",2,0,{"_segment":"c"}); 
	layermutation.splitPara("a1","b",1);
	layermutation.splitPara("b1","c",2);

	layerdoc.evolve(layermutation,function(){
		assert.equal(layerdoc.get("a"),"1");
		assert.equal(layerdoc.get("a1"),"1");
		assert.equal(layerdoc.get("b"),"二");
		assert.equal(layerdoc.get("b1"),"22");
		assert.equal(layerdoc.get("c"),"3333");

		layermutation=layerMarkup.create(layerdoc);
		//layermutation.createMarkup("a1",0,0,{"_merge":"a"}); 
		//layermutation.createMarkup("b1",0,0,{"_merge":"b"}); 

		layermutation.mergePara("a1","a");
		layermutation.mergePara("b1","b");
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
	layerdoc=layerDoc.create();
	layerdoc.put("a","1Q22");
	layerdoc.put("b","二");
	layerdoc.put("b1","2223333");
	layerdoc.put("d","44444");
	layerdoc.put("e","55555");

	var layermutation=layerMarkup.create(layerdoc);
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
	layerdoc=layerDoc.create();
	layerdoc.put("a","11112<tag/>222");
	layerdoc.put("c","3333");
	layerdoc.put("d","44<tag2/>44");

	var layermutation=layerMarkup.create(layerdoc);
	layermutation.splitPara("a","a1",4); 
	layermutation.mergePara("d","c");

	layerdoc.evolve(layermutation,function(){
		assert.equal(layerdoc.rawtags["a1"][0][0],1);
		assert.equal(layerdoc.rawtags["c"][0][0],6);
		done();
	});
});


it("migrate markup tag",function(done){
	layerdoc=layerDoc.create();
	layerdoc.put("a","1111二222");
	layerdoc.put("c","3333");
	layerdoc.put("d","四444");


	layermarkup=layerMarkup.create(layerdoc);
	var m1=layermarkup.createMarkup("a",4,2);


	assert.equal(layermarkup.inscriptionOf(m1),"二2");

	var m2=layermarkup.createMarkup("d",0,2);
	assert.equal(layermarkup.inscriptionOf(m2),"四4");

	var layermutation=layerMarkup.create(layerdoc);
	layermutation.splitPara("a","a1",4); 
	layermutation.mergePara("d","c");

	layerdoc.evolve(layermutation,function(){
		

		assert.equal(layermarkup.inscriptionOf(m1),"二2");
		assert.equal(layermarkup.inscriptionOf(m2),"四4");

		layermarkup.upgrade(); 
		//console.log(JSON.stringify(layermarkup.markups));
		assert.equal(layermarkup.inscriptionOf(m1),"二2");
		assert.equal(layermarkup.inscriptionOf(m2),"四4");
		done();
	});
});


it("rename para",function(done){
	layerdoc=layerDoc.create();
	layerdoc.put("a","1111");
	layerdoc.put("b","2222");

	layermarkup=layerMarkup.create(layerdoc);
	var m1=layermarkup.createMarkup("a",1,2);

	layerrename=layerMarkup.create(layerdoc);
	var m2=layerrename.renamePara("a","AA");
	layerdoc.evolve(layerrename,function(){

		layermarkup.upgrade();
		assert.equal(layerdoc.get("AA"),"1111");
		assert.equal(layermarkup.inscriptionOf(m1),"11");
		assert.equal(layermarkup._segidOfuuid[m1],"AA");

		
		assert.equal(layerdoc.get("a"),undefined);
		assert.equal(layerdoc.get("a",-1),"1111");

		layermarkup=layerMarkup.create(layerdoc);

		layerrename2=layerMarkup.create(layerdoc);
		var m2=layerrename2.renamePara("AA","AAA");
		layerdoc.evolve(layerrename2,function(){
			assert.equal(layerdoc.get("AAA"),"1111");
			assert.equal(layerdoc.get("AA",-1),"1111");
			assert.equal(layerdoc.get("a",-2),"1111");
		});



		done();
	});

});



});