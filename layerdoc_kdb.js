/* layerdoc backed by kdb */

var layerdoc=require("./layerdoc");
var createFromKdb=function(kdb) {
	var doc=layerdoc.create();
	doc.kdb=kdb;
	doc._setndoc(kdb.get("meta").segcount);
	doc._setversion(Date.parse(kdb.get("meta").builddate));
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
	doc.prefetch=function(segnames,cb) {
		var segnames=filterLoadedSeg(segnames);

		var filesegs=kdb.findFirstSeg(segnames);

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
			cb(parentget(segname,ver));
		})
	}
	return doc;
}

module.exports=createFromKdb;