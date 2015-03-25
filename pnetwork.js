/*
   Paradigm network
   port from ksana/ksana-paradigm
   SPAN  CODE (scode) =  markupid*maxdb     //markupid is even number
   PNODE CODE (pcode) =                    //odd number
   code means scode or pcode
   
   structure:
   SPAN  = [start, len, {uuid, ..payload} ]

           //code can be span or pnode , desc is string
   PNODE = [{uuid,...payload}, code1, desc1 , code2 , desc2]  

*/


var createLayer=require("./layermarkup").create;
var UUID=require("./uuid");

var createPNetwork=function(opts) {
	opts=opts||{};
	var layers={};
	var network={};
	var nodes={};
	var usedBy={};
	var maxdb=opts.maxdb||128; //maximum connect to 128 database

	var addDoc=function(_docs) { //need to put layerdoc before creating span and node
		if (typeof _docs[0]=="undefined") _docs=[_docs];
		_docs.map(function(d,idx){layers[d.name]=createLayer(d,{seq:idx});});
	}

	//inverted index, given code, return an array of pcodes consisting the code.
	var _addUsedBy=function(data,code) {
		for (var i=0;i<data.length;i++) {
			if (typeof data[i]!=="number") continue;
			var child=Math.abs(data[i]);  //negative value for opened child
			if (!usedBy[child]) usedBy[child]=[];
			usedBy[child].push(code);
		}
	}

	var _removeUsedBy=function(data,code) {
		for (var i=0;i<data.length;i++) {
			if (typeof data[i]!=="number") continue;
			var child=Math.abs(data[i]);
			var idx=usedBy[child].indexOf(code);
			if (idx>-1) usedBy[child].splice(idx,1);
		}
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

	var createNode=function(children,payload) {
		payload=payload||{};
		var pcode=UUID()+1;
		payload.uuid=pcode;
		if (!(children instanceof Array)) children=[children];

		var arr=[payload].concat(children);
		nodes[pcode]=arr;
		_addUsedBy(arr,pcode);

		return pcode;
	}

	var contain=function(pcode) {
		return usedBy[pcode] ||[];
	}

	var changeNode=function(pcode,newchildren,newpayload) {
		var children=nodes[pcode];
		if (!children) {
			network.lasterror="node not found";
			return true;
		}

		nodes[pcode]=[newpayload||children[0]].concat(newchildren);

		//update inverted index
		var arrdiff=function(a1,a2){ //return item found in a1 but not in a2
			return a1.filter(function(i) {return a2.indexOf(i) < 0;});
		}
		_removeUsedBy(arrdiff(children,newchildren), pcode);
		_addUsedBy   (arrdiff(newchildren,children), pcode);

		return false;
	}

	var getLayer=function(seq) {
		for (var i in layers) {
			if (layers[i].seq===seq) return layers[i];
		}
		return null;
	}
	var fetchSpan=function(scode) {
		var layer=getLayer(Math.floor(scode) % maxdb );
		if (!layer) return null;

		var code=Math.floor(scode /maxdb);
		return {layer:layer,code:code,markup:layer.get(code)};
	}

	var get=function(code) {
		if (code%2==1) {
			return nodes[code];
		} else {
			var span=fetchSpan(code);
			if (span && span.markup) return span.markup;
		}
		return null;
	}

	var getPayload=function(code) {
		var res=get(code);
		return (code%2==1)?res[0]:res[2];	
	}	

	var inscriptionOf=function(scode) {
		var span=fetchSpan(scode);
		if (span && span.code) span.layer.inscriptionOf(span.code);
	}

	var inscriptionOfAsync=function(scode,cb) {
		var span=fetchSpan(scode);
		if (span && span.code) span.layer.inscriptionOfAsync(span.code,cb);
		else cb(null);
	}

	network.lasterror="";
	network.addDoc=addDoc;
	network.createSpan=createSpan;
	network.createNode=createNode;
	network.contain=contain;
	network.changeNode=changeNode;
	network.getPayload=getPayload;
	network.inscriptionOfAsync=inscriptionOfAsync;
	network.inscriptionOf=inscriptionOf;
	return network;
}
module.exports={create:createPNetwork};