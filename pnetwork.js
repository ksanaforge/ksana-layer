/*
   paradigm network
   port from ksana/ksana-paradigm


*/


var createLayer=require("./layermarkup").create;

var createPNetwork=function() {
	var layers={};
	var network={};

	var addDoc=function(_docs) {
		if (typeof _docs[0]=="undefined") _docs=[_docs];
		_docs.map(function(d){layers[d.name]=createLayer(d);});
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

		return layer.createMarkup(segid,start,len,payload);
	}

	network.lasterror="";
	network.addDoc=addDoc;
	network.createSpan=createSpan;
	return network;
}
module.exports={create:createPNetwork};


