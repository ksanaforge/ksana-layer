var UUID=require("./uuid");
//convert revert and revision back and forth
var revertRevision=function(revs,inscription) {
	var reverts=[], offset=0;
	revs.sort(function(m1,m2){return m1[0]-m2[0];});
	revs.map(function(r){
		var newinscription="";
		var	m=JSON.parse(JSON.stringify(r));
		var newtext=inscription.substr(r[0],r[1]);
		m[0]+=offset;
		var text=m[2].t||"";
		m[1]=text.length;
		m[2].t=newtext;
		offset+=m[1]-newtext.length;
		reverts.push(m);
	});
	reverts.sort(function(a,b){return b[0]-a[0];});
	return reverts;
};


var createDocument=function(opts) {
	opts=opts||{};
	var doc={name:opts.name||"noname"};

	var segs={};
	var reverts=[];  /* revert to old version, [ version, invert_revisions ]  */
	var ndoc=opts.ndoc||0;

	var version=opts.version||UUID();
	

	Object.defineProperty(doc,'ndoc',{get:function(){return ndoc}});
	//Object.defineProperty(doc,'name',{get:function(){return name}});
	Object.defineProperty(doc,'reverts',{get:function(){return reverts}});
	Object.defineProperty(doc,'version',{get:function(){return version}});


	var applyMutation=function(revisions,text){
		revisions.map(function(r){
			text=text.substring(0,r[0])+(r[2].t||"")+text.substring(r[0]+r[1]);
		});
		return text;
	}

	var get=function(segid,ver) {
		var inscription=segs[segid];

		if (typeof ver==="undefined" || ver===version) return segs[segid];

		if (!hasVersion(ver)) return null;

		for (var i=reverts.length-1;i>=0;i--) {
			var revs=reverts[i].reverts[segid];

			if (revs) inscription=applyMutation(revs, inscription);
			if (reverts[i].version==ver) break;
		}
		return inscription;
	}

	var getAsync=function(segid,cb,ver) { //virtual method
		if (cb) cb(get(segid,ver));
	}
	var prefetch=function(segments,cb) { //virtual method
		cb();
	}

	var evolve=function(markups,cb) {
		prefetch(Object.keys(markups),function(){
			var segreverts={};
			for (var segid in markups) {
				var revisions=markups[segid];
				var oldinscription=get(segid);
				segreverts[segid]=revertRevision(revisions,oldinscription);

				revisions.sort(function(a,b){return b[0]-a[0]});//start from end

				var newtext=applyMutation(revisions,oldinscription);
				if (!segs[segid]) throw("text to set doesn't exist",segid);
				segs[segid]=newtext;
			}

			reverts.push({version:version, reverts:segreverts, revisions:JSON.parse(JSON.stringify(markups)) });
			version=UUID();
			if (cb) cb();
		})
	}

	var put=function(id,entry) {
		if (segs[id]) {
			console.error("id",id,"already exists");
			return false;
		}
		segs[id]=entry;
		ndoc++;
	}


	var _segs=function() {
		return segs;
	}

	var hasVersion=function(version) {
		if (version===doc.version) return true;
		return reverts.filter(function(r){return r.version===version}).length==1;
	}

	var has=function(segname) {
		return !!segs[segname];
	}

	doc.get=get;
	doc.put=put;
	doc.evolve=evolve;
	doc.prefetch=prefetch;

	doc._segs=_segs;
	doc.getAsync=getAsync;
	doc.has=has;

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
module.exports={createFromCSV:createFromCSV,create:createDocument};