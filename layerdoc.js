var UUID=require("./uuid");



var sortMutation=function(revisions,reverse) { 
	//apply text mutation "t", then pagebreak "p", finally paragraph merge "m"
	//each group sort desc by start offset
	return revisions.sort(function(a,b){
		var at=(!!a[2].t),bt=(!!b[2].t);
		var am=(!!a[2].m),bm=(!!b[2].m);
		var ap=(!!a[2].p),bp=(!!b[2].p);
		var r=0;
		if (at && bm || at && bp || ap && bm) r= -1;			
		else if (am && bp || ap && bt || am && bt) r=  1;
		else r=b[0]-a[0];

		if (reverse) r=1-r;
		return r;

	});
}
//convert revert and revision back and forth
var revertRevision=function(revs,inscription,segid,segreverts) {
	var reverts=[], offset=0;

	revs=sortMutation(revs,true);  //sort asc by starting offset
	
	revs.map(function(r){
		var newinscription="";
		var	m=JSON.parse(JSON.stringify(r));
		if (typeof m[2].t!=="undefined") {
			var newtext=inscription.substr(r[0],r[1]);
			m[0]+=offset;
			var text=m[2].t||"";
			m[1]=text.length;
			m[2].t=newtext;
			delete m[2].uuid;  //uuid is not required
			offset+=m[1]-newtext.length;
			reverts.push(m);
		} else if (m[2].p) {
			var newp=m[2].p; //new seg id
			if (!segreverts[newp]) segreverts[newp]=[];
			reverts.push([m[0],0,{m:newp}]); //merge with newp
			segreverts[newp].push([m[0],0,{m:segid} ]); //merge with segid
		} else if (m[2].m) {
			var oldsegid=m[2].m; //the seg id to be merged with
			if (!segreverts[oldsegid]) segreverts[oldsegid]=[];
			reverts.push([m[0],0,{p:oldsegid}]); //merge with oldsegid
			segreverts[oldsegid].push([m[0],0,{p:segid} ]); //break oldsegid

		} else throw "incorrect revs format "+r;
	});
	//reverts.sort(function(a,b){return b[0]-a[0];}); //sort desc

	reverts=sortMutation(reverts);

	return reverts;
};


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


	var nextVersion=function(ver) { //return next version, input latest version output latest version
		for (var i=0;i<versions.length;i++) {
			if (versions[i]==ver) {
				if (i<versions.length-1) return versions[i+1];
			}
		}
		return version;
	}
	var backwardSplitSegment=function(ver,text,breakat,newSegname) { //will not change segs
		//console.log(text,segs[newSegname],breakat)
		//return segs[newSegname].substr(breakat);
		if (typeof text!=="undefined") return text.substr(0,breakat);
		else {
			//console.log(nextVersion(ver),version,get(newSegname,version))
			//console.log(ver,version,newSegname,segs,get(newSegname,nextVersion(ver)))
			return get(newSegname,nextVersion(ver)).substr(breakat); //find text in other segment
		}
	}
	var splitSegment=function(text,breakat,currentSegname,newSegname) {

		if (segs[newSegname]) {
			throw "repeated segname";
		} else {
			segs[newSegname]=text.substr(breakat);
			var i=segnames.indexOf(currentSegname);
			segnames.splice(i,0,newSegname);				
			return text.substr(0,breakat);
		}
	}
	var backwardMergeSegment=function(ver,newSegname) { //will not change segs
		//console.log("invert merge")
		return text+get(newSegname,ver);
	}
	var mergeSegment=function(text,currentSegname,oldSegname) {
		segs[oldSegname]+=text;
		var i=segnames.indexOf(currentSegname);
		segnames.splice(i,1);
		delete segs[currentSegname];			

		return undefined;
	}
	var applyMutation=function(ver,revisions,text,segid,getting){
		revisions.map(function(r){
			if (typeof r[2].t!=="undefined") {//text mutation
				text=text.substring(0,r[0])+(r[2].t||"")+text.substring(r[0]+r[1]);	
			} else if (r[2].p) { //breaking
				if (getting) console.log(segid,r[2].p,text);
				
				text=getting?backwardSplitSegment(ver,text,r[0],r[2].p):splitSegment(text,r[0],segid,r[2].p);
			} else if (r[2].m) { //merging
				text=getting?backwardMergeSegment(ver,r[2].m):mergeSegment(text,segid,r[2].m);
			}
		});
		return text;
	}

	var get=function(segid,ver) {
		var inscription=segs[segid];

		if (typeof ver==="undefined" || ver===version) return segs[segid];

		if (!hasVersion(ver)) return null;

		for (var i=versions.length-1;i>=0;i--) {
			var revs=versions[i].reverts[segid];
			//console.log(versions[i].reverts,segid,i,ver,versions[i].version,inscription)
			if (revs) inscription=applyMutation(ver,revs, inscription,segid,true);
			
			if (versions[i].version==ver) break;
		}
		return inscription;
	}

	var getAsync=function(segid,cb,ver) { //virtual method
		if (cb) cb(get(segid,ver));
	}
	var prefetch=function(segments,cb) { //virtual method
		cb();
	}

	//tag are never deleted, only moved to new position
	var adjustOffset=function(m) {
		var s=m[0], delta=0;
		var revs=this;
		revs.map(function(rev){
			if (rev[0]<=s) { //this will affect the offset
				delta+= (rev[2].t.length-rev[1]);
			}
		});
		s+=delta;
		return [s,m[1]];
	}
	var removeUUID=function(revs) {
		var out=JSON.parse(JSON.stringify(revs));
		for (var i in out) {
			out[i].forEach(function(r){
				delete r[2].uuid;
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
				var oldinscription=get(segid);

				revisions=sortMutation(revisions);

				var newtext=applyMutation(version,revisions,oldinscription,segid);

				segreverts[segid]=revertRevision(revisions,oldinscription,segid,segreverts);

				if (rawtags[segid]) rawtags[segid]=rawtags[segid].map(adjustOffset,revisions);

				if (typeof newtext!=="undefined") { //after merged , seg is gone
					if (!segs[segid]) throw("text to set doesn't exist "+segid);
					segs[segid]=newtext;				
				}
			}
			var revs=removeUUID(markups);

			versions.push({version:version, reverts:segreverts, revisions: revs});
			version=UUID();
			if (cb) cb();
		})
	}

	var extractTag=function(buf) {
		var tags=[],taglengths=0;
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
module.exports={createFromCSV:createFromCSV,create:createDocument};