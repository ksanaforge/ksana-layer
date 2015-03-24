/*
  return a even number unique indentifier
*/
var startdate=Date.parse("2015/3/1");
var lastuuid=Date.now() - startdate;
var UUID=function() {
	var uuid=Date.now() - startdate;
	if (uuid % 2==1) uuid++;

	while (uuid<=lastuuid) {
		uuid+=2;
	}
	lastuuid=uuid;
	return uuid;
}

module.exports=UUID;