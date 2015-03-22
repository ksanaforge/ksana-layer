var guid=function() {
  var s4=function() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

var generateVersion=function() {
	return guid();
}
var createLayer=function(doc,opts) {
	opts=opts||{};
	var layer={name:opts.name,doc:doc,markups:{},mutate:opts.mutate,version:doc.version};

	var put=function(segid,start,len,payload) {
		var m=[start,len,payload];
		if (!layer.markups[segid]) layer.markups[segid]=[];
		layer.markups[segid].push(m);
		return m;
	}
	var get=function(segid,n) {
		var markups=layer.markups[segid];
		if (!markups) return null;
		return markups[n];
	}

	var remove=function(segid,n) {
		var markups=layer.markups[segid];
		if (!markups) return null;
		var r=markups[n];
		layer.markups[segid]=markups.splice(n,1);
		return r;
	}

	var find=function(segid,start,len) { //get all markups has exact same start and len(optional)
		var out=[];
		var markups=layer.markups[segid];
		if (!markups) return out;

		for (var i=0;i<markups.length;i++) {
			var m=markups[i];
			if (m[0]===start && len && m[1]==len) {
				out.push(i);
			}
		}
		return out;
	}

	var findAt=function(segid,pos) { //get all markups at position
		var out=[];
		var markups=layer.markups[segid];
		if (!markups) return out;

		for (var i=0;i<markups.length;i++) {
			var m=markups[i];
			if (pos>=m[0] && pos<m[0]+m[1]) {
				out.push(i);
			}
		}
		return out;
	}

	var getInscription=function(segid,m) {
		var inscription=doc.get(segid);
		if (typeof inscription==="undefined") return "";
		return inscription.substr(m[0],m[1]);
	}
	layer.put=put;
	layer.get=get;
	layer.find=find;
	layer.findAt=findAt;
	layer.getInscription=getInscription;
	return layer;
}



var createDocument=function(opts) {
	opts=opts||{};
	var doc={name:opts.name,version:generateVersion()};
	var segs={};
	var ndoc=0;
	
	Object.defineProperty(doc,'ndoc',{get:function(){return ndoc}});

	var get=function(segid) {
		return segs[segid];
	}

	var evolve=function(mutationlayer) {
		var applyMutation=function(revisions,text){
			revisions.map(function(r){
				text=text.substring(0,r[0])+r[2].t+text.substring(r[0]+r[1]);
			});
			return text;
		}

		for (var segid in mutationlayer.markups) {
			var revisions=mutationlayer.markups[segid];
			revisions.sort(function(a,b){return b[0]-a[0]});//start from end
			
			var newtext=applyMutation(revisions,doc.get(segid));
			if (!segs[segid]) throw("text to set doesn't exists",segid);
			segs[segid]=newtext;
		}
	}

	var put=function(id,entry) {
		if (segs[id]) {
			console.error("id",id,"already exists");
			return false;
		}
		segs[id]=entry;
		ndoc++;
	}
	doc.get=get;
	doc.put=put;
	doc.evolve=evolve;
	return doc;
}

var createFromCSV=function(buf) {
	var layerdoc=createDocument();
	var lines=buf.replace(/\r\n/g,"\n").split("\n");
	for (var i=0;i<lines.length;i++) {
		var L=lines[i];
		var comma=L.indexOf(",");
		if (comma==-1) {
			throw "not a csv at line "+i;
			return;
		}
		layerdoc.put(L.substr(0,comma),L.substr(comma+1));
	}

	return layerdoc;
}
module.exports={createFromCSV:createFromCSV,createLayer:createLayer}