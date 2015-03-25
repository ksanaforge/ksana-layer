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
		delete m[2].uuid;  //uuid is not required
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
	var segnames=opts.segnames||[];  /* keep the order of segs , can be served by kdb*/
	var rawtags={};  /* hold the tags, same format as kdb*/
	var versions=opts.versions||[];  /* revert to old version, [ version, reverts , revisions ]  */

	var version=opts.version||UUID();
	

	Object.defineProperty(doc,'segnames',{get:function(){return segnames}});
	Object.defineProperty(doc,'versions',{get:function(){return versions}});
	Object.defineProperty(doc,'version',{get:function(){return version}});
	Object.defineProperty(doc,'rawtags',{get:function(){return rawtags}});
	Object.defineProperty(doc,'ndoc',{get:function(){return segnames.length}});


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

		for (var i=versions.length-1;i>=0;i--) {
			var revs=versions[i].reverts[segid];

			if (revs) inscription=applyMutation(revs, inscription);
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
		prefetch(Object.keys(markups),function(){
			var segreverts={};
			for (var segid in markups) {
				var revisions=markups[segid];
				var oldinscription=get(segid);
				segreverts[segid]=revertRevision(revisions,oldinscription);

				revisions.sort(function(a,b){return b[0]-a[0]});//start from end

				var newtext=applyMutation(revisions,oldinscription);

				rawtags[segid]=rawtags[segid].map(adjustOffset,revisions);

				if (!segs[segid]) throw("text to set doesn't exist",segid);
				segs[segid]=newtext;
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