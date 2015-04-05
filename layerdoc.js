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
	//apply text mutation "t", then pagebreak "p", finally paragraph merge "m"
	//each group sort desc by start offset
	return revisions.sort(function(a,b){
		var at=(!!a[2].t),bt=(!!b[2].t);
		var am=(!!a[2].m),bm=(!!b[2].m);
		var ap=(!!a[2].p),bp=(!!b[2].p);
		var r=0;
		if (at && bm || at && bp || ap && bm) r= -1;
		else if (am && bp || ap && bt || am && bt) r=  1;
		else {
			r=b[0]-a[0];
			if (reverse) r=1-r;
		}
		return r;

	});
}
//convert revert and revision back and forth
var revertRevision=function(segs,revs,inscription,segid,segreverts) {
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
			reverts.push([m[0],m[1],{"m":newp}]); //merge with newp
			var newptext=segs[newp]||"";

			segreverts[newp].push([ m[0] , m[1] ,{"d":segid} ]); //delete with segid
		} else if (m[2].m) {
			var oldsegid=m[2].m; //the seg id to be merged with
			if (!segreverts[oldsegid]) segreverts[oldsegid]=[];
			reverts.push([m[0],m[1],{p:oldsegid}]); //merge with oldsegid
			segreverts[oldsegid].push([m[0],m[1],{p:segid} ]); //break oldsegid

		} else if (m[2].r) {
			var renameto=m[2].r; //t
			reverts.push([m[0],m[1],{r:renameto}]);
			segreverts[renameto]=[[m[0],m[1],{r:segid}]];
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

	Object.defineProperty(doc,'debug',{get:function(){return debug}, set:function(d){debug=d}});


	var nextVersion=function(ver) { //return next version, input latest version output latest version
		for (var i=0;i<versions.length;i++) {
			if (versions[i].version==ver) {
				if (i<versions.length-1) return versions[i+1].version;
			}
		}
		return version;
	}
	var backwardSplitSegment=function(ver,text,rev,newSegname) { //will not change segs
		//console.log(text,segs[newSegname],breakat)
		//return segs[newSegname].substr(breakat);
		var breakat=rev[0];
		var len=rev[1];
		var newSegname=rev[2].p;
		
		//debuglog("back split",text, rev, "from",newSegname )
		if (!text) {
			var nv=nextVersion(ver);
			//debuglog("get text from newsegname",newSegname,nv)
			var t=get(newSegname,nv);
			//debuglog("'"+t+"'",breakat,len);

			if (nv==version) return t.substr(breakat,len);
			else return t;
		}
		//debuglog("use old inscription")
		return text.substr(0,breakat); //find text in other segment
	}
	var splitSegment=function(text,currentSegname,rev) {
		var newSegname=rev[2].p;
		var breakat=rev[0];
		if (breakat<=0 || breakat===text.length) {
			console.error("cannot break at ",breakat,text,currentSegname,rev);
			return text;
		}
		if (segs[newSegname]) {
			throw "repeated segname";
		} else {
			segs[newSegname]=text.substr(breakat);
			rev[1]=segs[newSegname].length;  // bytes of new segname
			var i=segnames.indexOf(currentSegname);
			segnames.splice(i,0,newSegname);				
			return text.substr(0,breakat);
		}
	}
	var backwardMergeSegment=function(ver,text,rev) { //will not change segs
		var newSegname=rev[2].m;
		var breakat=rev[0];

		//debuglog("backward merge",text,rev)

		var newtext=get(newSegname,nextVersion(ver));
		return (text||"")+newtext;
	}
	var mergeSegment=function(text,currentSegname,rev) {
		var oldSegname=rev[2].m;
		rev[1]=text.length;
		rev[0]=segs[oldSegname].length;
		segs[oldSegname]+=text;
		var i=segnames.indexOf(currentSegname);
		segnames.splice(i,1);
		delete segs[currentSegname];

		return undefined;
	}
	var backwardRenameSegment=function(ver,text,rev) { //will not change segs
		var newSegname=rev[2].r;
		var newtext=get(newSegname,nextVersion(ver));
		return newtext;
	}
	var renameSegment=function(text,currentSegname,rev) {
		var oldSegname=rev[2].r;
		segs[oldSegname]=text;
		var i=segnames.indexOf(currentSegname);
		segnames.splice(i,1);
		delete segs[currentSegname];

		return undefined;
	}

	var applyMutation=function(ver,revisions,text,segid,getting){
		//debuglog(segid,'apply mutation',text);
		for (var i=0;i<revisions.length;i++) {
			var r=revisions[i];
			var ran=Math.random().toString().substr(2,4);
			if (typeof r[2].t!=="undefined") {//text mutation
				//debuglog("T"+ran)
				text=text.substring(0,r[0])+(r[2].t||"")+text.substring(r[0]+r[1]);	
				//debuglog("T end"+ran)
			} else if (r[2].p) { //breaking
				//if (getting) console.log('getting',segid,r,text);
				//debuglog("P"+ran+"{")
				text=getting?backwardSplitSegment(ver,text,r):splitSegment(text,segid,r);
				//debuglog("}P end"+ran,text)
			} else if (r[2].m) { //merging
				//debuglog("M"+ran)
				//if (getting) console.log('getting',segid,r,text);
				text=getting?backwardMergeSegment(ver,text,r):mergeSegment(text,segid,r);
				//debuglog("M end"+ran,text)
			} else if (r[2].d) {
				//debuglog("removed")
				return "";
			} else if (r[2].r) {
				text=getting?backwardRenameSegment(ver,text,r):renameSegment(text,segid,r);
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
				if (revs[0][2].m) revs=sortMutation( revs,true); //merge from higher offset
				inscription=applyMutation(versions[i].version,revs, inscription,segid,true);
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

	var splitSeg=function(revs,segid) {

		for (var i=0;i<revs.length;i++) {
			var rev=revs[i];
			if (typeof rev[2].p==="undefined") continue;

			var newSeg=rev[2].p;
			var splitat=rev[0]
			var newtags=[];
			var tags=rawtags[segid]||[];
			tags.map(function(t){
				if (t[0]<splitat) return;
				newtags.push([t[0]-splitat,t[1]]);	
			});

			rawtags[segid]=tags.filter(function(t){
				return t[0]<splitat;
			});

			if (!rawtags[newSeg]) rawtags[newSeg]=[];
			rawtags[newSeg]=newtags;
		}


	}

	var mergeSeg=function(revs,segid) {
		var mergewith=revs[0][2].m;
		if (typeof mergewith==="undefined") return;
		var tags=rawtags[segid];
		var start=segs[mergewith].length;
		var newtags=tags.map(function(t){
			return [t[0]+start,t[1]];
		});
		if (!rawtags[mergewith]) rawtags[mergewith]=[];
		rawtags[mergewith]=rawtags[mergewith].concat(newtags);

		rawtags[segid]=[];
	}

	var renameSeg=function(revs,segid) {
		var renameto=revs[0][2].r;
		if (typeof renameto==="undefined") return;
		console.log("rename")
		rawtags[renameto]=rawtags[segid];
		rawtags[segid]=[];
	}
	//tag are never deleted, only moved to new position
	var adjustOffset=function(m) {
		var s=m[0], delta=0;
		var revs=this;
		revs.forEach(function(rev){
			if (typeof rev[2].t=="undefined") return;
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
				var oldinscription=segs[segid];

				revisions=sortMutation(revisions);
				if (rawtags[segid]) {
					mergeSeg(revisions,segid);
					splitSeg(revisions,segid);
					renameSeg(revisions,segid);
					rawtags[segid]=(rawtags[segid]||[]).map(adjustOffset,revisions);
					if (!rawtags[segid].length) delete rawtags[segid];
				}

				var newtext=applyMutation(version,revisions,oldinscription,segid);

				segreverts[segid]=revertRevision(segs,revisions,oldinscription,segid,segreverts);


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