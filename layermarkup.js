/* markup layer based on doc, mutate==true for mutating markup*/
var lastuuid=0;
var generateUUID=function() {
	var uuid=Date.now() - Date.parse("2015/3/1");
	if (uuid==lastuuid) {
		uuid+=1;
	}
	lastuuid=uuid;
	return uuid;
}

var createLayer=function(doc,opts) {
	opts=opts||{};
	var layer={name:opts.name||"noname",doc:doc};
	var _version=doc.version;
	var _markups={}; //need to serialized
	var segidOfuuid={}; //key uuid, value seg

	Object.defineProperty(layer,'version',{get:function(){return _version}});
	Object.defineProperty(layer,'markups',{get:function(){return _markups}});

	var createMarkup=function(segid,start,len,payload) {
		var uuid=generateUUID();
		var markup=[start,len,payload,uuid];
		segidOfuuid[uuid]=segid;

		if (!_markups[segid]) _markups[segid]=[];
		_markups[segid].push(markup);
		return uuid;
	}

	var inscriptionOf=function(uuid) {
		var segid=segidOfuuid[uuid];
		var markup=findMarkup(uuid);
		
		var ins=layer.doc.get(segid,_version);
		if (typeof ins==="undefined") return "";
		return ins.substr(markup[0],markup[1]);
	}

	var findMarkup=function(uuid) {
		var segid=segidOfuuid[uuid];
		var markups=_markups[segid]||[];
		for (var i=0;i<markups.length;i++) {
			if (markups[i][3]===uuid) {
				return markups[i];
			}
		}
		return null;
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
		return [s,l,m[2],m[3]];
	}
	var upgrade=function(ver) {	 // upgrade markups to lastest version of doc
		if (!ver) ver=doc.version;
		if (ver===_version) return; 

		var reverts=layer.doc.reverts;
		for (var segid in _markups) {
			var markups=_markups[segid];
			for (var i=0;i<reverts.length;i++) {
				var forward=reverts[i].revisions[segid];
				if (forward) {
					for (var j=0;j<markups.length;j++)	markups[j]=adjustOffset(forward, markups[j]);
				}
				if (reverts[i].version==_version) break;
			}
		}
		_version=doc.version;
	}
	var exportJSON=function() {
		return {
			name:layer.name
			,version:_version
			,markups:_markups
		}
	}

	var _rebuildSegidOfuuid=function() {
		segidOfuuid={};
		for (var segid in _markups) {
			var M=_markups[segid];
			for (var i=0;i<M.length;i++) {
				segidOfuuid[M[i][3]]=segid;
			}
		}
	}
	var importJSON=function(json) {
		if (!json || typeof json.name!=="string" || typeof json.markups !=="object") {
			throw "invalid json to import";
		}

		layer.name=json.name;
		_version=json.version;
		_markups=json.markups;
		_rebuildSegidOfuuid();
	}

	layer.findMarkup=findMarkup;
	layer.inscriptionOf=inscriptionOf;
	layer.upgrade=upgrade;
	layer.createMarkup=createMarkup;
	layer.importJSON=importJSON;
	layer.exportJSON=exportJSON;

	return layer;
}

module.exports={create:createLayer};