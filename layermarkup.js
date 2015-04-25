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
		return createMarkup(segid,0,0,{"_merge":mergewith});
	}
	var isMerged=function(segid) { //check if seg is merging with other seg
		for (var i in _markups) {
			if (_markups[i].filter(function(m){return !!m._merge}).length) return true;
		}
		return false;
	}
	var splitPara=function(segid,newpara,breakat) {
		var oldm=_markups[segid];
		if (oldm && oldm.length){
			if (oldm[0].merge) return null; //cannot split because will be merged 
			var splits=oldm.filter(function(m){return !!m._segment});
			if (splits.length!=oldm.length) return null;//cannot have other than p
		} 
		if (isMerged(segid))return null;

		return createMarkup(segid,breakat,0,{"_segment":newpara});
	}
	var renamePara=function(segid,renameto) { //once per 
		if (typeof layer.doc._segs[renameto]!=="undefined")return null;
		var oldm=_markups[segid];
		var oldm2=_markups[renameto];
		if (oldm || oldm2) return null;//cannot rename , already have other tag.		

		return createMarkup(segid,0,0,{"_rename":renameto});
	}
	var createMarkup=function(segid,start,len,payload) {
		if (!_markups[segid]) _markups[segid]=[];
		var uuid=UUID();
		var markup=JSON.parse(JSON.stringify(payload||{}));
		markup.uuid=uuid;
		markup.s=start;
		markup.l=len;
		segidOfuuid[uuid]=segid;

		_markups[segid].push(markup);
		return uuid;
	}

	var inscriptionOf=function(uuid) {
		var segid=segidOfuuid[uuid];
		var markup=get(uuid);
		
		var ins=layer.doc.get(segid,_version);
		if (typeof ins==="undefined") return "";

		return ins.substr(markup.s,markup.l);
	}

	var inscriptionOfAsync=function(uuid,cb) { //backed by kdb
		var segid=segidOfuuid[uuid];
		var markup=get(uuid);

		var ins=layer.doc.getAsync(segid,function(ins){
			if (typeof ins==="undefined") cb("");
			cb(ins.substr(markup.s,markup.l));
		},_version);		
	}


	var get=function(uuid) {
		var segid=segidOfuuid[uuid];
		var markups=_markups[segid]||[];
		for (var i=0;i<markups.length;i++) {
			if (markups[i].uuid===uuid) {
				return markups[i];
			}
		}
		return null;
	}

	var splitSeg=function(revs,segid) {
		for (var i=0;i<revs.length;i++) {
			var rev=revs[i];
			if (typeof rev._segment==="undefined") continue;

			var newSeg=rev._segment;
			var splitat=rev.s;
			var newtags=[];
			var tags=_markups[segid]||[];
			tags.map(function(tag){
				if (tag.s<splitat) return;
				tag.s-=splitat;
				newtags.push(tag);
			});

			_markups[segid]=tags.filter(function(tag){
				return tag.s<splitat;
			});

			if (!_markups[newSeg]) _markups[newSeg]=[];
			_markups[newSeg]=newtags;

			newtags.map(function(tag){
				segidOfuuid[tag.uuid]=newSeg;
			});
		}
	}

	var mergeSeg=function(revs,segid) {
		var mergewith=revs[0]._merge;
		if (typeof mergewith==="undefined") return;
		var tags=_markups[segid];
		var start=layer.doc.get(mergewith,-1).length; //get previous version
		
		tags.forEach(function(tag){
			tag.s+=start;
		});
		if (!_markups[mergewith]) _markups[mergewith]=[];
		_markups[mergewith]=_markups[mergewith].concat(tags);

		tags.map(function(tag){
			segidOfuuid[tag.uuid]=mergewith;
		});

		_markups[segid]=[];
	}

	var renameSeg=function(revs,segid) {
		var renameto=revs[0]._rename;
		if (typeof renameto==="undefined") return;

		var tags=_markups[segid];
		_markups[renameto]=_markups[segid];

		tags.map(function(tag){
			segidOfuuid[tag.uuid]=renameto;
		});

		_markups[segid]=[];
	}
	var adjustOffset=function(revs,m) {
		var s=m.s, l=m.l, delta=0, deleted=false;
		if (l<0) l=0;
		revs.map(function(rev){
			if (typeof rev.t=="undefined") return;
			if (rev.s<=s) { //this will affect the offset
				delta+= (rev.t.length-rev.l);
				if(rev.s+rev.l>=s+l) deleted=true;
			}
		});
		s+=delta;
		if (deleted) { //len=-n ,  not upgradable since last n version
			if (m.l>=0) l=-1; else l=m.l-1;
		}
		m.s=s;m.l=l;

		return m;
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
				segidOfuuid[M[i].uuid]=segid;
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
