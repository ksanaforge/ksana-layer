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
		var at=(!!a.t),bt=(!!b.t);
		var am=(!!a._merge),bm=(!!b._merge);
		var as=(!!a._segment),bs=(!!b._segment);
		var r=0;
		if (at && bm || at && bs || as && bm) r= -1;
		else if (am && bs || as && bt || am && bt) r=  1;
		else {
			r=b.s-a.s;
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
		if (typeof m.t!=="undefined") {
			var newtext=inscription.substr(r.s,r.l);
			m.s+=offset;
			var text=m.t||"";
			m.l=text.length;
			m.t=newtext;
			delete m.uuid;  //uuid is not required
			offset+=m.l-newtext.length;
			reverts.push(m);
		} else if (m._segment) {
			var newp=m._segment; //new seg id
			if (!segreverts[newp]) segreverts[newp]=[];
			reverts.push({s:m.s,l:m.l,"_merge":newp}); //merge with newp
			var newptext=segs[newp]||"";

			segreverts[newp].push({s: m.s , l:m.l ,"_delete":segid} ); //delete with segid
		} else if (m._merge) {
			var oldsegid=m._merge; //the seg id to be merged with
			if (!segreverts[oldsegid]) segreverts[oldsegid]=[];
			reverts.push({s:m.s, l:m.l,_segment:oldsegid}); //merge with oldsegid
			segreverts[oldsegid].push({s:m.s,l:m.l,_segment:segid}); //break oldsegid

		} else if (m._rename) {
			var renameto=m._rename; 
			reverts.push({s:m.s,l:m.l,_rename:renameto});
			segreverts[renameto]=[ {s:m.s,l:m.l,_rename:segid}];
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
	var backwardSplitSegment=function(ver,text,rev,oldSegid) { //will not change segs
		//console.log(text,segs[newSegid],breakat)
		//return segs[newSegid].substr(breakat);
		var breakat=rev.s;
		var len=rev.l;
		var newSegid=rev._segment;
		
		//debuglog("back split",text, rev, "from",newSegid )
		if (!text) {
			var nv=nextVersion(ver);
			//debuglog("get text from newSegid",newSegid,nv)
			var t=get(newSegid,nv);
			//debuglog("'"+t+"'",breakat,len);

			if (nv==version) return {text:t.substr(breakat,len),segid:newSegid};
			else return {text:t,segid:newSegid};
		}
		//debuglog("use old inscription")
		return {text:text.substr(0,breakat),segid:oldSegid}; //find text in other segment
	}
	var splitSegment=function(text,currentSegid,rev) {
		var newSegid=rev._segment;
		var breakat=rev.s;
		if (breakat<=0 || breakat===text.length) {
			console.error("cannot break at ",breakat,text,currentSegid,rev);
			return {text:text,segid:currentSegid};
		}
		if (segs[newSegid]) {
			throw "repeated segname";
		} else {
			segs[newSegid]=text.substr(breakat);
			rev.l=segs[newSegid].length;  // bytes of new segname
			var i=segnames.indexOf(currentSegid);
			segnames.splice(i,0,newSegid);				
			return {text:text.substr(0,breakat),segid:currentSegid};
		}
	}
	var backwardMergeSegment=function(ver,text,rev) { //will not change segs
		var newSegid=rev._merge;
		var breakat=rev.s;

		//debuglog("backward merge",text,rev)

		var newtext=get(newSegid,nextVersion(ver));
		return {text:(text||"")+newtext, segid:newSegid};
	}
	var mergeSegment=function(text,currentSegid,rev) {
		var oldSegname=rev._merge;
		rev.l=text.length;
		rev.s=segs[oldSegname].length;
		segs[oldSegname]+=text;
		var i=segnames.indexOf(currentSegid);
		segnames.splice(i,1);
		delete segs[currentSegid];

		return {text:undefined,segid:currentSegid};
	}
	var backwardRenameSegment=function(ver,text,rev) { //will not change segs
		var newSegid=rev._rename;
		var newtext=get(newSegid,nextVersion(ver));
		return {text:newtext,segid:newSegid};
	}
	var renameSegment=function(text,currentSegid,rev) {
		var oldSegname=rev._rename;
		segs[oldSegname]=text;
		var i=segnames.indexOf(currentSegid);
		segnames.splice(i,1);
		delete segs[currentSegid];

		return {text:undefined,segid:currentSegid};
	}

	var applyMutation=function(ver,revisions,text,segid,getting){
		//debuglog(segid,'apply mutation',text);
		var res={text:text,segid:segid};
		for (var i=0;i<revisions.length;i++) {
			var r=revisions[i];
			var ran=Math.random().toString().substr(2,4);
			if (typeof r.t!=="undefined") {//text mutation
				//debuglog("T"+ran)
				res.text=res.text.substring(0,r.s)+(r.t||"")+res.text.substring(r.s+r.l);
				//debuglog("T end"+ran)
			} else if (r._segment) { //breaking
				//if (getting) console.log('getting',segid,r,text);
				//debuglog("P"+ran+"{")
				res=getting?backwardSplitSegment(ver,res.text,r,res.segid):splitSegment(res.text,res.segid,r);
				//debuglog("}P end"+ran,text)
			} else if (r._merge) { //merging
				//debuglog("M"+ran)
				//if (getting) console.log('getting',segid,r,text);
				res=getting?backwardMergeSegment(ver,res.text,r):mergeSegment(res.text,res.segid,r);
				//debuglog("M end"+ran,text)
			} else if (r._delete) {
				//debuglog("removed")
				return "";
			} else if (r._rename) {
				res=getting?backwardRenameSegment(ver,res.text,r):renameSegment(res.text,res.segid,r);
			}
		};

		//debuglog(segid,"after mutation",text)
		return res;
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
				if (revs[0]._merge) revs=sortMutation( revs,true); //merge from higher offset
				var res=applyMutation(versions[i].version,revs, inscription,segid,true);
				inscription=res.text;
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
			if (typeof rev._segment==="undefined") continue;

			var newSeg=rev._segment;
			var splitat=rev.s;
			var newtags=[];
			var tags=rawtags[segid]||[];
			tags.map(function(tag){
				if (tag[0]<splitat) return;
				newtags.push([tag[0]-splitat,tag[1]]);
			});

			rawtags[segid]=tags.filter(function(tag){
				return tag[0]<splitat;
			});

			if (!rawtags[newSeg]) rawtags[newSeg]=[];
			rawtags[newSeg]=newtags;
		}
	}

	var mergeSeg=function(revs,segid) {
		var mergewith=revs[0]._merge;
		if (typeof mergewith==="undefined") return;
		var tags=rawtags[segid];
		var start=segs[mergewith].length;
		var newtags=tags.map(function(tag){
			return [tag[0]+start,tag[1]];
		});
		if (!rawtags[mergewith]) rawtags[mergewith]=[];
		rawtags[mergewith]=rawtags[mergewith].concat(newtags);

		rawtags[segid]=[];
	}

	var renameSeg=function(revs,segid) {
		var renameto=revs[0]._rename;
		if (typeof renameto==="undefined") return;
		rawtags[renameto]=rawtags[segid];
		rawtags[segid]=[];
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
					mergeSeg(revisions,segid);
					splitSeg(revisions,segid);
					renameSeg(revisions,segid);
					rawtags[segid]=(rawtags[segid]||[]).map(adjustRawtagOffset,revisions);
					if (!rawtags[segid].length) delete rawtags[segid];
				}

				var res=applyMutation(version,revisions,oldinscription,segid);

				
				var reverts=revertRevision(segs,revisions,oldinscription,segid,segreverts);
				segreverts[segid]=reverts;

				if (typeof res.text!=="undefined") { //after merged , seg is gone
					if (!segs[segid]) throw("text to set doesn't exist "+segid);
					segs[segid]=res.text;				
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