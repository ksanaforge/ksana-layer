/*
   paradigm network
   port from ksana/ksana-paradigm
   SPAN =  markupid,maxdb,0  //even number
   PCODE=  id,1              //odd number
   
   PCODE is independent from db   

*/


var createLayer=require("./layermarkup").create;
var UUID=require("./uuid");

var createPNetwork=function(opts) {
	opts=opts||{};
	var layers={};
	var network={};
	var nodes={};
	var usedBy={};
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

	var _addUsedBy=function(data,code) {
		for (var i=0;i<data.length;i++) {
			if (typeof data[i]!=="number") continue;
			var child=data[i];
			if (!usedBy[child]) usedBy[child]=[];
			usedBy[child].push(code);
		}
	}

	var _removeUsedBy=function(data,code) {
		for (var i=0;i<data.length;i++) {
			if (typeof data[i]!=="number") continue;
			var child=data[i];
			var idx=usedBy[child].indexOf(code);
			if (idx>-1) usedBy[child].splice(idx,1);
		}
	}

	var createNode=function(children,payload) {
		payload=payload||{};
		var pcode=UUID()+1;
		if (!(children instanceof Array)) children=[children];

		var arr=[payload].concat(children);
		nodes[pcode]=arr;
		_addUsedBy(arr,pcode);

		return pcode;
	}

	var by=function(pcode) {
		return usedBy[pcode] ||[];
	}

	var changeNode=function(pcode,newchildren,newpayload) {
		var children=nodes[pcode];
		if (!children) {
			network.lasterror="node not found";
			return null;
		}

		nodes[pcode]=[newpayload||{}].concat(newchildren);

		var arrdiff=function(a1,a2){ //return item found in a1 but not in a2
			return a1.filter(function(i) {return a2.indexOf(i) < 0;});
		}
		_removeUsedBy(arrdiff(children,newchildren), pcode);
		_addUsedBy   (arrdiff(newchildren,children), pcode);

		return true;
	}
	network.lasterror="";
	network.addDoc=addDoc;
	network.createSpan=createSpan;
	network.createNode=createNode;
	network.by=by;
	network.changeNode=changeNode;
	return network;
}
module.exports={create:createPNetwork};
