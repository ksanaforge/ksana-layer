/**
	Ksana Layer document
	@module layerdoc
*/
'use strict';
var UUID=require("./uuid");

var debug=false,depth=0;
var debuglog=function() {
	if (!debug)return;
	var o="";
	var args=[];

	for (var i=0;i<depth;i++) o+="  ";
	args.push(o);
	for (var i=0;i<arguments.length;i++) {
		args.push(arguments[i]);
	}
	console.log.apply(this,args );
}
var sortMutation=function(revisions,reverse) { 
	return revisions.sort(function(a,b){
		var r=b.s-a.s;
		if (reverse) r=1-r;
		return r;
	});
}
/**
	Create revert information from revision information
	@param {array} revisions
	@param {string} inscription text
	@private
*/
var revertRevision=function(revs,inscription) {
	var reverts=[], offset=0;

	revs=sortMutation(revs,true);  //sort asc by starting offset
	
	revs.map(function(r){
		var newinscription="";
		var	m=JSON.parse(JSON.stringify(r));
		if (typeof m.t!=="undefined") {
			var newtext=inscription.substr(r.s,r.l);
			m.s+=offset;
			var text=m.t||"";
			m.l=text.length;
			m.t=newtext;
			delete m.uuid;  //uuid is not required
			offset+=m.l-newtext.length;
			reverts.push(m);
		} else throw "incorrect revs format "+r;
	});
	//reverts.sort(function(a,b){return b[0]-a[0];}); //sort desc

	reverts=sortMutation(reverts);

	return reverts;
};

