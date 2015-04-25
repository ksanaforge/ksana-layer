/* layerdoc backed by kdb */

var layerdoc=require("./layerdoc");
var createFromKdb=function(kdb) {
	var meta=kdb.get("meta");

	var doc=layerdoc.create({name:meta.name,segnames:kdb.get("segnames"),version:Date.parse(meta.builddate)});
	var parentget=doc.get;

	doc.put=function() {
		throw "cannot put new segment, data is backed by kdb";
	}

	var filterLoadedSeg=function(segnames) {
		var out=[];
		for (var i=0;i<segnames.length;i++) {
			if (!parentget(segnames[i])	) out.push(segnames[i]);
		}
		return out;
	}
	var filesegsFromSegnames=function(segs) {
		var segnames=kdb.get("segnames");
		var out=[];
		segs.forEach(function(segname){
			var idx=segnames.indexOf(segname)
			if (idx>-1) out.push(kdb.absSegToFileSeg(idx));
		});
		return out;
	}
	doc.prefetch=function(segnames,cb) {
		var segnames=filterLoadedSeg(segnames);

		var filesegs=filesegsFromSegnames(segnames);

		var keys=filesegs.map(function(fseg){
			return ["filecontents",fseg.file,fseg.seg];
		})
		var segs=this._segs();
		kdb.get(keys,function(data) {
			segnames.map(function(segname,idx){
				segs[segname]=data[idx];
			})
			cb();	
		})
	}

	doc.getAsync=function(segname,cb,ver) {
		this.prefetch(segname,function(){
			var res=parentget(segname,ver);
			if (cb) cb(res);
		})
	}

	doc.has=function(segname) {
		var segnames=kdb.get("segnames");
		return segnames.indexOf(segname)>-1;
	}
	return doc;
}

module.exports=createFromKdb;