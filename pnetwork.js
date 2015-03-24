/*
   paradigm network
   port from ksana/ksana-paradigm


*/


var createLayer=require("./layermarkup").create;

/*
   SPAN =  markupid,maxdb,0  //even number
   PCODE=  id,1              //odd number
*/
var createPNetwork=function(opts) {
	opts=opts||{};
	var layers={};
	var network={};
	var maxdb=opts.maxdb||128;

	var addDoc=function(_docs) {
		if (typeof _docs[0]=="undefined") _docs=[_docs];
		_docs.map(function(d,idx){layers[d.name]=createLayer(d,{seq:idx});});
	}

	var createSpan=function(dbname,segid,start,len,payload) {
		var layer=layers[dbname];
		if (!layer) {
			console.error("no such db "+dbname);
			return null;
		}

		if (!layer.doc.has(segid)) {
			console.error("no such segid "+segid);
			return null;			
		}
		return layer.createMarkup(segid,start,len,payload)*maxdb+layer.seq;
	}

	network.lasterror="";
	network.addDoc=addDoc;
	network.createSpan=createSpan;
	return network;
}
module.exports={create:createPNetwork};


