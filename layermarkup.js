/* markup layer based on doc*/
var UUID=require("./uuid");

var createLayer=function(doc,opts) {
	opts=opts||{};
	var layer={name:doc.name||"noname",doc:doc,seq:opts.seq};
	var _version=doc.version;
	var _markups={}; //need to serialized
	var segidOfuuid={}; //key uuid, value seg

	Object.defineProperty(layer,'version',{get:function(){return _version}});
	Object.defineProperty(layer,'markups',{get:function(){return _markups}});
	Object.defineProperty(layer,'_segidOfuuid',{get:function(){return segidOfuuid}});


	var mergePara=function(segid,mergewith) { //once per 
		var oldm=_markups[segid];
		var oldm2=_markups[mergewith];
		if (oldm || oldm2) return null;//cannot merge , already have other tag.
		return createMarkup(segid,0,0,{"m":mergewith});
	}
	var isMerged=function(segid) { //check if seg is merging with other seg
		for (var i in _markups) {
			if (_markups[i].filter(function(m){return !!m[2].m}).length) return true;
		}
		return false;
	}
	var splitPara=function(segid,newpara,breakat) {
		var oldm=_markups[segid];
		if (oldm && oldm.length){
			if (oldm[0][2].m) return null; //cannot split because will be merged 
			var splits=oldm.filter(function(m){return !!m[2].p});
			if (splits.length!=oldm.length) return null;//cannot have other than p
		} 
		if (isMerged(segid))return null;

		return createMarkup(segid,breakat,0,{"p":newpara});
	}
	var renamePara=function(segid,renameto) { //once per 
		if (typeof layer.doc._segs[renameto]!=="undefined")return null;
		var oldm=_markups[segid];
		var oldm2=_markups[renameto];
		if (oldm || oldm2) return null;//cannot rename , already have other tag.		

		return createMarkup(segid,0,0,{"r":renameto});
	}
	var createMarkup=function(segid,start,len,payload) {
		if (!_markups[segid]) _markups[segid]=[];
		var uuid=UUID();
		payload=payload||{};
		payload.uuid=uuid;
		var markup=[start,len,payload];
		segidOfuuid[uuid]=segid;

		_markups[segid].push(markup);
		return uuid;
	}

	var inscriptionOf=function(uuid) {
		var segid=segidOfuuid[uuid];
		var markup=get(uuid);
		
		var ins=layer.doc.get(segid,_version);
		if (typeof ins==="undefined") return "";

		return ins.substr(markup[0],markup[1]);
	}

	var inscriptionOfAsync=function(uuid,cb) { //backed by kdb
		var segid=segidOfuuid[uuid];
		var markup=get(uuid);

		var ins=layer.doc.getAsync(segid,function(ins){
			if (typeof ins==="undefined") cb("");
			cb(ins.substr(markup[0],markup[1]));
		},_version);		
	}


	var get=function(uuid) {
		var segid=segidOfuuid[uuid];
		var markups=_markups[segid]||[];
		for (var i=0;i<markups.length;i++) {
			if (markups[i][2].uuid===uuid) {
				return markups[i];
			}
		}
		return null;
	}

	var splitSeg=function(revs,segid) {
		for (var i=0;i<revs.length;i++) {
			var rev=revs[i];
			if (typeof rev[2].p==="undefined") continue;

			var newSeg=rev[2].p;
			var splitat=rev[0]
			var newtags=[];
			var tags=_markups[segid]||[];
			tags.map(function(t){
				if (t[0]<splitat) return;
				newtags.push([t[0]-splitat,t[1],t[2]]);	

			});

			_markups[segid]=tags.filter(function(t){
				return t[0]<splitat;
			});

			if (!_markups[newSeg]) _markups[newSeg]=[];
			_markups[newSeg]=newtags;

			newtags.map(function(t){
				segidOfuuid[t[2].uuid]=newSeg;
			});
		}
	}

	var mergeSeg=function(revs,segid) {
		var mergewith=revs[0][2].m;
		if (typeof mergewith==="undefined") return;
		var tags=_markups[segid];
		var start=layer.doc.get(mergewith,-1).length; //get previous version
		var newtags=tags.map(function(t){
			return [t[0]+start,t[1],t[2]];
		});
		if (!_markups[mergewith]) _markups[mergewith]=[];
		_markups[mergewith]=_markups[mergewith].concat(newtags);

		newtags.map(function(t){
			segidOfuuid[t[2].uuid]=mergewith;
		});

		_markups[segid]=[];
	}

	var renameSeg=function(revs,segid) {
		var renameto=revs[0][2].r;
		if (typeof renameto==="undefined") return;

		var tags=_markups[segid];
		_markups[renameto]=_markups[segid];

		tags.map(function(t){
			segidOfuuid[t[2].uuid]=renameto;
		});

		_markups[segid]=[];
	}
	var adjustOffset=function(revs,m) {
		var s=m[0], l=m[1], delta=0, deleted=false;
		if (l<0) l=0;
		revs.map(function(rev){
			if (typeof rev[2].t=="undefined") return;
			if (rev[0]<=s) { //this will affect the offset
				delta+= (rev[2].t.length-rev[1]);
				if(rev[0]+rev[1]>=s+l) 	deleted=true;
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
		if (ver===_version) return; 

		var versions=layer.doc.versions;
		for (var segid in _markups) {
			var markups=_markups[segid];
			for (var i=0;i<versions.length;i++) {
				if (versions[i].version<_version) continue;
				var forward=versions[i].revisions[segid];
				if (forward) {
					mergeSeg(forward,segid);
					splitSeg(forward,segid);
					renameSeg(forward,segid);
					for (var j=0;j<markups.length;j++)	markups[j]=adjustOffset(forward, markups[j]);
				}
				//if (versions[i].version==_version) break;
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
				segidOfuuid[M[i][2].uuid]=segid;
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

	layer.get=get;
	layer.inscriptionOf=inscriptionOf;
	layer.inscriptionOfAsync=inscriptionOfAsync;
	layer.upgrade=upgrade;
	layer.createMarkup=createMarkup;
	layer.mergePara=mergePara;
	layer.splitPara=splitPara;
	layer.renamePara=renamePara;
	layer.importJSON=importJSON;
	layer.exportJSON=exportJSON;

	return layer;
}

module.exports={create:createLayer};
