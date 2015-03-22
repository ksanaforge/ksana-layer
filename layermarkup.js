/* markup layer based on doc, mutate==true for mutating markup*/

var createLayer=function(doc,opts) {
	opts=opts||{};
	var layer={name:opts.name,doc:doc,mutate:opts.mutate};
	var version=doc.version;
	var _markups={};
	Object.defineProperty(layer,'version',{get:function(){return version}});
	Object.defineProperty(layer,'markups',{get:function(){return _markups}});

	var put=function(segid,start,len,payload) {
		var m=[start,len,payload];
		if (!_markups[segid]) _markups[segid]=[];
		_markups[segid].push(m);
		return m;
	}
	var get=function(segid,n) {
		var markups=_markups[segid];
		if (!markups) return null;
		return markups[n];
	}

	var remove=function(segid,n) {
		var markups=_markups[segid];
		if (!markups) return null;
		var r=markups[n];
		_markups[segid]=markups.splice(n,1);
		return r;
	}

	var find=function(segid,start,len) { //get all markups has exact same start and len(optional)
		var out=[];
		var markups=_markups[segid];
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
		var markups=_markups[segid];
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
		var inscription=doc.get(segid,version);
		if (typeof inscription==="undefined") return "";
		if (typeof m=="number") m=get(segid,m);
		return inscription.substr(m[0],m[1]);
	}

	var adjustOffset=function(revs,m) {
		var s=m[0], l=m[1], delta=0, deleted=false;
		if (l<0) l=0;
		revs.map(function(rev){
			if (rev[0]<=s) { //this will affect the offset
				delta+= (rev[2].t.length-rev[1]);
			}
			if (rev[0]<=s && rev[0]+rev[1]>=s+l) {
				deleted=true;
			}
		});
		s+=delta;
		if (deleted) { //len=-n value if not upgradable since last n version
			if (m[1]>=0) l=-1; else l=m[1]-1;
		}
		return [s,l,m[2]];
	}
	var upgrade=function(ver) {	 // upgrade markups to lastest version of doc
		if (!ver) ver=doc.version;
		if (ver===version) return; 

		var reverts=layer.doc.reverts;
		for (var segid in _markups) {

			var markups=_markups[segid];

			for (var i=0;i<reverts.length;i++) {
				var forward=reverts[i].revisions[segid];
				if (forward) {
					for (var j=0;j<markups.length;j++)	markups[j]=adjustOffset(forward, markups[j]);
				}
				if (reverts[i].version==version) break;
			}

		}
		version=doc.version;
	}

	layer.put=put;
	layer.get=get;
	layer.find=find;
	layer.findAt=findAt;
	layer.getInscription=getInscription;
	layer.upgrade=upgrade;
	return layer;
}

module.exports={create:createLayer};