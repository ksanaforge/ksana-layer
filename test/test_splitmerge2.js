var assert=require("assert");
var API=require("..");
var fs=require("fs");
var layerdoc=null;
var layermarkup=null;
var m1,m2=null;

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
it("create",function(){
	layerdoc=API.layerdoc.create();
	layerdoc.put("a","122333");

	var layermutation=API.layermarkup.create(layerdoc);
	layermutation.createMarkup("a",1,0,{"p":"a1"});
	layermutation.createMarkup("a",3,0,{"p":"b1"});
	
	layerdoc.evolve(layermutation,function(){
		console.log(layerdoc.ndoc);
	});
});

});