/**
	Create Ksana Layer document
	@param {object} options, .name , .versions history,  .version id
*/
var createDocument=function(opts) {
	opts=opts||{};
	var doc={name:opts.name||"noname"};

	var segs={};
	var segnames=opts.segnames||[];  /* keep the order of segs , can be served by kdb*/
	var rawtags={};  /* hold the tags, same format as kdb*/
	var versions=opts.versions||[];  /* revert to old version, [ version, reverts , revisions ]  */

	var version=opts.version||UUID();

	Object.defineProperty(doc,'segnames',{get:function(){return segnames}});
	Object.defineProperty(doc,'versions',{get:function(){return versions}});
	Object.defineProperty(doc,'version',{get:function(){return version}});
	Object.defineProperty(doc,'rawtags',{get:function(){return rawtags}});
	Object.defineProperty(doc,'ndoc',{get:function(){return segnames.length}});

	Object.defineProperty(doc,'debug',{get:function(){return debug}, set:function(d){debug=d}});

	var nextVersion=function(ver) { //return next version, input latest version output latest version
		for (var i=0;i<versions.length;i++) {
			if (versions[i].version==ver) {
				if (i<versions.length-1) return versions[i+1].version;
			}
		}
		return version;
	}
	var applyMutation=function(revisions,text){
		for (var i=0;i<revisions.length;i++) {
			var r=revisions[i];
			var ran=Math.random().toString().substr(2,4);
			if (typeof r.t!=="undefined") {//text mutation
				//debuglog("T"+ran)
				text=text.substring(0,r.s)+(r.t||"")+text.substring(r.s+r.l);
				//debuglog("T end"+ran)
			}
		};

		//debuglog(segid,"after mutation",text)
		return text;
	}

	var getPreviousVersion=function(ver) {
		if (ver>0) return ver;
		if (ver===0 || versions.length==0) return version;

		var at=versions.length+ver;
		if (at>=0) return versions[at].version;
		else return versions[0].version; //original
	}

	var get=function(segid,ver) {
		//debuglog("get '"+segid+"'",ver,"lastest",segs[segid])
		
		var inscription=segs[segid];

		if (typeof ver==="undefined" || ver===version) return segs[segid];
		if (ver<0) ver=getPreviousVersion(ver);

		if (!hasVersion(ver)) return null;

		depth++;
		for (var i=versions.length-1;i>=0;i--) {
			var revs=versions[i].reverts[segid];
			if (revs &&revs.length) {
				if (revs[0]._merge) revs=sortMutation(revs,true); //merge from higher offset
				inscription=applyMutation(revs, inscription);
				//debuglog(segid,inscription)
			}
			
			if (versions[i].version==ver) break;
		}
		depth--;
		return inscription;
	}

	var getAsync=function(segid,cb,ver) { //to be override
		if (cb) cb(get(segid,ver));
	}
	var prefetch=function(segments,cb) { //to be override
		cb();
	}

	//tag are never deleted, only moved to new position
	var adjustRawtagOffset=function(m) {
		var s=m[0], delta=0;
		var revs=this;
		revs.forEach(function(rev){
			if (typeof rev.t=="undefined") return;
			if (rev.s<=s) { //this will affect the offset
				delta+= (rev.t.length-rev.l);
			}
		});
		return [s+delta,m[1]];
	}
	var removeUUID=function(revs) {
		var out=JSON.parse(JSON.stringify(revs));
		for (var i in out) {
			out[i].forEach(function(r){
				delete r.uuid;
			})
		}
		return out;
	}

	var evolve=function(markups,cb) {
		if (typeof markups.markups!=="undefined") markups=markups.markups; //user supply layer instead of markups
		prefetch(Object.keys(markups),function(){
			var segreverts={};
			for (var segid in markups) {

				var revisions=markups[segid];
				var oldinscription=segs[segid];

				revisions=sortMutation(revisions);
				if (rawtags[segid]) {
					rawtags[segid]=(rawtags[segid]||[]).map(adjustRawtagOffset,revisions);
					if (!rawtags[segid].length) delete rawtags[segid];
				}

				segs[segid]=applyMutation(revisions,oldinscription);
				var reverts=revertRevision(revisions,oldinscription);
				segreverts[segid]=reverts;
			}
			var revs=removeUUID(markups);

			versions.push({version:version, reverts:segreverts, revisions: revs});
			version=UUID();
			if (cb) cb();
		});
	}

	var extractTag=function(buf) {
		var tags=[],taglengths=0;
		if (!buf) return {text:buf,tags:tags};
		var text=buf.replace(/<(.*?)>/g,function(m,m1,idx){
			tags.push([idx-taglengths,m1]);
			taglengths+=m.length;
			return "";
		});
		return {text:text, tags:tags};
	}

	var put=function(id,entry) {
		if (segs[id]) {
			console.error("id",id,"already exists");
			return false;
		}
		var res=extractTag(entry);
		segs[id]=res.text;
		if (res.tags.length) {
			rawtags[id]=res.tags;
		}
		segnames.push(id);
		return res.text;
	}


	var _segs=function() {
		return segs;
	}

	var hasVersion=function(version) {
		if (version===doc.version) return true;
		return versions.filter(function(r){return r.version===version}).length==1;
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

	doc._sortMutation=sortMutation;

	doc.exportCSV=exportCSV;
	doc.exportVersions=exportVersions;

	doc.upgradeMarkups=upgradeMarkups;

	return doc;
}
/* similar to ksana-database/exportas dump */
var injectTag=function(content,tags) {

	if (!tags || !tags.length) return content;
	var out="",n=0;
	var offset=tags[n][0];
	for (var i=0;i<content.length;i++) {
		if (offset===i) {
			out+="<"+tags[n][1]+">";
			n++;
			if (n===tags.length) break;
			offset=tags[n][0];
		}
		out+=content[i];
	}
	out+=content.substr(i);
	return out;
}

var exportCSV=function() {
	var out="", segs=this._segs(), segnames=this.segnames , rawtags=this.rawtags;
	this.prefetch(segnames,function(){
		segnames.map(function(segname){
			var content=injectTag(segs[segname],rawtags[segname])
						.replace(/\n/g,"\\n").replace(/\t/g,"\\t");
			out+=segname+","+content+"\n";
		})
	});
	return out;
}

var exportVersions=function() {
	return JSON.stringify({latestversion:this.version,versions:this.versions});
}
/**
	Create Ksana Layer document from CSV buffer
	@param {string} input buffer in csv format
	@param {object} options pass to createDocument
*/
var createFromCSV=function(buf,opts) {
	var layerdoc=createDocument(opts);
	var lines=buf.replace(/\r\n/g,"\n").split("\n");
	for (var i=0;i<lines.length;i++) {
		var L=lines[i].trim();
		if (!L) continue;
		L=L.replace(/\\n/g,"\n");
		L=L.replace(/\\t/g,"\t");		
		var comma=L.indexOf(",");
		if (comma==-1) {
			throw "not a csv at line "+i;
			return;
		}
		layerdoc.put(L.substr(0,comma),L.substr(comma+1));
	}

	return layerdoc;
}

var upgradeMarkups=function(ver,segid,markups) {
	if (ver===this.version) return;  //nothing to do

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

	var versions=this.versions;
	for (var i=0;i<versions.length;i++) {
		if (versions[i].version<ver) continue;
		var forward=versions[i].revisions[segid];
		if (forward) {
			for (var j=0;j<markups.length;j++)	markups[j]=adjustOffset(forward, markups[j]);
		}
	}
}
module.exports={createFromCSV:createFromCSV,create:createDocument};