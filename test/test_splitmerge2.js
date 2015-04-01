var assert=require("assert");
var API=require("..");
var fs=require("fs");
var layerdoc=null;
var layermarkup=null;
var m1,m2=null;
/*
discrepancy
*/

describe("split merge paragraph",function() {
var v1,v2;

/*
    122333  ==>   1
                  22
                  333

    11        ==> 1122333
    222
    333

	111222   ==>  111
	二            222二
*/


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
		console.log(JSON.stringify(layerdoc.versions));
		assert.equal(layerdoc.ndoc,1);
		assert.equal(layerdoc.get("a"),"122333");

		assert.equal(layerdoc.versions[0].revisions.b[0][0],1); //insert "b" at 1 of "a"
		assert.equal(layerdoc.versions[0].revisions.b[0][1],2); //length of "b"

		assert.equal(layerdoc.versions[0].revisions.c[0][0],3); //insert "c" at 3 of "a"
		assert.equal(layerdoc.versions[0].revisions.c[0][1],3); //length of "c"

		assert.equal(!!layerdoc.get("b"),false);
		assert.equal(!!layerdoc.get("c"),false);
		
		assert.equal(layerdoc.get("b",-1),"22");
		assert.equal(layerdoc.get("c",-1),"333");
		done();
	});

});

});