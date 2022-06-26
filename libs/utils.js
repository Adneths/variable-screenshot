const ZIP_MAX_SIZE = 100000000;

function isEmpty(obj)
{
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

function toName(date)
{
	return `${date.getFullYear()}_${`0${date.getMonth()+1}`.slice(-2)}_${`0${date.getDate()}`.slice(-2)}_${`0${date.getHours()}`.slice(-2)}_${`0${date.getMinutes()}`.slice(-2)}_${`0${date.getSeconds()}`.slice(-2)}`;
}


async function getZipPack(i)
{
	return chrome.storage.local.get('zip'+i).then(data => {
		if(isEmpty(data))
			return {size: 0, zip: new JSZip()};
		return JSZip.loadAsync(data['zip'+i].zip, {base64: true}).then(zip => {
			return {size: data['zip'+i].size, zip: zip};
		});
	});
}
async function getZipCount()
{
	return chrome.storage.local.get('zips').then(data => {
		if(isEmpty(data))
			return 0;
		return data.zips;
	});
}
async function getCount()
{
	return chrome.storage.local.get('count').then(data => {
		if(isEmpty(data))
			return 0;
		return data.count;
	});
}
async function getUnprocessedCount()
{
	return chrome.storage.local.get('unprocessedCount').then(data => {
		if(isEmpty(data))
			return 0;
		return data.unprocessedCount;
	});
}