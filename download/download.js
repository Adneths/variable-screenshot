async function downloadZipFromZip(zip, name, part, promises)
{
	return zip.generateAsync({type: 'blob'}).then(blob => {
		let url = URL.createObjectURL(blob);
		return chrome.downloads.download({url: url, filename: name + (part === 0 ? '' : ' part-' + part) + '.zip', conflictAction: 'uniquify'}).then(id => {
			promises.push(new Promise((resolve, reject) => {
				timer = setTimeout(() => reject(1), 300000);
				chrome.downloads.onChanged.addListener(delta => {
					if(delta.id === id && delta.state != undefined && delta.state.current === 'complete')
					{
						URL.revokeObjectURL(url);
						clearTimeout(timer);
						resolve(0);
					}
				});
			}));
		});
	});
}

async function downloadZipFromInd(ind, name, part, promises)
{
	return getZipPack(ind).then(pack => {
		return downloadZipFromZip(pack.zip, name, part, promises);
	});
}

document.addEventListener('DOMContentLoaded', (event) => {
	let stateLabel = document.getElementById("state");
	
	chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
		let tabId = tabs[0].id;
		stateLabel.innerHTML = 'The batch is being prepared';
		let fileName = toName(new Date());
		getUnprocessedCount().then(async unprocessedCount => {
			let promises = [];
			let zipInd = 0;
			if(unprocessedCount != 0)
			{
				let zipPack = await getZipPack(zipInd);
				let i = 0;
				while(i <= unprocessedCount)
				{
					if(zipPack.size > ZIP_MAX_SIZE || i === unprocessedCount)
					{
						if(i != unprocessedCount)
							stateLabel.innerHTML = 'Splitting download';
						else
							stateLabel.innerHTML = 'Download batch';
						let sPromise = zipPack.zip.generateAsync({type: 'base64'}).then(result => {
							let obj = {};
							obj['zip'+zipInd] = {size: zipPack.size, zip: result};
							chrome.storage.local.set(obj);
						});
						let dPromise = downloadZipFromZip(zipPack.zip, fileName, i === unprocessedCount && zipInd == 0 ? 0 : zipInd+1, promises);
						if(i === unprocessedCount)
						{
							await dPromise;
							chrome.storage.local.set({zips: zipInd+1, unprocessedCount: 0});
							break;
						}
						else
							await Promise.all([sPromise, dPromise]).then(async () => {
								zipPack = await getZipPack(++zipInd);
							});
					}
					else
					{
						stateLabel.innerHTML = 'Zipping remaining ' + (i+1) + '/' + unprocessedCount;
						let imgData = await chrome.storage.local.get('image'+i);
						let img = imgData['image'+i];
						let dupes = zipPack.zip.file(new RegExp(img.name)).length;
						if(dupes === 0)
							zipPack.zip.file(img.name + ".png", img.data, {base64: true});
						else
							zipPack.zip.file(img.name + " (" + dupes + ").png", img.data, {base64: true});
						chrome.storage.local.remove('image'+i);
						zipPack.size += img.data.length*3/4;
						i++;
					}
				}
				Promise.all(promises).then(() => {
					chrome.tabs.remove(tabId);
				});
			}
			else
			{
				getZipCount().then(async zips => {
					while(zipInd < zips)
					{
						await downloadZipFromInd(zipInd++, fileName, zips == 1 ? 0 : zipInd+1, promises);
					}
					Promise.all(promises).then(() => {
						chrome.tabs.remove(tabId);
					});
				});
			}
			
			stateLabel.innerHTML = 'The batch is being downloaded';
		});
	});
});